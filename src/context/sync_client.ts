// SyncClient — orchestrateur de synchronisation côté renderer
//
// Flux Phase 4 :
//   pull : GET /sync-state?since=<maxVersionLocal> → applyRemote.
//   push : lecture de sync_state.getDirty() local → PUT /:table/:id avec
//          `_version` / `_updatedAt`. Réponse :
//            - applied:"client" → markClean.
//            - applied:"server" → applyRemote(canonical) + markClean
//              + event `sync:server-overwrite` pour le toast UI.
//   SSE  : simple trigger d'un requestSync() debouncé (pas d'application
//          directe — `sync_state` reste la seule source de vérité).
//
// Plus de file d'attente localStorage : sync_state local est la queue.
// Seule la queue images (R2, hors D1) survit en localStorage.

export type SyncableTable =
    | "administrateurs"
    | "clients"
    | "collections"
    | "sous_collections"
    | "articles"
    | "devis"
    | "factures"
    | "lignes_documents"
    | "techniciens"
    | "projets"
    | "taches_projet"
    | "boutiques"
    | "stocks_boutique"
    | "transferts_stock"
    | "entreprises";

export type SyncPhase = 'idle' | 'pull' | 'push' | 'bootstrap' | 'images';

export type SyncStatus = {
    online: boolean;
    enabled: boolean;
    running: boolean;
    pulling: boolean;
    pushing: boolean;
    pending: number;
    lastSyncAt: string | null;
    lastError: string | null;
    authError: boolean;
    phase: SyncPhase;
    currentTable: string;
    currentOperation: string;
    progress: number;
    total: number;
};

const IMAGE_QUEUE_KEY = "kataleya:sync:imageQueue";
const TAG = "[sync]";
const PUSH_DEBOUNCE_MS = 400;

// Normalise un chemin (absolu ou non) vers son basename. Le serveur (R2)
// indexe par basename, et la base locale finit aussi par stocker les
// basenames une fois la sync passée.
function imageBasename(name: string): string {
    const m = String(name).split(/[\\/]/);
    return m[m.length - 1] || "";
}

// Image queue (upload/download). Séparée de la queue principale pour ne pas
// bloquer la sync des données quand R2 hoquette, et inversement.
type ImageTaskKind = "upload" | "download";
type ImageTask = {
    id: string;
    kind: ImageTaskKind;
    filename: string; // basename uniquement
    retry: number;
    queuedAt: string;
};

// Mapping table → window.db.<entity> (les noms côté renderer sont camelCase)
const TABLE_TO_DB: Record<SyncableTable, keyof Window["db"]> = {
    administrateurs: "administrateurs",
    clients: "clients",
    collections: "collections",
    sous_collections: "sousCollections",
    articles: "articles",
    devis: "devis",
    factures: "factures",
    lignes_documents: "lignesDocuments",
    techniciens: "techniciens",
    projets: "projets",
    taches_projet: "tachesProjet",
    boutiques: "boutiques",
    stocks_boutique: "stocksBoutique",
    transferts_stock: "transfertsStock",
    entreprises: "entreprises",
};

// Champs stockés en JSON string côté D1 (colonnes TEXT) mais manipulés comme
// tableaux côté renderer. Au pull, le serveur renvoie la string brute :
// on la reparse avant d'écrire en base locale, sinon les .includes()/.map()
// du front cassent silencieusement.
const JSON_FIELDS: Partial<Record<SyncableTable, string[]>> = {
    taches_projet: ["technicienIds"],
    projets: ["technicienIds", "devisIds"],
};

function parseJsonFields(table: SyncableTable, row: any): any {
    const fields = JSON_FIELDS[table];
    if (!fields || !row || typeof row !== "object") return row;
    const out = { ...row };
    for (const field of fields) {
        const v = out[field];
        if (typeof v === "string") {
            try {
                out[field] = JSON.parse(v);
            } catch {
                /* on laisse la valeur telle quelle */
            }
        }
    }
    return out;
}

export class SyncClient {
    private timer: number | null = null;
    private ws: WebSocket | null = null;
    private wsReconnectTimer: number | null = null;
    private debounceTimer: number | null = null;
    private pendingSync: Promise<void> | null = null;
    // Dernier `maxVersion` observé côté serveur lors d'un pull — utilisé pour
    // la validation post-bootstrap (Phase 5.2).
    private lastServerMaxVersion = 0;
    // Garde-fou : on ne logge la validation qu'une seule fois par session.
    private bootstrapValidated = false;
    /** true dès que le bootstrap initial est terminé ou non-nécessaire (données déjà présentes) */
    private _initialSyncDone = false;
    get initialSyncDone(): boolean {
        return this._initialSyncDone;
    }
    private status: SyncStatus = {
        online: typeof navigator !== "undefined" ? navigator.onLine : true,
        enabled: false,
        running: false,
        pulling: false,
        pushing: false,
        pending: 0,
        lastSyncAt: null,
        lastError: null,
        authError: false,
        phase: 'idle',
        currentTable: '',
        currentOperation: '',
        progress: 0,
        total: 0,
    };
    private listeners = new Set<(s: SyncStatus) => void>();

    constructor() {
        if (typeof window !== "undefined") {
            window.addEventListener("online", () => {
                this.status.online = true;
                this.emit();
                void this.synchronize();
            });
            window.addEventListener("offline", () => {
                this.status.online = false;
                this.emit();
            });
        }
    }

    subscribe(fn: (s: SyncStatus) => void): () => void {
        this.listeners.add(fn);
        fn(this.getStatus());
        return () => this.listeners.delete(fn);
    }

    getStatus(): SyncStatus {
        return { ...this.status };
    }

    private emit() {
        const s = this.getStatus();
        this.listeners.forEach((fn) => fn(s));
    }

    // Compteur `pending` rafraîchi depuis sync_state local (dirty=1).
    private async refreshPending(): Promise<number> {
        try {
            const dirty = await window.syncApi.syncState.getDirty();
            this.status.pending = dirty.length;
            this.emit();
            return dirty.length;
        } catch {
            return this.status.pending;
        }
    }

    async start(intervalMs = 60000) {
        const cfg = await window.syncApi.getConfig();
        if (!cfg.enabled || !cfg.serverUrl || !cfg.token) {
            this.status.enabled = false;
            this.emit();
            return;
        }
        this.status.enabled = true;
        this.status.authError = false;
        this.emit();
        await this.synchronize();
        this.openWS();
        this.stopTimer();
        this.timer = window.setInterval(() => {
            void this.synchronize();
        }, intervalMs);
    }

    stop() {
        this.stopTimer();
        if (this.wsReconnectTimer !== null) {
            window.clearTimeout(this.wsReconnectTimer);
            this.wsReconnectTimer = null;
        }
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.status.enabled = false;
        this.emit();
    }

    private stopTimer() {
        if (this.timer !== null) {
            window.clearInterval(this.timer);
            this.timer = null;
        }
    }

    private setPhase(phase: SyncPhase, currentOperation = '', currentTable = '', progress = 0, total = 0) {
        this.status.phase = phase;
        this.status.currentOperation = currentOperation;
        this.status.currentTable = currentTable;
        this.status.progress = progress;
        this.status.total = total;
        this.emit();
    }

    async synchronize() {
        if (this.status.running || !this.status.online || !this.status.enabled) {
            console.info(`${TAG} synchronize() skip`, {
                running: this.status.running,
                online: this.status.online,
                enabled: this.status.enabled,
            });
            return;
        }
        console.info(`${TAG} synchronize() start`);
        this.status.running = true;
        this.status.lastError = null;
        this.setPhase('idle', 'Synchronisation…', '', 0, 0);
        try {
            this.status.pulling = true;
            this.setPhase('pull', 'Récupération des données serveur…', '', 0, 0);
            this.emit();
            await this.pullRemoteChanges();
            this.status.pulling = false;
            this.setPhase('idle', '', '', 0, 0);
            this.emit();

            this.status.pushing = true;
            this.setPhase('push', 'Mise à jour du serveur…', '', 0, 0);
            this.emit();
            await this.pushDirty();
            this.status.pushing = false;
            this.setPhase('idle', '', '', 0, 0);
            this.emit();

            // Transfert binaire (R2) — séparé de la queue principale, ne bloque
            // pas le marquage lastSyncAt si une image échoue.
            this.setPhase('images', 'Synchronisation des images…', '', 0, 0);
            await this.processImageQueue();
            this.setPhase('idle', '', '', 0, 0);

            const wasFirstSync = this.status.lastSyncAt === null;
            const cfg = await window.syncApi.markLastSync();
            this.status.lastSyncAt = cfg.lastSyncAt;
            console.info(`${TAG} synchronize() done`, { lastSyncAt: cfg.lastSyncAt });
            if (wasFirstSync && !this.bootstrapValidated) {
                await this.validateBootstrap();
            }
        } catch (e) {
            this.status.lastError = e instanceof Error ? e.message : String(e);
            console.error(`${TAG} synchronize() error`, e);
        } finally {
            this.status.pulling = false;
            this.status.pushing = false;
            this.status.running = false;
            this.setPhase('idle', '', '', 0, 0);
        }
    }

    // Demande de sync debouncée : pull puis push. Appelée après chaque mutation
    // locale pour garantir « pull avant push » sans submerger le serveur en cas
    // de rafale (édition multi-lignes, import batch, etc.). Coalesce les appels
    // en attente : si une sync est déjà programmée, on retourne sa promesse.
    requestSync(): Promise<void> {
        if (this.pendingSync) return this.pendingSync;
        this.pendingSync = new Promise<void>((resolve) => {
            if (this.debounceTimer !== null) window.clearTimeout(this.debounceTimer);
            this.debounceTimer = window.setTimeout(async () => {
                this.debounceTimer = null;
                try {
                    await this.pullThenPush();
                } finally {
                    this.pendingSync = null;
                    resolve();
                }
            }, PUSH_DEBOUNCE_MS);
        });
        return this.pendingSync;
    }

    private async pullThenPush() {
        if (this.status.running || !this.status.online || !this.status.enabled) {
            console.info(`${TAG} pullThenPush() skip`, {
                running: this.status.running,
                online: this.status.online,
                enabled: this.status.enabled,
            });
            return;
        }
        console.info(`${TAG} pullThenPush() start`);
        this.status.running = true;
        this.status.lastError = null;
        this.emit();
        try {
            this.status.pulling = true;
            this.emit();
            await this.pullRemoteChanges();
            this.status.pulling = false;
            this.emit();

            this.status.pushing = true;
            this.emit();
            await this.pushDirty();
            this.status.pushing = false;
            this.emit();

            await this.processImageQueue();
        } catch (e) {
            this.status.lastError = e instanceof Error ? e.message : String(e);
            console.error(`${TAG} pullThenPush() error`, e);
        } finally {
            this.status.pulling = false;
            this.status.pushing = false;
            this.status.running = false;
            this.emit();
        }
    }

    // Compat : ancien nom. Délègue maintenant à requestSync() pour garantir le
    // pull avant le push (chaque mutation locale déclenche une réconciliation
    // complète debouncée).
    async pushNow() {
        await this.requestSync();
    }

    // Phase 4.2 — Bootstrap initial : si le miroir local sync_state est vide
    // (jamais sync), on tire un snapshot complet du serveur via /sync-state/full
    // par table. Plus de restriction par rôle : le serveur arbitre, le rôle ne
    // sert plus de gate de bootstrap.
    //
    // Flux amélioré :
    //   1. Récupère la taille totale de chaque table via /admin/status
    //   2. Calcule le total général pour la barre de progression
    //   3. Pull chaque table par pages de 500, sans limite d'itérations
    //   4. Affiche la progression par table : "Table X : téléchargement N/M éléments"
    async bootstrapIfEmpty(_role?: string | null | undefined) {
        const TAG = "[sync:bootstrap]";
        if (!this.status.enabled) {
            console.warn(`${TAG} skip — sync désactivée (config serveur manquante ?)`);
            return;
        }
        if (!this.status.online) {
            console.warn(`${TAG} skip — hors-ligne`);
            return;
        }

        const empty = await window.syncApi.syncState.isEmpty();
        if (!empty) {
            console.info(`${TAG} miroir local non vide → pas de bootstrap`);
            this._initialSyncDone = true;
            return;
        }

        const tables = await window.syncApi.syncableTables();
        console.info(`${TAG} démarrage bootstrap — ${tables.length} tables`);

        // Récupération des tailles totales par table depuis le serveur
        let serverCounts: Record<string, number> = {};
        try {
            const res = await this.authedFetch("/admin/status", { method: "GET" });
            if (res.ok) {
                const data = (await res.json()) as { counts: Record<string, number> };
                serverCounts = data.counts || {};
            }
        } catch (e) {
            console.warn(`${TAG} impossible de récupérer les compteurs serveur`, e);
        }

        // Calcul du total général
        let grandTotal = 0;
        for (const table of tables) {
            grandTotal += serverCounts[table] ?? 0;
        }
        if (grandTotal === 0) grandTotal = 1;

        this.status.running = true;
        this.setPhase('bootstrap', 'Récupération initiale des données…', '', 0, grandTotal);

        let totalApplied = 0;
        let totalFailed = 0;
        let pulledCount = 0;
        const MAX_VERIFY_ATTEMPTS = 5;

        for (const table of tables) {
            const tableLabel = table.replace(/_/g, ' ');
            const initialTableTotal = serverCounts[table] ?? 0;

            this.setPhase(
                'bootstrap',
                initialTableTotal > 0
                    ? `Téléchargement ${tableLabel} (0/${initialTableTotal})`
                    : `Téléchargement ${tableLabel}…`,
                table,
                pulledCount,
                grandTotal,
            );

            const allItems: Array<{
                id: string;
                version: number;
                updatedAt: string;
                updatedBy: string;
                deleted: boolean;
                data: Record<string, unknown> | null;
            }> = [];
            let sinceVersion = 0;
            let sinceId = '';
            let pageCount = 0;
            let tablePullCount = 0;
            let pullFailed = false;
            let verifyAttempts = 0;
            let currentTableTotal = initialTableTotal;

            while (true) {
                pageCount++;
                const res = await this.authedFetch(
                    `/sync-state/full?table=${encodeURIComponent(table)}&sinceVersion=${sinceVersion}&sinceId=${encodeURIComponent(sinceId)}&limit=500`,
                    { method: "GET" },
                );
                if (!res.ok) {
                    console.error(`${TAG} GET /sync-state/full ${table} HTTP ${res.status}`);
                    pullFailed = true;
                    break;
                }
                const data = (await res.json()) as {
                    table: string;
                    items: Array<{
                        id: string;
                        version: number;
                        updatedAt: string;
                        updatedBy: string;
                        deleted: boolean;
                        data: Record<string, unknown> | null;
                    }>;
                    maxVersion: number;
                    maxId?: string;
                    hasMore: boolean;
                    serverTime: string;
                };
                if (data.items.length === 0) break;

                for (const item of data.items) {
                    allItems.push({
                        ...item,
                        data: item.data ? parseJsonFields(table as SyncableTable, item.data) : null,
                    });
                }
                tablePullCount += data.items.length;
                pulledCount += data.items.length;
                sinceVersion = data.maxVersion;
                sinceId = data.maxId || '';

                // Mise à jour progression : items réellement téléchargés / total attendu
                const displayTotal = Math.max(currentTableTotal, tablePullCount);
                this.setPhase(
                    'bootstrap',
                    currentTableTotal > 0
                        ? `Téléchargement ${tableLabel} (${Math.min(tablePullCount, displayTotal)}/${displayTotal})`
                        : `Téléchargement ${tableLabel} (${tablePullCount})`,
                    table,
                    pulledCount,
                    grandTotal,
                );

                console.info(
                    `${TAG} ${table} → page ${pageCount}, ${data.items.length} row(s), total ${tablePullCount}, cursor=(${sinceVersion},${sinceId}), hasMore=${data.hasMore}`,
                );

                if (data.hasMore) {
                    if (pageCount > 100_000) {
                        console.error(`${TAG} ${table} — dépassé 100 000 pages, arrêt`);
                        pullFailed = true;
                        break;
                    }
                    continue;
                }

                // ── Vérification de complétude ──────────────────────────
                // hasMore = false : le serveur n'a plus d'items à renvoyer
                // pour ce curseur. On vérifie auprès de /admin/status que
                // le compte total correspond bien à ce qu'on a téléchargé.
                // Si le serveur a reçu de nouvelles données entre-temps,
                // on reprend le pull depuis le dernier curseur connu.
                if (currentTableTotal > 0 && tablePullCount >= currentTableTotal) break;
                if (verifyAttempts >= MAX_VERIFY_ATTEMPTS) {
                    console.warn(`${TAG} ${table} — vérification échouée après ${MAX_VERIFY_ATTEMPTS} tentatives, on continue`);
                    break;
                }

                verifyAttempts++;
                console.info(`${TAG} ${table} — vérification (tentative ${verifyAttempts}/${MAX_VERIFY_ATTEMPTS}) : ${tablePullCount} téléchargés, ${currentTableTotal} attendus`);
                try {
                    const res = await this.authedFetch("/admin/status", { method: "GET" });
                    if (res.ok) {
                        const data = (await res.json()) as { counts: Record<string, number> };
                        currentTableTotal = data.counts?.[table] ?? 0;
                        if (tablePullCount >= currentTableTotal) break; // complet
                        console.info(`${TAG} ${table} — nouveaux items détectés (${currentTableTotal}), reprise du pull`);
                    }
                } catch {
                    break; // pas de vérification → on accepte ce qu'on a
                }
                // continue la boucle → prochaine page
            }

            if (pullFailed) {
                console.warn(`${TAG} bootstrap pull ${table} échoué — données locales conservées`);
                continue;
            }

            // Suppression des données locales seedées
            try {
                const dbKey = (TABLE_TO_DB as Record<string, string>)[table];
                const dbApi = (window.db as any)?.[dbKey];
                if (dbApi?.getAll && dbApi?.delete) {
                    const localRows: any[] = await dbApi.getAll();
                    for (const row of localRows) {
                        await dbApi.delete(row.id);
                    }
                }
            } catch (e) {
                console.warn(`${TAG} clear ${table} échec`, e);
            }

            // Application batch
            const liveItems = allItems.filter((i) => !i.deleted && i.data);
            const deletedItems = allItems.filter((i) => i.deleted);
            const batchEntries: Array<{
                table: string;
                id: string;
                version: number;
                deleted?: boolean;
                data?: Record<string, unknown> | null;
            }> = [
                ...liveItems.map((i) => ({
                    table,
                    id: i.id,
                    version: i.version,
                    data: i.data,
                })),
                ...deletedItems.map((i) => ({
                    table,
                    id: i.id,
                    version: i.version,
                    deleted: true,
                })),
            ];
            const batchResult = await window.syncApi.applyRemoteBatch(batchEntries);
            totalApplied += batchResult.ok;
            totalFailed += batchResult.failed;

            // Images articles
            for (const item of liveItems) {
                if (table === "articles") {
                    const raw = (item.data as any)?.images;
                    let arr: string[] = [];
                    try {
                        arr = typeof raw === "string" ? JSON.parse(raw) : Array.isArray(raw) ? raw : [];
                    } catch { arr = []; }
                    for (const f of arr) {
                        const name = imageBasename(f);
                        if (name) this.enqueueImage("download", name);
                    }
                }
            }
        }

        console.info(`${TAG} bootstrap terminé`, {
            applied: totalApplied,
            failed: totalFailed,
        });
        this.status.running = false;
        this.setPhase('images', 'Synchronisation des images…', '', 0, 0);
        await this.processImageQueue().catch((e) =>
            console.warn(`${TAG} processImageQueue post-bootstrap échec`, e),
        );
        this.setPhase('idle', '', '', 0, 0);
        this._initialSyncDone = true;
    }

    private async authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
        const cfg = await window.syncApi.getConfig();
        if (!cfg.token) {
            throw new Error("token vide");
        }
        const url = `${cfg.serverUrl.replace(/\/$/, "")}${path}`;
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${cfg.token}`,
            "X-Client-ID": cfg.clientId,
            ...(init.headers as Record<string, string> | undefined),
        };
        const res = await fetch(url, { ...init, headers });
        if (res.status === 401) {
            this.status.lastError = "Token expiré — veuillez vous reconnecter";
            this.status.authError = true;
            this.status.enabled = false;
            this.emit();
            this.stop();
            throw new Error("token invalide");
        }
        return res;
    }

    // ─── Image queue ────────────────────────────────────────────────
    private readImageQueue(): ImageTask[] {
        try {
            const raw = localStorage.getItem(IMAGE_QUEUE_KEY);
            return raw ? (JSON.parse(raw) as ImageTask[]) : [];
        } catch {
            return [];
        }
    }

    private writeImageQueue(q: ImageTask[]) {
        localStorage.setItem(IMAGE_QUEUE_KEY, JSON.stringify(q));
    }

    enqueueImage(kind: ImageTaskKind, filename: string) {
        const name = imageBasename(filename);
        if (!name) return;
        const q = this.readImageQueue();
        // Déduplication : si une tâche identique attend déjà, inutile d'en
        // ajouter une seconde (l'image est par essence idempotente).
        if (q.some((t) => t.kind === kind && t.filename === name)) return;
        q.push({
            id: `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
            kind,
            filename: name,
            retry: 0,
            queuedAt: new Date().toISOString(),
        });
        this.writeImageQueue(q);
    }

    private async processImageQueue() {
        if (!this.status.online || !this.status.enabled) return;
        const q = this.readImageQueue();
        if (q.length === 0) return;
        const remaining: ImageTask[] = [];
        for (const task of q) {
            try {
                if (task.kind === "upload") await this.uploadImage(task.filename);
                else await this.downloadImage(task.filename);
            } catch (e) {
                task.retry += 1;
                if (task.retry < 5) remaining.push(task);
                else console.error("[sync:image] abandon après 5 essais", task, e);
            }
        }
        this.writeImageQueue(remaining);
    }

    private async uploadImage(filename: string) {
        const name = imageBasename(filename);
        const imgApi = (window.db as any)?.images;
        if (!imgApi?.readBinary) throw new Error("images.readBinary indisponible");
        const bytes: Uint8Array | null = await imgApi.readBinary(name);
        if (!bytes) {
            console.warn(`[sync:image] upload ${name} ignoré (fichier absent en local)`);
            return;
        }
        // ArrayBufferLike → ArrayBuffer (BodyInit accepte ArrayBuffer).
        const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        const res = await this.authedFetch(`/images/${encodeURIComponent(name)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/octet-stream" },
            body: buf as ArrayBuffer,
        });
        if (!res.ok) throw new Error(`upload image HTTP ${res.status}`);
    }

    private async downloadImage(filename: string) {
        const name = imageBasename(filename);
        const imgApi = (window.db as any)?.images;
        if (!imgApi?.saveBinary) throw new Error("images.saveBinary indisponible");
        // Skip si déjà présent localement (idempotence + économie de bande).
        const present: boolean = await imgApi.exists?.(name).catch(() => false);
        if (present) return;
        const res = await this.authedFetch(`/images/${encodeURIComponent(name)}`, {
            method: "GET",
        });
        if (res.status === 404) {
            console.warn(`[sync:image] download ${name} ignoré (404 serveur)`);
            return;
        }
        if (!res.ok) throw new Error(`download image HTTP ${res.status}`);
        const buf = await res.arrayBuffer();
        await imgApi.saveBinary(new Uint8Array(buf), name);
    }

    // Phase 4.1 — pull via /sync-state (table = état actuel par ligne).
    // Boucle :
    //   1. since = maxVersion local (lue dans le miroir sync_state local).
    //   2. GET /sync-state?since=…  → inventaire [{table,id,version,deleted}].
    //   3. Pour chaque entrée : si deleted, applyRemote tombstone ; sinon
    //      GET /api/sync/:table/:id puis applyRemote avec la row canonique.
    //   4. Si hasMore → on relance avec le nouveau since (= maxVersion renvoyé).
    // Toutes les écritures passent par window.syncApi.applyRemote (fromSync=true
    // implicite : le dispatcher main bypass les wrappers métier → pas de
    // markDirty → pas de boucle pull→push).
    // Phase 5.2 — Validation post-bootstrap.
    // Après le premier sync complet, on compare le high-water mark local
    // (`syncState.maxVersion`) à celui observé sur le serveur lors du pull.
    // Une divergence > 10 % signale qu'il manque (encore) des lignes côté
    // poste — utile pour repérer un seed Phase 5.1 incomplet, un pull tronqué,
    // ou un serveur multi-tenant qui filtre. Cet appel est best-effort : il ne
    // doit jamais bloquer le sync, donc on swallow toutes les erreurs.
    private async validateBootstrap() {
        this.bootstrapValidated = true;
        try {
            const localMax = await window.syncApi.syncState.maxVersion();
            const dirty = (await window.syncApi.syncState.getDirty()).length;
            const serverMax = this.lastServerMaxVersion;
            const drift = serverMax > 0 ? Math.abs(serverMax - localMax) / serverMax : 0;
            console.info(`${TAG} bootstrap done`, {
                localMaxVersion: localMax,
                serverMaxVersion: serverMax,
                dirtyRemaining: dirty,
            });
            if (drift > 0.1) {
                console.warn(
                    `${TAG} bootstrap drift > 10 % (local=${localMax}, server=${serverMax}) — vérifier la couverture du pull`,
                );
            }
        } catch (e) {
            console.warn(`${TAG} validateBootstrap échec`, e);
        }
    }

    private async pullRemoteChanges() {
        let iterations = 0;
        const MAX_ITER = 50;

        // Curseur tuple (version, table_name, element_id) pour éviter
        // les trous de pagination quand plusieurs items ont la même version.
        // Première itération : depuis le maxVersion local. Itérations suivantes :
        // depuis le curseur renvoyé par le serveur.
        let sinceVersion = await window.syncApi.syncState.maxVersion();
        let sinceTable = '';
        let sinceId = '';

        while (iterations++ < MAX_ITER) {
            const res = await this.authedFetch(
                `/sync-state?sinceVersion=${sinceVersion}&sinceTable=${encodeURIComponent(sinceTable)}&sinceId=${encodeURIComponent(sinceId)}&limit=1000`,
                { method: "GET" },
            );
            if (!res.ok) {
                const body = await res.text().catch(() => "");
                console.error(`${TAG} pull HTTP ${res.status}`, body);
                throw new Error(`pull HTTP ${res.status}`);
            }
            const data = (await res.json()) as {
                items: Array<{
                    table: string;
                    id: string;
                    version: number;
                    updatedAt: string;
                    updatedBy: string;
                    deleted: boolean;
                }>;
                maxVersion: number;
                maxTable?: string;
                maxId?: string;
                hasMore: boolean;
                serverTime: string;
            };
            console.info(
                `${TAG} pull GET /sync-state cursor=(${sinceVersion},${sinceTable},${sinceId}) → ${data.items.length} entrée(s)`,
                { hasMore: data.hasMore, nextCursor: `(${data.maxVersion},${data.maxTable},${data.maxId})` },
            );
            if (data.maxVersion > this.lastServerMaxVersion) {
                this.lastServerMaxVersion = data.maxVersion;
            }
            if (data.items.length === 0) break;

            // Mise à jour du curseur pour la page suivante
            sinceVersion = data.maxVersion;
            sinceTable = data.maxTable || '';
            sinceId = data.maxId || '';

            // Étape 1 : fetch les données pour les items non-deleted (en parallèle)
            const fetchTasks = data.items.map(async (entry) => {
                if (entry.deleted) {
                    return { entry, data: null };
                }
                const res = await this.authedFetch(
                    `/api/sync/${entry.table}/${entry.id}`,
                    { method: "GET" },
                );
                if (!res.ok) {
                    console.warn(`${TAG} fetch ${entry.table}/${entry.id} → HTTP ${res.status}`);
                    return { entry, data: null, fetchFailed: true };
                }
                const row = parseJsonFields(entry.table as SyncableTable, await res.json());
                return { entry, data: row };
            });
            const fetchResults = await Promise.all(fetchTasks);

            // Étape 2 : grouper par table et appliquer en batch
            const byTable = new Map<string, Array<{
                table: string;
                id: string;
                version: number;
                deleted?: boolean;
                data?: Record<string, unknown> | null;
            }>>();
            for (const r of fetchResults) {
                if (r.fetchFailed) continue;
                const list = byTable.get(r.entry.table) || [];
                list.push({
                    table: r.entry.table,
                    id: r.entry.id,
                    version: r.entry.version,
                    deleted: r.entry.deleted,
                    data: r.data,
                });
                byTable.set(r.entry.table, list);
            }

            for (const [table, entries] of byTable) {
                try {
                    const result = await window.syncApi.applyRemoteBatch(entries);
                    if (result.ok > 0) {
                        // Enqueue image downloads for articles
                        if (table === "articles") {
                            for (const e of entries) {
                                if (!e.deleted && e.data) {
                                    const raw = (e.data as any)?.images;
                                    let arr: string[] = [];
                                    try {
                                        arr = typeof raw === "string" ? JSON.parse(raw) : Array.isArray(raw) ? raw : [];
                                    } catch { arr = []; }
                                    for (const f of arr) {
                                        const name = imageBasename(f);
                                        if (name) this.enqueueImage("download", name);
                                    }
                                }
                            }
                        }
                    }
                    const tableLabel = table.replace(/_/g, ' ');
                    const total = data.items.length;
                    this.setPhase('pull', `Récupération ${tableLabel}…`, table, 0, total);
                } catch (e) {
                    console.warn(`${TAG} batch apply échec pour ${table}`, e);
                }
            }

            if (!data.hasMore) break;
        }
    }

    // Applique une entrée d'inventaire renvoyée par /sync-state.
    // Pour les non-deletes, fait un GET /api/sync/:table/:id pour récupérer la
    // row canonique puis upsert local via le dispatcher main (sans markDirty).
    private async applyRemoteInventoryEntry(entry: {
        table: string;
        id: string;
        version: number;
        deleted: boolean;
    }): Promise<void> {
        if (entry.deleted) {
            await window.syncApi.applyRemote({
                table: entry.table,
                id: entry.id,
                version: entry.version,
                deleted: true,
                data: null,
            });
            return;
        }
        const res = await this.authedFetch(
            `/api/sync/${entry.table}/${entry.id}`,
            { method: "GET" },
        );
        if (!res.ok) {
            console.warn(
                `${TAG} apply ${entry.table}/${entry.id} → GET HTTP ${res.status}`,
            );
            return;
        }
        const row = parseJsonFields(entry.table as SyncableTable, await res.json());
        await window.syncApi.applyRemote({
            table: entry.table,
            id: entry.id,
            version: entry.version,
            deleted: false,
            data: row,
        });
        // Articles : enquêue le download des images binaires depuis R2.
        if (entry.table === "articles") {
            const raw = (row as any)?.images;
            let arr: string[] = [];
            try {
                arr = typeof raw === "string" ? JSON.parse(raw) : Array.isArray(raw) ? raw : [];
            } catch { arr = []; }
            for (const f of arr) {
                const name = imageBasename(f);
                if (name) this.enqueueImage("download", name);
            }
            void this.processImageQueue().catch(() => undefined);
        }
    }

    // Phase 4.3 — push depuis le miroir local sync_state (dirty=1).
    // Pour chaque ligne dirty :
    //   1. Lire la donnée métier complète localement (readLocalRow).
    //   2. Si deleted=1 → DELETE /:table/:id (idempotent serveur).
    //      Sinon → PUT /:table/:id avec body = { ...row, _version, _updatedAt }.
    //   3. Réponse :
    //      - applied:"client" → markClean(table, id, currentVersion).
    //      - applied:"server" → upsert local via applyRemote + markClean,
    //        et émission `sync:server-overwrite` pour le toast UI.
    // Erreurs réseau → on laisse dirty=1, retry au prochain tick.
    private async pushDirty() {
        const dirty = await window.syncApi.syncState.getDirty();
        if (dirty.length === 0) {
            this.status.pending = 0;
            this.emit();
            return;
        }
        console.info(`${TAG} push → ${dirty.length} dirty row(s)`);
        let pushed = 0;
        let conflicts = 0;
        let failed = 0;
        const total = dirty.length;
        for (let i = 0; i < total; i++) {
            const row = dirty[i];
            const tableLabel = row.table_name.replace(/_/g, ' ');
            this.setPhase('push', `Envoi ${tableLabel}…`, row.table_name, i + 1, total);
            try {
                const outcome = await this.pushSingleDirty(row);
                if (outcome === "client") pushed++;
                else if (outcome === "server") {
                    conflicts++;
                    pushed++;
                }
            } catch (e) {
                failed++;
                console.warn(
                    `${TAG} push ${row.table_name}/${row.element_id} échec`,
                    e,
                );
            }
        }
        await this.refreshPending();
        console.info(`${TAG} push terminé`, { pushed, conflicts, failed });
    }

    // Renvoie "client" si la modif locale a été acceptée, "server" si elle a
    // été écrasée par la version canonique, ou jette en cas d'erreur réseau.
    private async pushSingleDirty(row: {
        table_name: string;
        element_id: string;
        version: number;
        deleted: number;
    }): Promise<"client" | "server"> {
        const table = row.table_name as SyncableTable;
        const id = row.element_id;

        // Ne jamais pusher la boutique "Stock principal" (isPrincipal=1) :
        // chaque poste a sa propre instance locale, elles ne doivent pas
        // remonter sur le serveur partagé.
        if (table === "boutiques") {
            const local = await this.readLocalRow(table, id);
            if (local && local.isPrincipal) {
                await window.syncApi.syncState.markClean(table, id, row.version);
                return "client";
            }
        }

        if (row.deleted === 1) {
            const res = await this.authedFetch(`/api/sync/${table}/${id}`, {
                method: "DELETE",
                body: JSON.stringify({ _version: row.version }),
            });
            if (!res.ok && res.status !== 404) {
                const body = await res.text().catch(() => "");
                throw new Error(`DELETE HTTP ${res.status} — ${body}`);
            }
            const data = await res.json().catch(() => ({}));
            const currentVersion =
                typeof (data as any)?.currentVersion === "number"
                    ? (data as any).currentVersion
                    : row.version + 1;
            await window.syncApi.syncState.markClean(table, id, currentVersion);
            return "client";
        }

        const fresh = await this.readLocalRow(table, id);
        if (!fresh) {
            console.warn(
                `${TAG} push ${table}/${id} ignoré (ligne absente en local)`,
            );
            await window.syncApi.syncState.markClean(table, id, row.version);
            return "client";
        }

        const normalized = this.normalizeImagesForSync(table, fresh);
        for (const name of this.extractImageNames(table, fresh)) {
            this.enqueueImage("upload", name);
        }
        const payload = {
            ...normalized,
            id,
            _version: row.version,
            _updatedAt: (fresh as any)?.updatedAt,
        };
        const res = await this.authedFetch(`/api/sync/${table}/${id}`, {
            method: "PUT",
            body: JSON.stringify(payload),
        });
        const rawText = await res.clone().text();
        let parsed: any = null;
        try { parsed = JSON.parse(rawText); } catch { /* keep null */ }
        if (!res.ok) {
            throw new Error(`PUT HTTP ${res.status} — ${rawText}`);
        }

        const applied = parsed?.applied;
        const currentVersion: number =
            typeof parsed?.currentVersion === "number"
                ? parsed.currentVersion
                : row.version + 1;

        if (applied === "server") {
            // Notre version a perdu l'arbitrage — on adopte la canonique.
            const canonical = parsed?.data
                ? parseJsonFields(table, parsed.data)
                : null;
            if (canonical) {
                await window.syncApi.applyRemote({
                    table,
                    id,
                    version: currentVersion,
                    deleted: false,
                    data: canonical,
                });
            } else {
                await window.syncApi.syncState.markClean(table, id, currentVersion);
            }
            if (typeof window !== "undefined") {
                window.dispatchEvent(
                    new CustomEvent("sync:server-overwrite", {
                        detail: { table, id, currentVersion },
                    }),
                );
            }
            console.warn(
                `${TAG} ${table}/${id} écrasé par le serveur (v${row.version} → v${currentVersion})`,
            );
            return "server";
        }

        await window.syncApi.syncState.markClean(table, id, currentVersion);
        return "client";
    }

    // Relit la ligne depuis la base locale juste avant l'envoi. Permet de
    // récupérer la version complète même si l'op a été queuée avec un patch
    // partiel. getById est parfois cassé selon les entités (ex: tachesProjet
    // renvoie un stub {technicienIds: []} au lieu de la ligne) → on valide le
    // résultat et on retombe sur getAll() + recherche par id si nécessaire.
    private async readLocalRow(table: SyncableTable, id: string): Promise<any | null> {
        const dbKey = TABLE_TO_DB[table];
        const dbApi = (window.db as any)?.[dbKey];
        if (!dbApi) return null;

        const isUsable = (row: any) =>
            row && typeof row === "object" && String(row.id ?? "") === id;

        try {
            if (dbApi.getById) {
                const row = await dbApi.getById(id);
                if (isUsable(row)) return row;
            }
        } catch {
            /* on tente le fallback */
        }
        try {
            if (dbApi.getAll) {
                const rows: any[] = await dbApi.getAll();
                const row = rows.find((r) => String(r?.id ?? "") === id);
                if (isUsable(row)) return row;
            }
        } catch {
            /* rien */
        }
        return null;
    }

    // Pour `articles`, on stocke localement `images` comme un JSON string de
    // chemins potentiellement absolus (legacy). Le serveur ne peut rien faire
    // de ces chemins — on les réécrit en basenames avant envoi pour que tous
    // les clients voient les mêmes noms et puissent télécharger depuis R2.
    private normalizeImagesForSync(table: SyncableTable, row: any): any {
        if (table !== "articles" || !row || typeof row !== "object") return row;
        const raw = row.images;
        if (raw == null) return row;
        let arr: unknown;
        try {
            arr = typeof raw === "string" ? JSON.parse(raw) : raw;
        } catch {
            return row;
        }
        if (!Array.isArray(arr)) return row;
        const basenames = arr.map((x) => imageBasename(String(x))).filter(Boolean);
        return { ...row, images: JSON.stringify(basenames) };
    }

    // Extrait les basenames d'image d'une ligne article pour les enquêuer en
    // upload après une mutation locale.
    private extractImageNames(table: SyncableTable, row: any): string[] {
        if (table !== "articles" || !row || typeof row !== "object") return [];
        const raw = row.images;
        if (raw == null) return [];
        try {
            const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
            if (!Array.isArray(arr)) return [];
            return arr.map((x) => imageBasename(String(x))).filter(Boolean);
        } catch {
            return [];
        }
    }

    private openWS() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        if (this.wsReconnectTimer !== null) {
            window.clearTimeout(this.wsReconnectTimer);
            this.wsReconnectTimer = null;
        }
        void window.syncApi.getConfig().then((cfg) => {
            if (!cfg.serverUrl || !cfg.token) return;
            const serverUrl = cfg.serverUrl.replace(/\/$/, "");
            const wsUrl = serverUrl.replace(/^http/, "ws");
            const url = `${wsUrl}/api/sync/ws?token=${encodeURIComponent(cfg.token)}`;
            const ws = new WebSocket(url);
            ws.onmessage = (ev) => {
                try {
                    const data = JSON.parse(ev.data);
                    if (data?.type === "heartbeat") return;
                    if (data?.type === "journal_update") {
                        void this.requestSync();
                    }
                } catch {
                    /* ignore */
                }
            };
            ws.onclose = () => {
                this.ws = null;
                if (this.status.enabled) {
                    this.wsReconnectTimer = window.setTimeout(
                        () => this.openWS(),
                        3000,
                    );
                }
            };
            ws.onerror = () => {
                ws.close();
            };
            ws.onopen = () => {
                console.info(`${TAG} WebSocket connecté`);
            };
            this.ws = ws;
        });
    }
}

export const syncClient = new SyncClient();

// Expose pour debug DevTools : window.syncClient.bootstrapIfEmpty('super_admin')
if (typeof window !== "undefined") {
    (window as any).syncClient = syncClient;
}
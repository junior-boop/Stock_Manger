// SyncClient — orchestrateur de synchronisation côté renderer
// Utilise window.syncApi (config) + fetch direct vers le serveur Workers.
// File d'attente locale persistée en localStorage pour les opérations sortantes.

export type SyncOperation = "create" | "update" | "delete";

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
    | "taches_projet";

type QueueEntry = {
    id: string;
    operation: SyncOperation;
    table: SyncableTable;
    elementId: string;
    data: Record<string, unknown> | null;
    retry: number;
    queuedAt: string;
};

type ServerJournalEntry = {
    id: string;
    operation: SyncOperation;
    id_element: string;
    table_name: SyncableTable;
    timestamp: string;
};

export type SyncStatus = {
    online: boolean;
    enabled: boolean;
    running: boolean;
    pulling: boolean;
    pushing: boolean;
    pending: number;
    lastSyncAt: string | null;
    lastError: string | null;
};

const QUEUE_KEY = "kataleya:sync:queue";
const LAST_TS_KEY = "kataleya:sync:lastPullTs";

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
};

export class SyncClient {
    private timer: number | null = null;
    private sse: EventSource | null = null;
    private status: SyncStatus = {
        online: typeof navigator !== "undefined" ? navigator.onLine : true,
        enabled: false,
        running: false,
        pulling: false,
        pushing: false,
        pending: 0,
        lastSyncAt: null,
        lastError: null,
    };
    private listeners = new Set<(s: SyncStatus) => void>();

    constructor() {
        this.status.pending = this.readQueue().length;
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

    private readQueue(): QueueEntry[] {
        try {
            const raw = localStorage.getItem(QUEUE_KEY);
            return raw ? (JSON.parse(raw) as QueueEntry[]) : [];
        } catch {
            return [];
        }
    }

    private writeQueue(q: QueueEntry[]) {
        localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
        this.status.pending = q.length;
        this.emit();
    }

    enqueue(
        operation: SyncOperation,
        table: SyncableTable,
        elementId: string,
        data: Record<string, unknown> | null,
    ) {
        const q = this.readQueue();
        q.push({
            id: `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
            operation,
            table,
            elementId,
            data,
            retry: 0,
            queuedAt: new Date().toISOString(),
        });
        this.writeQueue(q);
    }

    async start(intervalMs = 60000) {
        const cfg = await window.syncApi.getConfig();
        if (!cfg.enabled || !cfg.serverUrl || !cfg.token) {
            this.status.enabled = false;
            this.emit();
            return;
        }
        this.status.enabled = true;
        this.emit();
        await this.synchronize();
        this.openSSE();
        this.stopTimer();
        this.timer = window.setInterval(() => {
            void this.synchronize();
        }, intervalMs);
    }

    stop() {
        this.stopTimer();
        if (this.sse) {
            this.sse.close();
            this.sse = null;
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

    async synchronize() {
        if (this.status.running || !this.status.online || !this.status.enabled) return;
        this.status.running = true;
        this.status.lastError = null;
        this.emit();
        try {
            this.status.pulling = true;
            this.emit();
            await this.pullRemoteChanges();
            this.status.pulling = false;
            this.emit();

            if (this.readQueue().length > 0) {
                this.status.pushing = true;
                this.emit();
                await this.pushPendingOperations();
                this.status.pushing = false;
                this.emit();
            }

            const cfg = await window.syncApi.markLastSync();
            this.status.lastSyncAt = cfg.lastSyncAt;
        } catch (e) {
            this.status.lastError = e instanceof Error ? e.message : String(e);
        } finally {
            this.status.pulling = false;
            this.status.pushing = false;
            this.status.running = false;
            this.emit();
        }
    }

    // Push immédiat déclenché après une mutation locale. Ne fait pas de pull
    // (déjà couvert par SSE + tick périodique). Si offline/désactivé, la queue
    // reste en localStorage et sera vidée au prochain synchronize().
    async pushNow() {
        if (this.status.running || !this.status.online || !this.status.enabled) return;
        if (this.readQueue().length === 0) return;
        this.status.running = true;
        this.status.pushing = true;
        this.emit();
        try {
            await this.pushPendingOperations();
        } catch (e) {
            this.status.lastError = e instanceof Error ? e.message : String(e);
        } finally {
            this.status.pushing = false;
            this.status.running = false;
            this.emit();
        }
    }

    // Bootstrap : si le serveur est vide et que l'utilisateur courant a le rôle
    // requis (admin/super_admin), on pousse toutes les données locales pour
    // amorcer la base distante. Idempotent côté serveur (upsert) — sans danger
    // si appelé plusieurs fois, mais coûteux : à n'appeler qu'au démarrage.
    async bootstrapIfEmpty(role: string | null | undefined) {
        const TAG = "[sync:bootstrap]";
        if (role !== "admin" && role !== "super_admin") {
            console.info(`${TAG} skip — rôle insuffisant (${role ?? "null"})`);
            return;
        }
        if (!this.status.enabled) {
            console.warn(`${TAG} skip — sync désactivée (config serveur manquante ?)`);
            return;
        }
        if (!this.status.online) {
            console.warn(`${TAG} skip — hors-ligne`);
            return;
        }

        let payload: { empty: boolean; counts: Record<string, number> };
        try {
            const res = await this.authedFetch("/admin/status", { method: "GET" });
            if (!res.ok) {
                console.error(`${TAG} GET /admin/status HTTP ${res.status}`);
                return;
            }
            payload = await res.json();
            console.info(`${TAG} statut serveur`, payload);
        } catch (e) {
            console.error(`${TAG} échec /admin/status`, e);
            return;
        }
        if (!payload.empty) {
            console.info(`${TAG} serveur non vide → pas de bootstrap`);
            return;
        }

        const tables = Object.keys(TABLE_TO_DB) as SyncableTable[];
        let enqueued = 0;
        for (const table of tables) {
            const dbKey = TABLE_TO_DB[table];
            const dbApi = (window.db as any)?.[dbKey];
            if (!dbApi?.getAll) {
                console.warn(`${TAG} ${table} → window.db.${dbKey}.getAll absent`);
                continue;
            }
            try {
                const rows: any[] = await dbApi.getAll();
                console.info(`${TAG} ${table} : ${rows.length} row(s) locale(s)`);
                for (const row of rows) {
                    if (!row?.id) continue;
                    this.enqueue("create", table, String(row.id), row);
                    enqueued++;
                }
            } catch (e) {
                console.error(`${TAG} ${table} lecture locale échouée`, e);
            }
        }
        console.info(`${TAG} ${enqueued} opération(s) enquêuée(s)`);
        if (enqueued > 0) await this.pushNow();
    }

    private async authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
        const cfg = await window.syncApi.getConfig();
        const url = `${cfg.serverUrl.replace(/\/$/, "")}${path}`;
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${cfg.token}`,
            "X-Client-ID": cfg.clientId,
            ...(init.headers as Record<string, string> | undefined),
        };
        return fetch(url, { ...init, headers });
    }

    private async pullRemoteChanges() {
        const since = localStorage.getItem(LAST_TS_KEY) || "";
        const res = await this.authedFetch(
            `/journal?since=${encodeURIComponent(since)}`,
            { method: "GET" },
        );
        if (!res.ok) throw new Error(`pull HTTP ${res.status}`);
        const data = (await res.json()) as {
            journal: ServerJournalEntry[];
            serverTime: string;
        };
        for (const entry of data.journal) {
            try {
                await this.applyRemoteEntry(entry);
                localStorage.setItem(LAST_TS_KEY, entry.timestamp);
            } catch (e) {
                console.warn("Échec application entrée distante", entry, e);
            }
        }
    }

    private async applyRemoteEntry(entry: ServerJournalEntry) {
        const dbKey = TABLE_TO_DB[entry.table_name];
        if (!dbKey) return;
        const dbApi = (window.db as any)[dbKey];
        if (!dbApi) return;

        if (entry.operation === "delete") {
            await dbApi.delete?.(entry.id_element);
            return;
        }
        const res = await this.authedFetch(
            `/api/sync/${entry.table_name}/${entry.id_element}`,
            { method: "GET" },
        );
        if (!res.ok) return;
        const element = await res.json();
        const existing = await dbApi.getById?.(entry.id_element).catch(() => null);
        if (existing) {
            await dbApi.update?.(entry.id_element, element);
        } else {
            await dbApi.create?.(element);
        }
    }

    private async pushPendingOperations() {
        const q = this.readQueue();
        if (q.length === 0) return;
        const remaining: QueueEntry[] = [];
        for (const op of q) {
            try {
                await this.pushSingleOp(op);
            } catch (e) {
                op.retry += 1;
                if (op.retry < 5) remaining.push(op);
                else console.error("Op abandonnée après 5 essais", op, e);
            }
        }
        this.writeQueue(remaining);
    }

    // Relit la ligne depuis la base locale juste avant l'envoi. Permet de
    // récupérer la version complète même si l'op a été queuée avec un patch
    // partiel (cas des entrées créées AVANT le wrapper "refetch full row" de
    // db_sync.ts, ou si la queue a été restaurée depuis localStorage).
    private async readLocalRow(table: SyncableTable, id: string): Promise<any | null> {
        try {
            const dbKey = TABLE_TO_DB[table];
            const dbApi = (window.db as any)?.[dbKey];
            if (!dbApi?.getById) return null;
            const row = await dbApi.getById(id);
            return row && typeof row === "object" ? row : null;
        } catch {
            return null;
        }
    }

    private async pushSingleOp(op: QueueEntry) {
        let res: Response;
        if (op.operation === "create") {
            const fresh = await this.readLocalRow(op.table, op.elementId);
            const payload = fresh ?? { id: op.elementId, ...(op.data ?? {}) };
            res = await this.authedFetch(`/${op.table}`, {
                method: "POST",
                body: JSON.stringify({ ...payload, id: op.elementId }),
            });
        } else if (op.operation === "update") {
            const fresh = await this.readLocalRow(op.table, op.elementId);
            if (!fresh) {
                // Ligne absente localement → on ne peut pas reconstruire la
                // ligne complète. Pousser un patch partiel ferait un
                // INSERT OR REPLACE côté serveur avec des NULL sur les
                // colonnes obligatoires. On drop l'op silencieusement.
                console.warn(`[sync] update ${op.table}/${op.elementId} ignoré (ligne absente en local)`);
                return;
            }
            res = await this.authedFetch(`/${op.table}/${op.elementId}`, {
                method: "PUT",
                body: JSON.stringify(fresh),
            });
        } else {
            res = await this.authedFetch(`/${op.table}/${op.elementId}`, {
                method: "DELETE",
            });
        }
        if (!res.ok) throw new Error(`push HTTP ${res.status}`);
    }

    private openSSE() {
        if (this.sse) {
            this.sse.close();
            this.sse = null;
        }
        void window.syncApi.getConfig().then((cfg) => {
            if (!cfg.serverUrl || !cfg.token) return;
            const url = `${cfg.serverUrl.replace(/\/$/, "")}/api/sync/events?clientId=${encodeURIComponent(cfg.clientId)}&token=${encodeURIComponent(cfg.token)}`;
            const es = new EventSource(url);
            es.onmessage = (ev) => {
                try {
                    const data = JSON.parse(ev.data);
                    if (data?.type === "journal_update" && data.entry) {
                        void this.applyRemoteEntry(data.entry).then(() => {
                            if (data.entry.timestamp) {
                                localStorage.setItem(LAST_TS_KEY, data.entry.timestamp);
                            }
                        });
                    }
                } catch {
                    /* ignore */
                }
            };
            es.onerror = () => {
                es.close();
                this.sse = null;
                // Reconnexion sera tentée au prochain tick
            };
            this.sse = es;
        });
    }
}

export const syncClient = new SyncClient();

// Expose pour debug DevTools : window.syncClient.bootstrapIfEmpty('super_admin')
if (typeof window !== "undefined") {
    (window as any).syncClient = syncClient;
}

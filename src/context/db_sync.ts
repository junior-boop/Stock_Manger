// Enveloppe statique autour de window.db : pour chaque mutation (create/update/
// delete) sur une table synchronisable, on déclenche une demande de sync
// debouncée. Le marquage dirty=1 est fait côté main process par les wrappers
// de Databases/index.ts (syncState.markDirty) — pas besoin de queue ici.
// En offline, sync_state local conserve dirty=1 jusqu'au prochain pushDirty().
//
// Note : on évite volontairement les Proxy autour de window.db car les objets
// exposés via contextBridge sont figés dans un monde isolé, et les Proxy
// peuvent perdre le bon `this` lors d'un .bind(). On préfère copier
// explicitement chaque méthode.

import { syncClient, type SyncableTable } from './sync_client';

const CAMEL_TO_SNAKE: Record<string, SyncableTable> = {
    administrateurs: 'administrateurs',
    clients: 'clients',
    collections: 'collections',
    sousCollections: 'sous_collections',
    articles: 'articles',
    devis: 'devis',
    factures: 'factures',
    lignesDocuments: 'lignes_documents',
    techniciens: 'techniciens',
    projets: 'projets',
    tachesProjet: 'taches_projet',
    boutiques: 'boutiques',
    stocksBoutique: 'stocks_boutique',
    transfertsStock: 'transferts_stock',
};

function triggerSync() {
    void syncClient.requestSync().catch(() => undefined);
}

function wrapEntity(entityKey: string, raw: any): any {
    if (!raw) return raw;
    const tableName = CAMEL_TO_SNAKE[entityKey];

    // Table non synchronisable (ex: images) → on renvoie l'API d'origine.
    if (!tableName) return raw;

    const wrapped: any = {};

    // Copie d'abord toutes les méthodes telles quelles (getAll, getById,
    // getByClientId, generateReference, etc.).
    for (const key in raw) {
        wrapped[key] = raw[key];
    }

    if (typeof raw.create === 'function') {
        wrapped.create = async (data: any) => {
            const result = await raw.create(data);
            triggerSync();
            return result;
        };
    }

    if (typeof raw.update === 'function') {
        wrapped.update = async (id: string, data: any) => {
            const result = await raw.update(id, data);
            triggerSync();
            return result;
        };
    }

    if (typeof raw.delete === 'function') {
        wrapped.delete = async (id: string) => {
            const result = await raw.delete(id);
            triggerSync();
            return result;
        };
    }

    // Méthodes custom non-CRUD qui mutent plusieurs tables d'un coup.
    if (entityKey === 'stocksBoutique' && typeof raw.adjust === 'function') {
        wrapped.adjust = async (
            boutiqueId: string,
            articleId: string,
            varianteId: string | undefined,
            delta: number,
        ) => {
            const entry = await raw.adjust(boutiqueId, articleId, varianteId, delta);
            triggerSync();
            return entry;
        };
    }

    if (entityKey === 'transfertsStock' && typeof raw.execute === 'function') {
        wrapped.execute = async (data: any) => {
            const result = await raw.execute(data);
            triggerSync();
            return result;
        };
    }

    return wrapped;
}

function buildDb(): Window['db'] {
    if (typeof window === 'undefined' || !window.db) {
        return {} as Window['db'];
    }
    const raw = window.db as any;
    const out: any = {};
    for (const key in raw) {
        out[key] = wrapEntity(key, raw[key]);
    }
    return out as Window['db'];
}

export const db = buildDb();

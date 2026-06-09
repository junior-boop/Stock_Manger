// Enveloppe statique autour de window.db : pour chaque mutation (create/update/
// delete) sur une table synchronisable, on enregistre l'opération dans la queue
// de syncClient puis on déclenche un push immédiat. En offline, la queue
// persiste dans localStorage et sera vidée au retour en ligne.
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
};

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
            const id = result?.id ?? data?.id;
            if (id) {
                syncClient.enqueue('create', tableName, String(id), result ?? data);
                void syncClient.pushNow().catch(() => undefined);
            }
            return result;
        };
    }

    if (typeof raw.update === 'function') {
        wrapped.update = async (id: string, data: any) => {
            const result = await raw.update(id, data);
            // On envoie la ligne COMPLÈTE au serveur (pas le diff). L'ORM ne
            // renvoie souvent que le patch ; on relit donc systématiquement
            // via getById pour avoir tous les champs (titre, etc.).
            let full: any = null;
            try { full = await raw.getById?.(id); } catch { full = null; }
            if (!full || typeof full !== 'object') full = { ...data, id };
            syncClient.enqueue('update', tableName, String(id), full);
            void syncClient.pushNow().catch(() => undefined);
            return result;
        };
    }

    if (typeof raw.delete === 'function') {
        wrapped.delete = async (id: string) => {
            const result = await raw.delete(id);
            syncClient.enqueue('delete', tableName, String(id), null);
            void syncClient.pushNow().catch(() => undefined);
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

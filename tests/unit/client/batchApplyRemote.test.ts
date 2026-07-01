// Tests pour batchApplyRemoteEntries — le point d'entrée du pull côté client
//
// Vérifie :
//   1. L'application correcte des upserts et tombstones
//   2. Le marquage syncState sans toucher à dirty
//   3. Le BUG #1 : pull écrase les données dirty locales
//   4. La proposition de correction

import { createMockOrm, type OrmLike } from '../../helpers/mock-orm';
import { createMemoryStore, type MemoryStore } from '../../helpers/client-db';

// Simule un modèle métier (Article, Client, etc.) avec un MemoryStore
function createMockModel(store: MemoryStore, tableName: string) {
  store.getOrCreateTable(tableName);

  return {
    delete(id: string) {
      store.deleteRow(tableName, id);
    },
    upsert(data: Record<string, unknown>) {
      const { id, ...rest } = data;
      const existing = store.getRow(tableName, id as string);
      store.setRow(tableName, id as string, { ...existing, ...rest, id });
    },
    batchUpsert(dataArray: Record<string, unknown>[]) {
      for (const d of dataArray) {
        this.upsert(d);
      }
    },
  };
}

// syncState (identique aux tests syncState, mais réimplémenté localement)
function createSyncState(orm: OrmLike) {
  return {
    get(table: string, id: string): any | null {
      return orm.query<any>(
        'SELECT * FROM sync_state WHERE table_name = ? AND element_id = ?',
        [table, id],
      )?.[0] ?? null;
    },
    markDirty(table: string, id: string): void {
      orm.run(
        `INSERT INTO sync_state (table_name, element_id, version, localVersion, dirty, deleted)
         VALUES (?, ?, 0, 1, 1, 0)
         ON CONFLICT DO UPDATE SET
           localVersion = sync_state.localVersion + 1, dirty = 1`,
        [table, id],
      );
    },
    applyRemote(entry: { table: string; id: string; version: number; deleted?: boolean }): void {
      const now = new Date().toISOString();
      const deleted = entry.deleted ? 1 : 0;
      orm.run(
        `INSERT INTO sync_state (table_name, element_id, version, deleted, lastPulledAt)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT DO UPDATE SET
           version = excluded.version, deleted = excluded.deleted, lastPulledAt = excluded.lastPulledAt`,
        [entry.table, entry.id, entry.version, deleted, now],
      );
    },
    batchApplyRemote(entries: Array<{ table: string; id: string; version: number; deleted?: boolean }>): void {
      for (const e of entries) this.applyRemote(e);
    },
  };
}

type RemoteSyncEntry = {
  table: string;
  id: string;
  version: number;
  deleted?: boolean;
  data?: Record<string, unknown> | null;
};

// Version ACTUELLE de batchApplyRemoteEntries (avec le bug)
function batchApplyRemoteEntries_CURRENT(
  entries: RemoteSyncEntry[],
  models: Record<string, ReturnType<typeof createMockModel>>,
  sync: ReturnType<typeof createSyncState>,
): { ok: number; failed: number } {
  let ok = 0;
  let failed = 0;

  const byTable = new Map<string, RemoteSyncEntry[]>();
  for (const e of entries) {
    const list = byTable.get(e.table) || [];
    list.push(e);
    byTable.set(e.table, list);
  }

  for (const [tableName, tableEntries] of byTable) {
    const model = models[tableName];
    if (!model) { failed += tableEntries.length; continue; }

    try {
      const deletes = tableEntries.filter((e) => e.deleted);
      const upserts = tableEntries.filter((e) => !e.deleted && e.data);

      for (const entry of deletes) {
        try { model.delete(entry.id); } catch { /* idempotent */ }
      }

      if (upserts.length > 0) {
        const payloads = upserts.map((e) => ({ ...e.data!, id: e.id }));
        model.batchUpsert(payloads);
      }

      sync.batchApplyRemote(tableEntries);
      ok += tableEntries.length;
    } catch {
      failed += tableEntries.length;
    }
  }

  return { ok, failed };
}

// Version CORRIGÉE : ne pas écraser les lignes dirty
function batchApplyRemoteEntries_FIXED(
  entries: RemoteSyncEntry[],
  models: Record<string, ReturnType<typeof createMockModel>>,
  sync: ReturnType<typeof createSyncState>,
): { ok: number; failed: number } {
  let ok = 0;
  let failed = 0;

  const byTable = new Map<string, RemoteSyncEntry[]>();
  for (const e of entries) {
    const list = byTable.get(e.table) || [];
    list.push(e);
    byTable.set(e.table, list);
  }

  for (const [tableName, tableEntries] of byTable) {
    const model = models[tableName];
    if (!model) { failed += tableEntries.length; continue; }

    try {
      const deletes = tableEntries.filter((e) => e.deleted);
      const upserts = tableEntries.filter((e) => !e.deleted && e.data);

      for (const entry of deletes) {
        try { model.delete(entry.id); } catch { /* idempotent */ }
      }

      // CORRECTION : ne pas écraser les lignes dirty localement
      const safeUpserts = upserts.filter((e) => {
        const local = sync.get(e.table, e.id);
        return !local || local.dirty !== 1;
      });

      if (safeUpserts.length > 0) {
        const payloads = safeUpserts.map((e) => ({ ...e.data!, id: e.id }));
        model.batchUpsert(payloads);
      }

      // Appliquer sync_state pour TOUS (même les skipped: met à jour version sans écraser data)
      sync.batchApplyRemote(tableEntries);
      ok += tableEntries.length;
    } catch {
      failed += tableEntries.length;
    }
  }

  return { ok, failed };
}

describe('batchApplyRemoteEntries — version ACTUELLE (avec bugs)', () => {
  let orm: OrmLike;
  let store: MemoryStore;
  let sync: ReturnType<typeof createSyncState>;
  let models: Record<string, ReturnType<typeof createMockModel>>;

  beforeEach(() => {
    orm = createMockOrm();
    store = createMemoryStore();
    sync = createSyncState(orm);
    models = { clients: createMockModel(store, 'clients') };
  });

  it('applique les upserts correctement', () => {
    const result = batchApplyRemoteEntries_CURRENT(
      [{ table: 'clients', id: 'c001', version: 1, data: { nom: 'Alice' } }],
      models,
      sync,
    );
    expect(result).toEqual({ ok: 1, failed: 0 });
    expect(store.getRow('clients', 'c001')?.nom).toBe('Alice');
    expect(sync.get('clients', 'c001')?.version).toBe(1);
  });

  it('applique les tombstones', () => {
    models.clients.upsert({ id: 'c001', nom: 'Bob' });
    sync.applyRemote({ table: 'clients', id: 'c001', version: 1 });

    const result = batchApplyRemoteEntries_CURRENT(
      [{ table: 'clients', id: 'c001', version: 2, deleted: true }],
      models,
      sync,
    );
    expect(result).toEqual({ ok: 1, failed: 0 });
    expect(sync.get('clients', 'c001')?.deleted).toBe(1);
  });

  it('BUG: écrase les données dirty localement lors du pull', () => {
    // 1. L'utilisateur modifie un client localement
    models.clients.upsert({ id: 'c001', nom: 'Édition locale' });
    sync.markDirty('clients', 'c001');

    // 2. Le pull arrive (même ligne, version serveur plus récente)
    const result = batchApplyRemoteEntries_CURRENT(
      [{ table: 'clients', id: 'c001', version: 5, data: { nom: 'Version serveur' } }],
      models,
      sync,
    );

    // 3. Vérification : la donnée locale a été ÉCRASÉE
    expect(store.getRow('clients', 'c001')?.nom).toBe('Version serveur');
    expect(sync.get('clients', 'c001')?.dirty).toBe(1);
    expect(result).toEqual({ ok: 1, failed: 0 });
  });
});

describe('batchApplyRemoteEntries — version CORRIGÉE', () => {
  let orm: OrmLike;
  let store: MemoryStore;
  let sync: ReturnType<typeof createSyncState>;
  let models: Record<string, ReturnType<typeof createMockModel>>;

  beforeEach(() => {
    orm = createMockOrm();
    store = createMemoryStore();
    sync = createSyncState(orm);
    models = { clients: createMockModel(store, 'clients') };
  });

  it('ne pas écraser les données dirty (correction appliquée)', () => {
    models.clients.upsert({ id: 'c001', nom: 'Édition locale' });
    sync.markDirty('clients', 'c001');

    const result = batchApplyRemoteEntries_FIXED(
      [{ table: 'clients', id: 'c001', version: 5, data: { nom: 'Version serveur' } }],
      models,
      sync,
    );

    expect(store.getRow('clients', 'c001')?.nom).toBe('Édition locale');
    expect(sync.get('clients', 'c001')?.version).toBe(5);
    expect(sync.get('clients', 'c001')?.dirty).toBe(1);
    expect(result).toEqual({ ok: 1, failed: 0 });
  });

  it('écrase les lignes non-dirty normalement', () => {
    models.clients.upsert({ id: 'c001', nom: 'Ancien' });
    sync.applyRemote({ table: 'clients', id: 'c001', version: 1 });

    const result = batchApplyRemoteEntries_FIXED(
      [{ table: 'clients', id: 'c001', version: 5, data: { nom: 'Nouveau serveur' } }],
      models,
      sync,
    );

    expect(store.getRow('clients', 'c001')?.nom).toBe('Nouveau serveur');
  });
});

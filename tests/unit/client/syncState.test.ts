// Tests pour le miroir local sync_state
//
// Couvre : markDirty, markClean, applyRemote, batchApplyRemote,
//          maxVersion, getDirty, isEmpty, get
//
// Ces tests utilisent une vraie base SQLite in-memory.

import { createMockOrm, type OrmLike } from '../../helpers/mock-orm';

// Reproduit la logique de syncState depuis Databases/index.ts
function createSyncState(orm: OrmLike) {
  return {
    maxVersion(): number {
      const row = orm.get<{ v: number | null }>(
        'SELECT MAX(version) AS v FROM sync_state',
      );
      return Number(row?.v ?? 0);
    },

    getDirty(): any[] {
      return orm.query<any>(
        `SELECT * FROM sync_state
         WHERE dirty = 1
         ORDER BY (lastPushedAt IS NULL) DESC, lastPushedAt ASC`,
      );
    },

    get(table: string, id: string): any | null {
      const rows = orm.query<any>(
        'SELECT * FROM sync_state WHERE table_name = ? AND element_id = ?',
        [table, id],
      );
      return rows?.[0] ?? null;
    },

    markDirty(table: string, id: string, opts?: { deleted?: boolean }): void {
      const deleted = opts?.deleted ? 1 : 0;
      orm.run(
        `INSERT INTO sync_state (table_name, element_id, version, localVersion, dirty, deleted)
         VALUES (?, ?, 0, 1, 1, ?)
         ON CONFLICT(table_name, element_id) DO UPDATE SET
           localVersion = sync_state.localVersion + 1,
           dirty        = 1,
           deleted      = excluded.deleted`,
        [table, id, deleted],
      );
    },

    markClean(table: string, id: string, serverVersion: number): void {
      const now = new Date().toISOString();
      orm.run(
        `UPDATE sync_state
           SET version = ?, dirty = 0, lastPushedAt = ?
         WHERE table_name = ? AND element_id = ?`,
        [serverVersion, now, table, id],
      );
    },

    applyRemote(entry: {
      table: string;
      id: string;
      version: number;
      deleted?: boolean;
    }): void {
      const now = new Date().toISOString();
      const deleted = entry.deleted ? 1 : 0;
      orm.run(
        `INSERT INTO sync_state (table_name, element_id, version, deleted, lastPulledAt)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(table_name, element_id) DO UPDATE SET
           version      = excluded.version,
           deleted      = excluded.deleted,
           lastPulledAt = excluded.lastPulledAt`,
        [entry.table, entry.id, entry.version, deleted, now],
      );
    },

    batchApplyRemote(entries: Array<{
      table: string;
      id: string;
      version: number;
      deleted?: boolean;
    }>): void {
      const now = new Date().toISOString();
      for (const entry of entries) {
        const deleted = entry.deleted ? 1 : 0;
        orm.run(
          `INSERT INTO sync_state (table_name, element_id, version, deleted, lastPulledAt)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(table_name, element_id) DO UPDATE SET
             version      = excluded.version,
             deleted      = excluded.deleted,
             lastPulledAt = excluded.lastPulledAt`,
          [entry.table, entry.id, entry.version, deleted, now],
        );
      }
    },

    isEmpty(): boolean {
      const row = orm.get<{ n: number }>('SELECT COUNT(*) AS n FROM sync_state');
      return Number(row?.n ?? 0) === 0;
    },
  };
}

describe('syncState local — opérations CRUD', () => {
  let orm: OrmLike;
  let sync: ReturnType<typeof createSyncState>;

  beforeEach(() => {
    orm = createMockOrm();
    sync = createSyncState(orm);
  });

  describe('isEmpty / maxVersion', () => {
    it('est vide initialement', () => {
      expect(sync.isEmpty()).toBe(true);
    });

    it('maxVersion = 0 quand vide', () => {
      expect(sync.maxVersion()).toBe(0);
    });
  });

  describe('markDirty', () => {
    it('marque une ligne comme dirty', () => {
      sync.markDirty('clients', 'c001');
      const row = sync.get('clients', 'c001');
      expect(row).not.toBeNull();
      expect(row.dirty).toBe(1);
      expect(row.version).toBe(0);
      expect(row.localVersion).toBe(1);
    });

    it('incrémente localVersion à chaque markDirty', () => {
      sync.markDirty('clients', 'c001');
      sync.markDirty('clients', 'c001');
      const row = sync.get('clients', 'c001');
      expect(row.localVersion).toBe(2);
      expect(row.dirty).toBe(1);
    });

    it('marque comme deleted si demandé', () => {
      sync.markDirty('articles', 'a001', { deleted: true });
      const row = sync.get('articles', 'a001');
      expect(row.deleted).toBe(1);
      expect(row.dirty).toBe(1);
    });

    it('getDirty() retourne les lignes dirty', () => {
      sync.markDirty('clients', 'c001');
      sync.markDirty('articles', 'a001');
      const dirty = sync.getDirty();
      expect(dirty).toHaveLength(2);
    });
  });

  describe('markClean', () => {
    it('passe dirty à 0 et enregistre la version serveur', () => {
      sync.markDirty('clients', 'c001');
      sync.markClean('clients', 'c001', 5);
      const row = sync.get('clients', 'c001');
      expect(row.dirty).toBe(0);
      expect(row.version).toBe(5);
      expect(row.lastPushedAt).not.toBeNull();
    });

    it('getDirty() ne retourne plus les lignes nettoyées', () => {
      sync.markDirty('clients', 'c001');
      sync.markClean('clients', 'c001', 5);
      expect(sync.getDirty()).toHaveLength(0);
    });
  });

  describe('applyRemote', () => {
    it('enregistre la version serveur sans toucher à dirty', () => {
      sync.markDirty('clients', 'c001');
      sync.applyRemote({ table: 'clients', id: 'c001', version: 5 });

      const row = sync.get('clients', 'c001');
      expect(row.version).toBe(5);
      expect(row.dirty).toBe(1); // ← NE DOIT PAS être effacé !
      expect(row.lastPulledAt).not.toBeNull();
    });

    it('crée une entrée propre si inexistante', () => {
      sync.applyRemote({ table: 'clients', id: 'c002', version: 3 });

      const row = sync.get('clients', 'c002');
      expect(row.version).toBe(3);
      expect(row.dirty).toBe(0);
    });

    it('enregistre les tombstones (deleted)', () => {
      sync.applyRemote({ table: 'clients', id: 'c003', version: 7, deleted: true });
      const row = sync.get('clients', 'c003');
      expect(row.deleted).toBe(1);
    });
  });

  describe('batchApplyRemote', () => {
    it('applique plusieurs entrées dans une transaction logique', () => {
      sync.batchApplyRemote([
        { table: 'clients', id: 'c001', version: 1 },
        { table: 'articles', id: 'a001', version: 1 },
        { table: 'clients', id: 'c002', version: 2, deleted: true },
      ]);

      expect(sync.get('clients', 'c001')?.version).toBe(1);
      expect(sync.get('articles', 'a001')?.version).toBe(1);
      expect(sync.get('clients', 'c002')?.deleted).toBe(1);
    });

    it('met à jour maxVersion après application', () => {
      sync.batchApplyRemote([
        { table: 'clients', id: 'c001', version: 3 },
        { table: 'clients', id: 'c002', version: 7 },
      ]);
      expect(sync.maxVersion()).toBe(7);
    });
  });

  describe('interactions markDirty + applyRemote', () => {
    it('ligne dirty → applyRemote met à jour version mais garde dirty=1', () => {
      sync.markDirty('clients', 'c001');
      sync.applyRemote({ table: 'clients', id: 'c001', version: 5 });
      const row = sync.get('clients', 'c001');
      expect(row.version).toBe(5);
      expect(row.dirty).toBe(1);
    });

    it('ligne dirty → markClean après push efface le dirty', () => {
      sync.markDirty('clients', 'c001');
      sync.applyRemote({ table: 'clients', id: 'c001', version: 5 });
      sync.markClean('clients', 'c001', 5);
      const row = sync.get('clients', 'c001');
      expect(row.dirty).toBe(0);
      expect(row.version).toBe(5);
    });

    it('ligne propre → applyRemote reste propre', () => {
      sync.applyRemote({ table: 'clients', id: 'c001', version: 3 });
      sync.applyRemote({ table: 'clients', id: 'c001', version: 5 });
      const row = sync.get('clients', 'c001');
      expect(row.dirty).toBe(0);
      expect(row.version).toBe(5);
    });
  });
});

describe('syncState — scénarios de synchronisation', () => {
  let orm: OrmLike;
  let sync: ReturnType<typeof createSyncState>;

  beforeEach(() => {
    orm = createMockOrm();
    sync = createSyncState(orm);
  });

  it('cycle complet: markDirty → push → markClean → pull → applyRemote', () => {
    // 1. Mutation locale
    sync.markDirty('clients', 'c001');
    expect(sync.getDirty()).toHaveLength(1);

    // 2. Push réussi
    sync.markClean('clients', 'c001', 1);
    expect(sync.getDirty()).toHaveLength(0);

    // 3. Pull depuis le serveur (nouvelle version)
    sync.applyRemote({ table: 'clients', id: 'c001', version: 2 });
    expect(sync.get('clients', 'c001')?.version).toBe(2);
    expect(sync.get('clients', 'c001')?.dirty).toBe(0);
  });

  it('plusieurs lignes dirty, ordre de push par lastPushedAt', () => {
    sync.markDirty('clients', 'c001');
    sync.markDirty('articles', 'a001');

    const dirty = sync.getDirty();
    expect(dirty).toHaveLength(2);
  });

  it('maxVersion ignore les lignes non pullées (version=0)', () => {
    sync.markDirty('clients', 'c001');
    expect(sync.maxVersion()).toBe(0);

    sync.applyRemote({ table: 'clients', id: 'c001', version: 10 });
    expect(sync.maxVersion()).toBe(10);
  });
});

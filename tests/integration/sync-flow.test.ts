// Tests d'intégration du flux de synchronisation complet
//
// Simule un cycle de bout en bout :
//   Mutation locale → markDirty → push → LWW arbitrage → pull → applyRemote
//
// Utilise le mock ORM pure-JS et un MockServer pour simuler le serveur.

import { createMockOrm, type OrmLike } from '../helpers/mock-orm';

function createSyncState(orm: OrmLike) {
  return {
    maxVersion(): number {
      const row = orm.get<{ v: number | null }>('SELECT MAX(version) AS v FROM sync_state');
      return Number(row?.v ?? 0);
    },
    getDirty(): any[] {
      return orm.query<any>(
        'SELECT * FROM sync_state WHERE dirty = 1 ORDER BY (lastPushedAt IS NULL) DESC, lastPushedAt ASC',
      );
    },
    get(table: string, id: string): any | null {
      return orm.query<any>('SELECT * FROM sync_state WHERE table_name = ? AND element_id = ?', [table, id])?.[0] ?? null;
    },
    markDirty(table: string, id: string, opts?: { deleted?: boolean }): void {
      const deleted = opts?.deleted ? 1 : 0;
      orm.run(
        `INSERT INTO sync_state (table_name, element_id, version, localVersion, dirty, deleted)
         VALUES (?, ?, 0, 1, 1, ?)
         ON CONFLICT DO UPDATE SET
           localVersion = sync_state.localVersion + 1, dirty = 1, deleted = excluded.deleted`,
        [table, id, deleted],
      );
    },
    markClean(table: string, id: string, serverVersion: number): void {
      const now = new Date().toISOString();
      orm.run(
        'UPDATE sync_state SET version = ?, dirty = 0, lastPushedAt = ? WHERE table_name = ? AND element_id = ?',
        [serverVersion, now, table, id],
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
    isEmpty(): boolean {
      const row = orm.get<{ n: number }>('SELECT COUNT(*) AS n FROM sync_state');
      return Number(row?.n ?? 0) === 0;
    },
  };
}

class MockServer {
  private data = new Map<string, Record<string, unknown>>();
  private versions = new Map<string, number>();
  private deleted = new Map<string, boolean>();

  private key(table: string, id: string): string {
    return `${table}:${id}`;
  }

  getCurrentVersion(table: string, id: string): number {
    return this.versions.get(this.key(table, id)) ?? 0;
  }

  getData(table: string, id: string): Record<string, unknown> | null {
    return this.data.get(this.key(table, id)) ?? null;
  }

  bumpVersion(table: string, id: string, deleted = false): number {
    const k = this.key(table, id);
    const newVersion = (this.versions.get(k) ?? 0) + 1;
    this.versions.set(k, newVersion);
    if (deleted) this.deleted.set(k, true);
    return newVersion;
  }

  /** LWW arbitration + apply */
  createOrUpdate(
    table: string, id: string,
    body: Record<string, unknown>,
  ): { applied: 'client' | 'server'; currentVersion: number; data?: Record<string, unknown> } {
    const _version = typeof body._version === 'number' ? body._version : undefined;
    const currentVersion = this.getCurrentVersion(table, id);

    if (_version !== undefined && _version < currentVersion) {
      return { applied: 'server', currentVersion, data: this.data.get(this.key(table, id)) };
    }

    const { _version: _, _updatedAt: __, ...cleanBody } = body as any;
    this.data.set(this.key(table, id), { ...cleanBody, id });
    this.deleted.delete(this.key(table, id));
    const newVersion = this.bumpVersion(table, id);
    return { applied: 'client', currentVersion: newVersion };
  }

  deleteRow(table: string, id: string): void {
    this.data.delete(this.key(table, id));
    this.bumpVersion(table, id, true);
  }

  getInventory(since: number): Array<{ table: string; id: string; version: number; deleted: boolean }> {
    const items: Array<{ table: string; id: string; version: number; deleted: boolean }> = [];
    for (const [k, v] of this.versions) {
      if (v > since) {
        const [table, id] = k.split(':');
        items.push({ table, id, version: v, deleted: this.deleted.has(k) });
      }
    }
    return items.sort((a, b) => a.version - b.version);
  }

  maxVersion(): number {
    let max = 0;
    for (const v of this.versions.values()) {
      if (v > max) max = v;
    }
    return max;
  }

  seed(table: string, id: string, data: Record<string, unknown>): void {
    this.data.set(this.key(table, id), { ...data, id });
    this.bumpVersion(table, id);
  }
}

describe('Sync Flow — cycle complet', () => {
  let orm: OrmLike;
  let sync: ReturnType<typeof createSyncState>;
  let server: MockServer;

  beforeEach(() => {
    orm = createMockOrm();
    sync = createSyncState(orm);
    server = new MockServer();
  });

  it('premier utilisateur → push crée la ligne sur le serveur', () => {
    sync.markDirty('clients', 'c001');

    const row = sync.get('clients', 'c001');
    const result = server.createOrUpdate('clients', 'c001', { _version: row.version, nom: 'Alice' });

    expect(result.applied).toBe('client');
    sync.markClean('clients', 'c001', result.currentVersion);

    expect(sync.get('clients', 'c001')?.dirty).toBe(0);
    expect(sync.get('clients', 'c001')?.version).toBe(1);
    expect(server.getData('clients', 'c001')?.nom).toBe('Alice');
  });

  it('conflit LWW — push avec version obsolète → serveur gagne', () => {
    server.seed('clients', 'c001', { nom: 'Version serveur' });
    server.bumpVersion('clients', 'c001');
    server.bumpVersion('clients', 'c001');
    // maintenant version = 3

    sync.markDirty('clients', 'c001');
    sync.applyRemote({ table: 'clients', id: 'c001', version: 1 });

    const row = sync.get('clients', 'c001');
    const result = server.createOrUpdate('clients', 'c001', { _version: row.version, nom: 'Édition locale' });

    expect(result.applied).toBe('server');
    expect(result.currentVersion).toBe(3);

    if (result.data) {
      sync.applyRemote({ table: 'clients', id: 'c001', version: result.currentVersion });
    }
    sync.markClean('clients', 'c001', result.currentVersion);

    expect(sync.get('clients', 'c001')?.dirty).toBe(0);
    expect(sync.get('clients', 'c001')?.version).toBe(3);
    expect(server.getData('clients', 'c001')?.nom).toBe('Version serveur');
  });

  it('pull récupère les modifications serveur', () => {
    server.seed('clients', 'c001', { nom: 'Client 1' });
    server.seed('articles', 'a001', { nom: 'Article 1' });

    const since = sync.maxVersion();
    const inventory = server.getInventory(since);
    expect(inventory).toHaveLength(2);

    for (const entry of inventory) {
      sync.applyRemote({ table: entry.table, id: entry.id, version: entry.version });
    }

    expect(sync.maxVersion()).toBe(1);
    expect(sync.get('clients', 'c001')?.version).toBe(1);
    expect(sync.get('articles', 'a001')?.version).toBe(1);
  });

  it('cycle pull → push → pull vérifie la convergence', () => {
    server.seed('clients', 'c001', { nom: 'Initial' });

    // Pull
    for (const e of server.getInventory(0)) {
      sync.applyRemote({ table: e.table, id: e.id, version: e.version });
    }
    expect(sync.maxVersion()).toBe(1);

    // Push
    sync.markDirty('clients', 'c001');
    const row = sync.get('clients', 'c001');
    const result = server.createOrUpdate('clients', 'c001', { _version: row.version, nom: 'Modifié' });
    expect(result.applied).toBe('client');
    sync.markClean('clients', 'c001', result.currentVersion);

    // Pull again
    for (const e of server.getInventory(sync.maxVersion())) {
      sync.applyRemote({ table: e.table, id: e.id, version: e.version });
    }

    expect(sync.maxVersion()).toBe(server.maxVersion());
    expect(server.getData('clients', 'c001')?.nom).toBe('Modifié');
  });

  it('deux clients en conflit — le premier arrivé gagne', () => {
    server.seed('clients', 'c001', { nom: 'Original' });

    // Client A: pull → push
    for (const e of server.getInventory(0)) sync.applyRemote(e);
    sync.markDirty('clients', 'c001');
    const rowA = sync.get('clients', 'c001');
    const resultA = server.createOrUpdate('clients', 'c001', { _version: rowA.version, nom: 'Client A' });
    expect(resultA.applied).toBe('client');
    sync.markClean('clients', 'c001', resultA.currentVersion);

    // Client B (simulé): push avec version obsolète
    const resultB = server.createOrUpdate('clients', 'c001', { _version: 0, nom: 'Client B' });
    expect(resultB.applied).toBe('server');
    expect(server.getData('clients', 'c001')?.nom).toBe('Client A');
  });

  it('suppression et pull du tombstone', () => {
    server.seed('clients', 'c001', { nom: 'À supprimer' });

    for (const e of server.getInventory(0)) sync.applyRemote(e);

    sync.markDirty('clients', 'c001', { deleted: true });

    const versionBeforeDelete = sync.get('clients', 'c001').version;
    server.deleteRow('clients', 'c001');
    sync.markClean('clients', 'c001', sync.get('clients', 'c001').version + 1);

    const inv = server.getInventory(0);
    const tombstone = inv.find((e) => e.table === 'clients' && e.id === 'c001' && e.deleted);
    expect(tombstone?.deleted).toBe(true);
  });
});

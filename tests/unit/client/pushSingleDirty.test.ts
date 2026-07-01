// Tests pour pushSingleDirty — le push d'une ligne locale vers le serveur
//
// Vérifie :
//   1. Envoi du payload avec _version/_updatedAt
//   2. Gestion de applied:"client" → markClean
//   3. Gestion de applied:"server" → adoption canonique + markClean
//   4. BUG #2 : markClean manquant après server-overwrite
//   5. Gestion des lignes supprimées

import { createMockOrm, type OrmLike } from '../../helpers/mock-orm';

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
  };
}

type ServerResponse = {
  applied: 'client' | 'server';
  currentVersion: number;
  data?: Record<string, unknown> | null;
};

// Version ACTUELLE de pushSingleDirty (avec le bug markClean manquant)
async function pushSingleDirty_CURRENT(
  params: {
    table: string;
    id: string;
    rowVersion: number;
    localData: Record<string, unknown> | null;
    deleted: boolean;
  },
  serverResponse: ServerResponse,
  sync: ReturnType<typeof createSyncState>,
): Promise<'client' | 'server'> {
  const { table, id, rowVersion, localData, deleted } = params;

  if (deleted) {
    sync.markClean(table, id, rowVersion + 1);
    return 'client';
  }

  if (!localData) {
    sync.markClean(table, id, rowVersion);
    return 'client';
  }

  const { applied, currentVersion, data: canonical } = serverResponse;

  if (applied === 'server') {
    // BUG: applyRemote est appelé mais markClean ne l'est PAS
    if (canonical) {
      sync.applyRemote({ table, id, version: currentVersion });
      // ← markClean manquant ici !
    } else {
      sync.markClean(table, id, currentVersion);
    }
    return 'server';
  }

  sync.markClean(table, id, currentVersion);
  return 'client';
}

// Version CORRIGÉE de pushSingleDirty
async function pushSingleDirty_FIXED(
  params: {
    table: string;
    id: string;
    rowVersion: number;
    localData: Record<string, unknown> | null;
    deleted: boolean;
  },
  serverResponse: ServerResponse,
  sync: ReturnType<typeof createSyncState>,
): Promise<'client' | 'server'> {
  const { table, id, localData, deleted } = params;

  if (deleted) {
    sync.markClean(table, id, params.rowVersion + 1);
    return 'client';
  }

  if (!localData) {
    sync.markClean(table, id, params.rowVersion);
    return 'client';
  }

  const { applied, currentVersion, data: canonical } = serverResponse;

  if (applied === 'server') {
    if (canonical) {
      sync.applyRemote({ table, id, version: currentVersion });
    }
    // CORRECTION: marquer clean après avoir adopté la canonique
    sync.markClean(table, id, currentVersion);
    return 'server';
  }

  sync.markClean(table, id, currentVersion);
  return 'client';
}

describe('pushSingleDirty — version ACTUELLE', () => {
  let orm: OrmLike;
  let sync: ReturnType<typeof createSyncState>;

  beforeEach(() => {
    orm = createMockOrm();
    sync = createSyncState(orm);
  });

  it('applied:"client" → markClean avec la version serveur', async () => {
    sync.markDirty('clients', 'c001');

    const result = await pushSingleDirty_CURRENT(
      { table: 'clients', id: 'c001', rowVersion: 0, localData: { nom: 'Alice' }, deleted: false },
      { applied: 'client', currentVersion: 1 },
      sync,
    );

    expect(result).toBe('client');
    expect(sync.get('clients', 'c001')?.dirty).toBe(0);
    expect(sync.get('clients', 'c001')?.version).toBe(1);
  });

  it('BUG: applied:"server" avec canonique → dirty RESTE à 1', async () => {
    sync.markDirty('clients', 'c001');

    const result = await pushSingleDirty_CURRENT(
      { table: 'clients', id: 'c001', rowVersion: 0, localData: { nom: 'Alice' }, deleted: false },
      { applied: 'server', currentVersion: 5, data: { nom: 'Canonique serveur' } },
      sync,
    );

    expect(result).toBe('server');
    expect(sync.get('clients', 'c001')?.version).toBe(5);
    expect(sync.get('clients', 'c001')?.dirty).toBe(1); // ← BUG
  });

  it('applied:"server" sans canonique → markClean est appelé (cas else)', async () => {
    sync.markDirty('clients', 'c001');

    const result = await pushSingleDirty_CURRENT(
      { table: 'clients', id: 'c001', rowVersion: 0, localData: { nom: 'Alice' }, deleted: false },
      { applied: 'server', currentVersion: 5, data: null },
      sync,
    );

    expect(result).toBe('server');
    expect(sync.get('clients', 'c001')?.dirty).toBe(0);
    expect(sync.get('clients', 'c001')?.version).toBe(5);
  });

  it('ligne supprimée → markClean', async () => {
    sync.markDirty('clients', 'c001');

    const result = await pushSingleDirty_CURRENT(
      { table: 'clients', id: 'c001', rowVersion: 0, localData: null, deleted: true },
      { applied: 'client', currentVersion: 1 },
      sync,
    );

    expect(result).toBe('client');
    expect(sync.get('clients', 'c001')?.dirty).toBe(0);
  });
});

describe('pushSingleDirty — version CORRIGÉE', () => {
  let orm: OrmLike;
  let sync: ReturnType<typeof createSyncState>;

  beforeEach(() => {
    orm = createMockOrm();
    sync = createSyncState(orm);
  });

  it('applied:"server" avec canonique → dirty=0 après correction', async () => {
    sync.markDirty('clients', 'c001');

    const result = await pushSingleDirty_FIXED(
      { table: 'clients', id: 'c001', rowVersion: 0, localData: { nom: 'Alice' }, deleted: false },
      { applied: 'server', currentVersion: 5, data: { nom: 'Canonique serveur' } },
      sync,
    );

    expect(result).toBe('server');
    expect(sync.get('clients', 'c001')?.version).toBe(5);
    expect(sync.get('clients', 'c001')?.dirty).toBe(0);
  });

  it('applied:"server" sans canonique → dirty=0', async () => {
    sync.markDirty('clients', 'c001');

    const result = await pushSingleDirty_FIXED(
      { table: 'clients', id: 'c001', rowVersion: 0, localData: { nom: 'Alice' }, deleted: false },
      { applied: 'server', currentVersion: 5, data: null },
      sync,
    );

    expect(result).toBe('server');
    expect(sync.get('clients', 'c001')?.dirty).toBe(0);
  });

  it('cycle normal: markDirty → push accepté → propre', async () => {
    sync.markDirty('clients', 'c001');

    await pushSingleDirty_FIXED(
      { table: 'clients', id: 'c001', rowVersion: 0, localData: { nom: 'Alice' }, deleted: false },
      { applied: 'client', currentVersion: 3 },
      sync,
    );

    expect(sync.get('clients', 'c001')?.dirty).toBe(0);
    expect(sync.get('clients', 'c001')?.version).toBe(3);
  });
});

// Mock ORM — utilise MemoryStore directement sans parsing SQL
// Implémente l'interface run/get/query avec des méthodes directes.

import { createMemoryStore, type SyncStateRow } from './client-db';

export type OrmLike = {
  run: (sql: string, params?: any[]) => any;
  get: <T>(sql: string, params?: any[]) => T | null;
  query: <T>(sql: string, params?: any[]) => T[];
};

export function createMockOrm(): OrmLike {
  const store = createMemoryStore();
  const syncTable = store.getOrCreateTable('sync_state');

  function key(table: string, id: string): string {
    return `${table}:${id}`;
  }

  function getRow(table: string, id: string): SyncStateRow | null {
    const r = syncTable.get(key(table, id));
    return r ? ({ ...r } as SyncStateRow) : null;
  }

  function setRow(table: string, id: string, row: SyncStateRow): void {
    syncTable.set(key(table, id), { ...row });
  }

  function createRow(table: string, id: string): SyncStateRow {
    return { table_name: table, element_id: id, version: 0, localVersion: 0, dirty: 0, deleted: 0, lastPulledAt: null, lastPushedAt: null };
  }

  return {
    run(sql: string, params: any[] = []) {
      const s = sql.replace(/\s+/g, ' ').trim();
      const upper = s.toUpperCase();

      // markDirty: INSERT ... ON CONFLICT DO UPDATE SET ... localVersion = ... + 1, dirty = 1 ...
      if (upper.includes('ON CONFLICT') && upper.includes('LOCALVERSION')) {
        const table = String(params[0]);
        const id = String(params[1]);
        const existing = getRow(table, id);
        if (existing) {
          existing.localVersion += 1;
          existing.dirty = 1;
          if (params.length >= 3) existing.deleted = Number(params[2]) || 0;
          setRow(table, id, existing);
        } else {
          const deleted = params.length >= 3 ? Number(params[2]) || 0 : 0;
          const row = createRow(table, id);
          row.version = 0;
          row.localVersion = 1;
          row.dirty = 1;
          row.deleted = deleted;
          setRow(table, id, row);
        }
        return { changes: 1, lastInsertRowid: syncTable.size };
      }

      // applyRemote: INSERT ... ON CONFLICT DO UPDATE SET version = excluded.version ...
      if (upper.includes('ON CONFLICT') && upper.includes('EXCLUDED.VERSION')) {
        const table = String(params[0]);
        const id = String(params[1]);
        const version = Number(params[2]) ?? 0;
        const deleted = params.length >= 4 ? Number(params[3]) ?? 0 : 0;
        const now = params.length >= 5 ? String(params[4]) : new Date().toISOString();
        const existing = getRow(table, id);
        if (existing) {
          existing.version = version;
          existing.deleted = deleted;
          existing.lastPulledAt = now;
          setRow(table, id, existing);
        } else {
          const row = createRow(table, id);
          row.version = version;
          row.deleted = deleted;
          row.lastPulledAt = now;
          setRow(table, id, row);
        }
        return { changes: 1, lastInsertRowid: syncTable.size };
      }

      // markClean: UPDATE sync_state SET version = ?, dirty = 0, lastPushedAt = ? WHERE ...
      if (upper.startsWith('UPDATE') && upper.includes('DIRTY = 0')) {
        const table = String(params[2]);
        const id = String(params[3]);
        const existing = getRow(table, id);
        if (existing) {
          existing.version = Number(params[0]) ?? 0;
          existing.dirty = 0;
          existing.lastPushedAt = String(params[1] ?? new Date().toISOString());
          setRow(table, id, existing);
        }
        return { changes: 1, lastInsertRowid: 0 };
      }

      // DELETE FROM sync_state
      if (upper.startsWith('DELETE')) {
        const table = String(params[0]);
        const id = String(params[1]);
        syncTable.delete(key(table, id));
        return { changes: 1, lastInsertRowid: 0 };
      }

      if (upper.includes('CREATE TABLE') || upper.includes('CREATE INDEX')) {
        return { changes: 0, lastInsertRowid: 0 };
      }

      return { changes: 0, lastInsertRowid: 0 };
    },

    get<T>(sql: string, params: any[] = []): T | null {
      const s = sql.replace(/\s+/g, ' ').trim();
      const upper = s.toUpperCase();

      // SELECT MAX(version) AS v FROM sync_state
      if (upper.includes('MAX(VERSION)')) {
        let max = 0;
        for (const row of syncTable.values()) {
          const v = (row as SyncStateRow).version;
          if (v > max) max = v;
        }
        return { v: max > 0 ? max : null } as T;
      }

      // SELECT COUNT(*) AS n FROM sync_state
      if (upper.includes('COUNT(*)')) {
        return { n: syncTable.size } as T;
      }

      // WHERE table_name = ? AND element_id = ?
      if (params.length >= 2) {
        const table = String(params[0]);
        const id = String(params[1]);
        const row = getRow(table, id);
        return row ? ({ ...row } as T) : null;
      }

      return null;
    },

    query<T>(sql: string, params: any[] = []): T[] {
      const s = sql.replace(/\s+/g, ' ').trim();
      const upper = s.toUpperCase();

      // SELECT MAX(version) as v
      if (upper.includes('MAX(VERSION)')) {
        let max = 0;
        for (const row of syncTable.values()) {
          const v = (row as SyncStateRow).version;
          if (v > max) max = v;
        }
        return [{ v: max }] as T[];
      }

      // COUNT(*)
      if (upper.includes('COUNT(*)')) {
        return [{ n: syncTable.size }] as T[];
      }

      // WHERE dirty = 1
      if (upper.includes('WHERE DIRTY = 1')) {
        return Array.from(syncTable.values())
          .filter((r) => (r as SyncStateRow).dirty === 1)
          .sort((a, b) => {
            const ap = (a as SyncStateRow).lastPushedAt;
            const bp = (b as SyncStateRow).lastPushedAt;
            if (!ap) return -1;
            if (!bp) return 1;
            return ap.localeCompare(bp);
          })
          .map((r) => ({ ...r })) as T[];
      }

      // WHERE table_name = ? AND element_id = ?
      if (params.length >= 2) {
        const table = String(params[0]);
        const id = String(params[1]);
        const row = getRow(table, id);
        return row ? [{ ...row }] : [];
      }

      return Array.from(syncTable.values()).map((r) => ({ ...r })) as T[];
    },
  };
}

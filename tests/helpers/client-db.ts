// Helper de base de données in-memory pure-JS (sans better-sqlite3)
// Utilise un simple Map comme store pour les tests unitaires.

export type SyncStateRow = {
  table_name: string;
  element_id: string;
  version: number;
  localVersion: number;
  dirty: number;
  deleted: number;
  lastPulledAt: string | null;
  lastPushedAt: string | null;
};

type TableStore = Map<string, Record<string, unknown>>;

export class MemoryStore {
  private tables = new Map<string, TableStore>();

  getOrCreateTable(name: string): TableStore {
    if (!this.tables.has(name)) {
      this.tables.set(name, new Map());
    }
    return this.tables.get(name)!;
  }

  getRow(table: string, id: string): Record<string, unknown> | null {
    return this.getOrCreateTable(table).get(id) ?? null;
  }

  setRow(table: string, id: string, data: Record<string, unknown>): void {
    this.getOrCreateTable(table).set(id, data);
  }

  deleteRow(table: string, id: string): void {
    this.getOrCreateTable(table).delete(id);
  }

  getAllRows(table: string): Array<{ id: string } & Record<string, unknown>> {
    const store = this.getOrCreateTable(table);
    return Array.from(store.entries()).map(([id, data]) => ({ id, ...data }));
  }

  query<T = Record<string, unknown>>(
    table: string,
    predicate: (row: Record<string, unknown>) => boolean,
  ): T[] {
    const store = this.getOrCreateTable(table);
    return Array.from(store.values()).filter(predicate) as T[];
  }
}

// Variable globale pour le cleanup
const stores = new Set<MemoryStore>();

export function createMemoryStore(): MemoryStore {
  const store = new MemoryStore();
  stores.add(store);
  return store;
}

export function cleanupDatabases(): void {
  stores.clear();
}

// Types de base
export interface QueryResult {
  lastInsertRowid?: number;
  changes: number;
}

export interface DatabaseRow {
  [key: string]: any;
}

export interface WhereConditions {
  [key: string]: any;
}

export interface OrderByOptions {
  column: string;
  direction?: "ASC" | "DESC";
}

export interface IncludeOptions {
  model: string;
  foreignKey: string;
  localKey?: string;
  as?: string;
}

export interface QueryOptions {
  where?: WhereConditions;
  orderBy?: OrderByOptions | OrderByOptions[];
  limit?: number;
  offset?: number;
  include?: IncludeOptions | IncludeOptions[];
}

export interface TableSchema {
  [columnName: string]: string;
}

// Type utilitaire pour extraire les clés et types d'un modèle
export type ModelKeys<T> = {
  [K in keyof T]: K;
};

export type ModelTypes<T> = {
  [K in keyof T]: T[K] extends string
    ? "string"
    : T[K] extends number
      ? "number"
      : T[K] extends boolean
        ? "boolean"
        : T[K] extends Date
          ? "date"
          : "any";
};

// Interface pour les instances de modèle
export interface ModelInstance<T extends DatabaseRow> extends Partial<T> {
  save(): Promise<T>;
  delete(): Promise<boolean>;
}

// Interface pour les classes de modèle
export interface ModelClass<T extends DatabaseRow> {
  new (data?: Partial<T>): ModelInstance<T>;
  findAll(options?: QueryOptions): Promise<T[]>;
  findById(id: string | number): Promise<T | null>;
  create(data: Partial<T>): Promise<T>;
  update(id: string | number, data: Partial<T>): Promise<T | null>;
  delete(id: string | number): Promise<boolean>;
  createTable(): void;
}

// Interface pour le Query Builder
export interface QueryBuilder<T extends DatabaseRow> {
  where(conditions: WhereConditions): QueryBuilder<T>;
  orderBy(column: string, direction?: "ASC" | "DESC"): QueryBuilder<T>;
  limit(limit: number): QueryBuilder<T>;
  offset(offset: number): QueryBuilder<T>;
  include(options: IncludeOptions | IncludeOptions[]): QueryBuilder<T>;
  findAll(): Promise<T[]>;
  findOne(): Promise<T | null>;
  count(): Promise<number>;
}

// Types pour la synchronisation
export interface SyncOperation {
  id: string;
  operation: "CREATE" | "UPDATE" | "DELETE";
  tableName: string;
  recordId: string | number;
  data: Record<string, unknown>;
  timestamp: number;
  version: number;
  clientId: string;
  synced: boolean;
  retryCount?: number;
}

export interface SyncConfig {
  serverUrl: string;
  apiKey?: string;
  clientId: string;
  syncInterval?: number;
  retryAttempts?: number;
  enableRealtime?: boolean;
  conflictResolution?: "client" | "server" | "latest" | "custom";
  customConflictResolver?: (local: any, remote: any) => any;
}

export interface SyncStatus {
  isOnline: boolean;
  lastSync: Date | null;
  pendingOperations: number;
  isSyncing: boolean;
  errors: string[];
}

export interface RealtimeEvent {
  type: "CREATE" | "UPDATE" | "DELETE";
  table: string;
  record: any;
  timestamp: number;
  clientId: string;
}

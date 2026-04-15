import Database from "better-sqlite3";
import { SyncQueue } from "./SyncQueue";
import {
  handleInsertOperation,
  handleUpdateOperation,
  handleDeleteOperation,
} from "./database-operations";
import {
  DatabaseError,
  ErrorCodes,
  SyncError,
  ValidationError,
} from "./errors";

// Types utilitaires pour le ModelFactory
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

// Interface pour les modèles avec métadonnées
export interface ModelWithMeta<T extends DatabaseRow> {
  keys: ModelKeys<T>;
  types: ModelTypes<T>;
  tableName: string;
}

// Query Builder pour enchaîner les méthodes
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

// Interface pour les instances de modèle
export interface ModelInstance<T extends DatabaseRow> extends Partial<T> {
  save(): Promise<T>;
  delete(): Promise<boolean>;
}

// Interface pour les classes de modèle avec métadonnées
export interface ModelClass<T extends DatabaseRow> extends ModelWithMeta<T> {
  new (data?: Partial<T>): ModelInstance<T>;
  createTable(): Promise<QueryResult>;
  create(data: Partial<T>): Promise<T>;
  findAll(options?: QueryOptions): Promise<T[]>;
  findById(
    id: string | number,
    options?: { include?: IncludeOptions | IncludeOptions[] }
  ): Promise<T | null>;
  findOne(options: QueryOptions): Promise<T | null>;
  update(id: string | number, data: Partial<T>): Promise<T | null>;
  delete(id: string | number): Promise<boolean>;
  exists(conditions: WhereConditions): Promise<boolean>;
  where(conditions: WhereConditions): QueryBuilder<T>;
  orderBy(column: string, direction?: "ASC" | "DESC"): QueryBuilder<T>;
  limit(limit: number): QueryBuilder<T>;
  offset(offset: number): QueryBuilder<T>;
  include(options: IncludeOptions | IncludeOptions[]): QueryBuilder<T>;
  upsert(data: Partial<T>): T;
  upsertWithCoalesce(data: Partial<T>): T;
  createMany(dataArray: Partial<T>[]): T[];
  updateWhere(conditions: WhereConditions, data: Partial<T>): number;
  deleteWhere(conditions: WhereConditions): number;
  orm: SimpleORM;
}

// Types de base partagés
export interface QueryResult {
  lastInsertRowid?: number;
  changes: number;
}

export interface DatabaseRow {
  id?: string | number;
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
  limit?: number | undefined;
  offset?: number | undefined;
  include?: IncludeOptions | IncludeOptions[];
}

export interface TableSchema {
  [columnName: string]: string;
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

// type pour autocomplétion
type text = "TEXT";
type primaryKey = "PRIMARY KEY";
type notNull = "NOT NULL";
type real = "REAL";
type integer = "INTEGER" | "INT";
type blob = "BLOB";
type Null = "NULL";
type foreignKey = "FOREIGN KEY";
type Default = "DEFAULT" | "DEFAULT";
type time = "TIME";
type timestamp = "TIMESTAMP";
type current = "CURRENT_TIMESTAMP";
type datetime = "DATETIME";

type TextWithSuffix =
  | text
  | primaryKey
  | notNull
  | real
  | integer
  | blob
  | Null
  | foreignKey
  | Default
  | "UNIQUE"
  | `${text | integer | real | blob} ${
      | primaryKey
      | foreignKey
      | notNull
      | Null
      | "UNIQUE"
      | "AUTOINCREMENT"}`
  | `${text | integer | real} ${primaryKey | foreignKey | notNull | Null} ${
      | notNull
      | Null
      | Default
      | "UNIQUE"
      | "AUTOINCREMENT"}`
  | `${datetime | time | timestamp}`
  | `${datetime | time | timestamp} ${notNull | null}`
  | `${datetime | time | timestamp} ${notNull | null | Default} ${current}`
  | `${datetime | time | timestamp} ${notNull | null} ${
      | current
      | Default} ${current}`;

// ORM de base avec support de la synchronisation
export class SimpleORM {
  private db: Database.Database;
  private prepared: Map<string, Database.Statement> = new Map();
  private syncManager: SyncManager | null = null;

  constructor(dbPath: string, options?: Database.Options) {
    this.db = new Database(dbPath, options);
  }

  // Configuration de la synchronisation
  enableSync(config: SyncConfig): void {
    this.syncManager = new SyncManager(this, config);
  }

  disableSync(): void {
    if (this.syncManager) {
      this.syncManager.destroy();
      this.syncManager = null;
    }
  }

  // Méthodes de base de l'ORM
  private getStatement(sql: string): Database.Statement {
    if (!this.prepared.has(sql)) {
      this.prepared.set(sql, this.db.prepare(sql));
    }
    return this.prepared.get(sql)!;
  }

  private sanitizeParams(params: any[]): any[] {
    return params.map((param) => {
      if (param === null || param === undefined) {
        return null;
      }
      if (param instanceof Date) {
        return param.toISOString();
      }
      if (typeof param === "boolean") {
        return param ? 1 : 0;
      }
      if (typeof param === "object" && param !== null) {
        return JSON.stringify(param);
      }
      return param;
    });
  }

  // Méthodes principales avec support de synchronisation
  query<T extends DatabaseRow = DatabaseRow>(
    sql: string,
    params: any[] = []
  ): T[] {
    try {
      const sanitizedParams = this.sanitizeParams(params);
      const stmt = this.getStatement(sql);
      return stmt.all(...sanitizedParams) as T[];
    } catch (error) {
      if (error instanceof Error) {
        const message = error.message.toLowerCase();
        if (message.includes("no such table")) {
          throw new DatabaseError(
            error.message,
            ErrorCodes.TABLE_NOT_FOUND,
            sql,
            params
          );
        }
        if (message.includes("no such column")) {
          throw new DatabaseError(
            error.message,
            ErrorCodes.COLUMN_NOT_FOUND,
            sql,
            params
          );
        }
        if (message.includes("constraint failed")) {
          throw new DatabaseError(
            error.message,
            ErrorCodes.CONSTRAINT_VIOLATION,
            sql,
            params
          );
        }
        if (message.includes("syntax error")) {
          throw new DatabaseError(
            error.message,
            ErrorCodes.INVALID_QUERY,
            sql,
            params
          );
        }
      }
      throw new DatabaseError(
        "Une erreur de base de données est survenue",
        ErrorCodes.INVALID_QUERY,
        sql,
        params
      );
    }
  }

  get<T extends DatabaseRow = DatabaseRow>(
    sql: string,
    params: any[] = []
  ): T | null {
    try {
      const sanitizedParams = this.sanitizeParams(params);
      const stmt = this.getStatement(sql);
      return (stmt.get(...sanitizedParams) as T) || null;
    } catch (error) {
      console.error("Get error:", error, "SQL:", sql, "Params:", params);
      throw error;
    }
  }

  run(sql: string, params: any[] = []): QueryResult {
    try {
      const sanitizedParams = this.sanitizeParams(params);
      const stmt = this.getStatement(sql);
      const result = stmt.run(...sanitizedParams);

      return {
        lastInsertRowid: result.lastInsertRowid as number,
        changes: result.changes,
      };
    } catch (error) {
      console.error("Run error:", error, "SQL:", sql, "Params:", params);
      throw error;
    }
  }

  exec(sql: string): void {
    try {
      this.db.exec(sql);
    } catch (error) {
      console.error("Exec error:", error);
      throw error;
    }
  }

  // Méthodes pour supporter le ModelFactory
  async create<T extends DatabaseRow>(
    tableName: string,
    data: Partial<T>
  ): Promise<T> {
    const result = await handleInsertOperation(
      this,
      tableName,
      data as Record<string, unknown>
    );
    return { id: result.id, ...data } as T;
  }

  async findAll<T extends DatabaseRow>(
    tableName: string,
    options: QueryOptions = {}
  ): Promise<T[]> {
    const { where = {}, orderBy, limit, offset } = options;
    let sql = `SELECT * FROM ${tableName}`;
    const params: any[] = [];

    if (Object.keys(where).length > 0) {
      const whereClause = Object.entries(where)
        .map(([key]) => `${key} = ?`)
        .join(" AND ");
      sql += ` WHERE ${whereClause}`;
      params.push(...Object.values(where));
    }

    if (orderBy) {
      const orderClauses = (Array.isArray(orderBy) ? orderBy : [orderBy])
        .map((order) => `${order.column} ${order.direction || "ASC"}`)
        .join(", ");
      sql += ` ORDER BY ${orderClauses}`;
    }

    if (limit) {
      sql += ` LIMIT ${limit}`;
      if (offset) {
        sql += ` OFFSET ${offset}`;
      }
    }

    return this.query<T>(sql, params);
  }

  async findById<T extends DatabaseRow>(
    tableName: string,
    id: string | number
  ): Promise<T | null> {
    const sql = `SELECT * FROM ${tableName} WHERE id = ?`;
    return this.get<T>(sql, [id]);
  }

  async update<T extends DatabaseRow>(
    tableName: string,
    id: string | number,
    data: Partial<T>
  ): Promise<T | null> {
    await handleUpdateOperation(
      this,
      tableName,
      id,
      data as Record<string, unknown>
    );
    return this.findById<T>(tableName, id);
  }

  async delete(tableName: string, id: string | number): Promise<boolean> {
    const result = await handleDeleteOperation(this, tableName, id);
    return result > 0;
  }

  async deleteWhere(
    tableName: string,
    conditions: WhereConditions
  ): Promise<number> {
    const whereClause = Object.keys(conditions)
      .map((key) => `${key} = ?`)
      .join(" AND ");
    const sql = `DELETE FROM ${tableName} WHERE ${whereClause}`;
    const params = Object.values(conditions);
    const result = await this.run(sql, params);
    return result.changes;
  }

  async updateWhere<T extends DatabaseRow>(
    tableName: string,
    conditions: WhereConditions,
    data: Partial<T>
  ): Promise<number> {
    const updateFields = Object.keys(data)
      .map((key) => `${key} = ?`)
      .join(", ");
    const whereClause = Object.keys(conditions)
      .map((key) => `${key} = ?`)
      .join(" AND ");

    const sql = `UPDATE ${tableName} SET ${updateFields} WHERE ${whereClause}`;
    const params = [...Object.values(data), ...Object.values(conditions)];

    const result = await this.run(sql, params);
    return result.changes;
  }

  async createMany<T extends DatabaseRow>(
    tableName: string,
    dataArray: Partial<T>[]
  ): Promise<T[]> {
    const results: T[] = [];
    await this.transaction(async () => {
      for (const data of dataArray) {
        const result = await this.create<T>(tableName, data);
        results.push(result);
      }
    });
    return results;
  }

  async upsert<T extends DatabaseRow>(
    tableName: string,
    data: Partial<T>
  ): Promise<T> {
    const columns = Object.keys(data);
    const placeholders = columns.map(() => "?").join(", ");
    const updateValues = columns
      .map((col) => `${col} = excluded.${col}`)
      .join(", ");

    const sql = `INSERT INTO ${tableName} (${columns.join(", ")}) 
                 VALUES (${placeholders})
                 ON CONFLICT (id) DO UPDATE SET ${updateValues}`;

    const params = Object.values(data);
    const result = await this.run(sql, params);

    return { id: result.lastInsertRowid, ...data } as T;
  }

  async upsertWithCoalesce<T extends DatabaseRow>(
    tableName: string,
    data: Partial<T>
  ): Promise<T> {
    const columns = Object.keys(data);
    const placeholders = columns.map(() => "?").join(", ");
    const updateValues = columns
      .map((col) => `${col} = COALESCE(excluded.${col}, ${tableName}.${col})`)
      .join(", ");

    const sql = `INSERT INTO ${tableName} (${columns.join(", ")}) 
                 VALUES (${placeholders})
                 ON CONFLICT (id) DO UPDATE SET ${updateValues}`;

    const params = Object.values(data);
    const result = await this.run(sql, params);

    return { id: result.lastInsertRowid, ...data } as T;
  }

  async count(
    tableName: string,
    conditions: WhereConditions = {}
  ): Promise<number> {
    let sql = `SELECT COUNT(*) as count FROM ${tableName}`;
    const params: any[] = [];

    if (Object.keys(conditions).length > 0) {
      const whereClause = Object.entries(conditions)
        .map(([key]) => `${key} = ?`)
        .join(" AND ");
      sql += ` WHERE ${whereClause}`;
      params.push(...Object.values(conditions));
    }

    const result = await this.get<{ count: number }>(sql, params);
    return result?.count || 0;
  }

  async exists(
    tableName: string,
    conditions: WhereConditions
  ): Promise<boolean> {
    const count = await this.count(tableName, conditions);
    return count > 0;
  }

  async findOrCreate<T extends DatabaseRow>(
    tableName: string,
    conditions: WhereConditions,
    defaults: Partial<T> = {}
  ): Promise<{ record: T; created: boolean }> {
    const existing = await this.findOne<T>(tableName, { where: conditions });

    if (existing) {
      return { record: existing, created: false };
    }

    const record = await this.create<T>(tableName, {
      ...conditions,
      ...defaults,
    });
    return { record, created: true };
  }

  async findOne<T extends DatabaseRow>(
    tableName: string,
    options: QueryOptions
  ): Promise<T | null> {
    const results = await this.findAll<T>(tableName, { ...options, limit: 1 });
    return results[0] || null;
  }

  async bulkCreate<T extends DatabaseRow>(
    tableName: string,
    records: Partial<T>[]
  ): Promise<T[]> {
    const results: T[] = [];

    await this.transaction(async () => {
      for (const record of records) {
        const result = await this.create<T>(tableName, record);
        results.push(result);
      }
    });

    return results;
  }

  async bulkUpdate<T extends DatabaseRow>(
    tableName: string,
    records: Array<{ id: string | number } & Partial<T>>
  ): Promise<number> {
    let totalChanges = 0;

    await this.transaction(async () => {
      for (const record of records) {
        const { id, ...data } = record;
        const result = await this.update<T>(tableName, id, data);
        if (result) totalChanges++;
      }
    });

    return totalChanges;
  }

  async increment<T extends DatabaseRow>(
    tableName: string,
    id: string | number,
    field: keyof T,
    value: number = 1
  ): Promise<T | null> {
    const sql = `UPDATE ${tableName} SET ${String(field)} = ${String(field)} + ? WHERE id = ?`;
    await this.run(sql, [value, id]);
    return this.findById<T>(tableName, id);
  }

  async decrement<T extends DatabaseRow>(
    tableName: string,
    id: string | number,
    field: keyof T,
    value: number = 1
  ): Promise<T | null> {
    return this.increment<T>(tableName, id, field, -value);
  }

  // Création de table
  createTable(tableName: string, columns: TableSchema): QueryResult {
    const columnDefs = Object.entries(columns)
      .map(([name, type]) => `${name} ${type}`)
      .join(", ");

    const sql = `CREATE TABLE IF NOT EXISTS ${tableName} (${columnDefs})`;
    return this.run(sql);
  }

  // Gestion des transactions
  transaction<T>(fn: () => T): T {
    try {
      this.db.exec("BEGIN TRANSACTION");
      const result = fn();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  // Méthodes de gestion du cycle de vie
  close(): void {
    this.prepared.clear();
    if (this.syncManager) {
      this.syncManager.destroy();
    }
    this.db.close();
  }

  get isOpen(): boolean {
    return !this.db.readonly;
  }

  get name(): string {
    return this.db.name;
  }

  // Méthodes spécifiques à SQLite
  pragma(name: string, value?: any): any {
    if (value !== undefined) {
      return this.get(`PRAGMA ${name} = ${value}`);
    }
    return this.get(`PRAGMA ${name}`);
  }

  backup(destination: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.db
          .backup(destination)
          .then(() => resolve())
          .catch(reject);
      } catch (error) {
        reject(error);
      }
    });
  }
}

// Classe de synchronisation intégrée
class SyncManager {
  private orm: SimpleORM;
  private config: SyncConfig;
  private syncStatus: SyncStatus;
  private syncQueue: SyncQueue;
  private websocket: WebSocket | null = null;
  private syncTimer: number | null = null;
  private backoffDelay: number = 1000;

  constructor(orm: SimpleORM, config: SyncConfig) {
    this.orm = orm;
    this.config = config;
    this.syncQueue = new SyncQueue();
    this.syncStatus = {
      isOnline: this.isInBrowser() ? navigator.onLine : true,
      lastSync: null,
      pendingOperations: 0,
      isSyncing: false,
      errors: [],
    };

    this.initializeSyncTables();
    this.setupEventListeners();

    if (config.enableRealtime) {
      this.connectWebSocket();
    }

    if (config.syncInterval && config.syncInterval > 0) {
      this.startPeriodicSync();
    }
  }

  private isInBrowser(): boolean {
    console.log("je suis ici");
    const teste =
      typeof window !== "undefined" && typeof navigator !== "undefined";
    console.log("j'ai pu traverser", teste);
    return teste;
  }

  private async initializeSyncTables(): Promise<void> {
    try {
      // Créer la table des opérations de synchronisation
      await this.orm.exec(`
        CREATE TABLE IF NOT EXISTS _sync_operations (
          id TEXT PRIMARY KEY,
          operation TEXT NOT NULL,
          table_name TEXT NOT NULL,
          record_id TEXT NOT NULL,
          data TEXT,
          timestamp INTEGER NOT NULL,
          version INTEGER NOT NULL,
          client_id TEXT NOT NULL,
          synced INTEGER DEFAULT 0,
          retry_count INTEGER DEFAULT 0
        )
      `);

      // Créer les index pour améliorer les performances
      await this.orm.exec(`
        CREATE INDEX IF NOT EXISTS idx_sync_ops_synced ON _sync_operations(synced);
        CREATE INDEX IF NOT EXISTS idx_sync_ops_timestamp ON _sync_operations(timestamp);
      `);

      // Table pour les métadonnées de synchronisation
      await this.orm.exec(`
        CREATE TABLE IF NOT EXISTS _sync_metadata (
          table_name TEXT PRIMARY KEY,
          last_sync_timestamp INTEGER,
          last_version INTEGER DEFAULT 0
        )
      `);
    } catch (error) {
      console.error(
        "Erreur lors de l'initialisation des tables de synchronisation:",
        error
      );
      throw error;
    }
  }

  private setupEventListeners(): void {
    if (this.isInBrowser()) {
      window.addEventListener("online", () => {
        this.syncStatus.isOnline = true;
        this.processPendingOperations();
      });

      window.addEventListener("offline", () => {
        this.syncStatus.isOnline = false;
      });
    }
  }

  private async connectWebSocket(): Promise<void> {
    if (!this.config.serverUrl || !this.syncStatus.isOnline) return;

    const wsUrl = this.config.serverUrl.replace(/^http/, "ws") + "/realtime";

    try {
      this.websocket = new WebSocket(wsUrl);

      this.websocket.onopen = () => {
        this.backoffDelay = 1000; // Réinitialiser le délai en cas de succès
        if (this.websocket) {
          this.websocket.send(
            JSON.stringify({
              type: "auth",
              clientId: this.config.clientId,
              apiKey: this.config.apiKey,
            })
          );
        }
      };

      this.websocket.onmessage = this.handleWebSocketMessage.bind(this);
      this.websocket.onclose = () => this.scheduleReconnection();
      this.websocket.onerror = () => this.scheduleReconnection();
    } catch (error) {
      console.error("Erreur lors de la connexion WebSocket:", error);
      this.scheduleReconnection();
    }
  }

  private startPeriodicSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    this.syncTimer = setInterval(() => {
      this.processPendingOperations();
    }, this.config.syncInterval || 30000); // Par défaut toutes les 30 secondes
  }

  private scheduleReconnection(): void {
    setTimeout(() => {
      this.connectWebSocket();
      this.backoffDelay = Math.min(this.backoffDelay * 2, 60000); // Max 1 minute
    }, this.backoffDelay);
  }

  private async handleWebSocketMessage(event: MessageEvent): Promise<void> {
    try {
      const data: RealtimeEvent = JSON.parse(event.data);
      await this.handleRealtimeEvent(data);
    } catch (error) {
      console.error("Erreur lors du traitement du message WebSocket:", error);
      this.syncStatus.errors.push(
        error instanceof Error ? error.message : "Erreur inconnue"
      );
    }
  }

  private async handleRealtimeEvent(event: RealtimeEvent): Promise<void> {
    if (event.clientId === this.config.clientId) return; // Ignorer nos propres événements

    try {
      switch (event.type) {
        case "CREATE":
        case "UPDATE":
          await this.orm.run(`UPDATE ${event.table} SET ? WHERE id = ?`, [
            event.record,
            event.record.id,
          ]);
          break;
        case "DELETE":
          await this.orm.run(`DELETE FROM ${event.table} WHERE id = ?`, [
            event.record.id,
          ]);
          break;
      }
    } catch (error) {
      console.error(
        "Erreur lors du traitement de l'événement temps réel:",
        error
      );
      this.syncStatus.errors.push(
        error instanceof Error ? error.message : "Erreur inconnue"
      );
    }
  }

  private async processPendingOperations(): Promise<void> {
    if (!this.syncStatus.isOnline || this.syncStatus.isSyncing) return;

    this.syncStatus.isSyncing = true;
    try {
      const operations = await this.syncQueue.getQueue();
      for (const operation of operations) {
        await this.processOperation(operation);
      }
    } catch (error) {
      console.error(
        "Erreur lors du traitement des opérations en attente:",
        error
      );
    } finally {
      this.syncStatus.isSyncing = false;
    }
  }

  private async processOperation(operation: SyncOperation): Promise<void> {
    try {
      const response = await fetch(`${this.config.serverUrl}/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(operation),
      });

      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      await this.orm.run(
        "UPDATE _sync_operations SET synced = 1 WHERE id = ?",
        [operation.id]
      );
    } catch (error) {
      console.error("Erreur lors de la synchronisation:", error);
      throw error;
    }
  }

  destroy(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }

    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }

    this.syncQueue.clear();
  }
}

type Schema<T extends TableSchema> = {
  [K in keyof T]: TextWithSuffix;
};

// Classe ModelFactory avec support de synchronisation
export class ModelFactory {
  private orm: SimpleORM;

  constructor(orm: SimpleORM) {
    this.orm = orm;
  }

  createModel<T extends DatabaseRow>(
    tableName: string,
    schema: Schema<T>,
    sampleData?: T
  ): ModelClass<T> {
    const orm = this.orm;

    // Génération des métadonnées
    const generateMetadata = (): {
      keys: ModelKeys<T>;
      types: ModelTypes<T>;
    } => {
      const keys: any = {};
      const types: any = {};

      if (sampleData) {
        for (const [key, value] of Object.entries(sampleData)) {
          keys[key] = key;
          types[key] =
            value instanceof Date
              ? "date"
              : typeof value === "boolean"
                ? "boolean"
                : typeof value;
        }
      } else {
        for (const [key, type] of Object.entries(schema)) {
          keys[key] = key;
          types[key] = type.toLowerCase().includes("int")
            ? "number"
            : type.toLowerCase().includes("text")
              ? "string"
              : type.toLowerCase().includes("bool")
                ? "boolean"
                : type.toLowerCase().includes("date")
                  ? "date"
                  : "any";
        }
      }

      return { keys, types };
    };

    const metadata = generateMetadata();

    // Implémentation du Query Builder
    class QueryBuilderImpl implements QueryBuilder<T> {
      private conditions: WhereConditions = {};
      private orderByOptions: OrderByOptions[] = [];
      private limitValue?: number;
      private offsetValue?: number;
      private includeOptions: IncludeOptions[] = [];

      constructor(
        private tableName: string,
        private orm: SimpleORM
      ) {}

      where(conditions: WhereConditions): QueryBuilder<T> {
        this.conditions = { ...this.conditions, ...conditions };
        return this;
      }

      orderBy(
        column: string,
        direction: "ASC" | "DESC" = "ASC"
      ): QueryBuilder<T> {
        this.orderByOptions.push({ column, direction });
        return this;
      }

      limit(limit: number): QueryBuilder<T> {
        this.limitValue = limit;
        return this;
      }

      offset(offset: number): QueryBuilder<T> {
        this.offsetValue = offset;
        return this;
      }

      include(options: IncludeOptions | IncludeOptions[]): QueryBuilder<T> {
        this.includeOptions = this.includeOptions.concat(
          Array.isArray(options) ? options : [options]
        );
        return this;
      }

      async findAll(): Promise<T[]> {
        return this.orm.findAll<T>(this.tableName, {
          where: this.conditions,
          orderBy: this.orderByOptions,
          limit: this.limitValue,
          offset: this.offsetValue,
          include: this.includeOptions,
        });
      }

      async findOne(): Promise<T | null> {
        return this.orm.findOne<T>(this.tableName, {
          where: this.conditions,
          orderBy: this.orderByOptions,
          include: this.includeOptions,
        });
      }

      async count(): Promise<number> {
        return this.orm.count(this.tableName, this.conditions);
      }
    }

    // Classe de modèle générée
    class GeneratedModel implements ModelInstance<T> {
      [key: string]: any;
      private data: Partial<T>;

      constructor(data: Partial<T> = {}) {
        this.data = data;
        Object.assign(this, data);
      }

      async save(): Promise<T> {
        if (this.data.id) {
          const updated = await orm.update<T>(
            tableName,
            this.data.id as string | number,
            this.data
          );
          if (updated) {
            Object.assign(this, updated);
            return updated;
          }
          throw new Error("Failed to update record");
        } else {
          const created = await orm.create<T>(tableName, this.data);
          Object.assign(this, created);
          return created;
        }
      }

      async delete(): Promise<boolean> {
        if (!this.data.id) {
          throw new Error("Cannot delete unsaved record");
        }
        return orm.delete(tableName, this.data.id as string | number);
      }

      static async createTable(): Promise<QueryResult> {
        return orm.createTable(tableName, schema);
      }

      static async createMany(dataArray: Partial<T>[]): Promise<T[]> {
        return orm.createMany<T>(tableName, dataArray);
      }
      static async create(data: Partial<T>): Promise<T> {
        return orm.create<T>(tableName, data);
      }

      static async findAll(options?: QueryOptions): Promise<T[]> {
        return orm.findAll<T>(tableName, options);
      }

      static async findById(
        id: string | number,
        options?: { include?: IncludeOptions | IncludeOptions[] }
      ): Promise<T | null> {
        return orm.findById<T>(tableName, id);
      }

      static async findOne(options: QueryOptions): Promise<T | null> {
        return orm.findOne<T>(tableName, options);
      }

      static async update(
        id: string | number,
        data: Partial<T>
      ): Promise<T | null> {
        return orm.update<T>(tableName, id, data);
      }

      static async delete(id: string | number): Promise<boolean> {
        return orm.delete(tableName, id);
      }

      static async exists(conditions: WhereConditions): Promise<boolean> {
        return orm.exists(tableName, conditions);
      }

      static where(conditions: WhereConditions): QueryBuilder<T> {
        return new QueryBuilderImpl(tableName, orm).where(conditions);
      }

      static orderBy(
        column: string,
        direction?: "ASC" | "DESC"
      ): QueryBuilder<T> {
        return new QueryBuilderImpl(tableName, orm).orderBy(column, direction);
      }

      static limit(limit: number): QueryBuilder<T> {
        return new QueryBuilderImpl(tableName, orm).limit(limit);
      }

      static offset(offset: number): QueryBuilder<T> {
        return new QueryBuilderImpl(tableName, orm).offset(offset);
      }

      static include(
        options: IncludeOptions | IncludeOptions[]
      ): QueryBuilder<T> {
        return new QueryBuilderImpl(tableName, orm).include(options);
      }
      static async updateWhere(
        conditions: WhereConditions,
        data: Partial<T>
      ): Promise<number> {
        return orm.updateWhere<T>(tableName, conditions, data);
      }
      static async deleteWhere(conditions: WhereConditions): Promise<number> {
        return orm.deleteWhere(tableName, conditions);
      }

      static async upsert(data: Partial<T>): Promise<T> {
        return orm.upsert<T>(tableName, data);
      }
      static async upsertWithCoalesce(data: Partial<T>): Promise<T> {
        return orm.upsertWithCoalesce<T>(tableName, data);
      }
    }

    // Ajouter les métadonnées
    Object.assign(GeneratedModel, {
      ...metadata,
      tableName,
      orm,
    });

    return GeneratedModel as any as ModelClass<T>;
  }
}

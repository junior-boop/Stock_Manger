import Database from "better-sqlite3";

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
  findAll(): T[];
  findOne(): T | null;
  count(): number;
}

// Interface pour les instances de modèle
export interface ModelInstance<T extends DatabaseRow> extends Partial<T> {
  save(): T;
  delete(): boolean;
}

// Interface pour les classes de modèle avec métadonnées
export interface ModelClass<T extends DatabaseRow> extends ModelWithMeta<T> {
  new (data?: Partial<T>): ModelInstance<T>;
  createTable(): QueryResult;
  create(data: Partial<T>): T;
  findAll(options?: QueryOptions): T[];
  findById(
    id: string | number,
    options?: { include?: IncludeOptions | IncludeOptions[] }
  ): T | null;
  findOne(options: QueryOptions): T | null;
  update(id: string | number, data: Partial<T>): T | null;
  delete(id: string | number): boolean;
  deleteWhere(conditions: WhereConditions): number;
  upsert(data: Partial<T>): T;
  upsertWithCoalesce(data: Partial<T>): T;
  // Nouvelles méthodes ajoutées
  exists(conditions: WhereConditions): boolean;
  createMany(dataArray: Partial<T>[]): T[];
  updateWhere(conditions: WhereConditions, data: Partial<T>): number;
  increment(id: string | number, column: string, value?: number): T | null;
  decrement(id: string | number, column: string, value?: number): T | null;
  findOrCreate(
    conditions: WhereConditions,
    defaults?: Partial<T>
  ): { record: T; created: boolean };
  // Query Builder methods
  where(conditions: WhereConditions): QueryBuilder<T>;
  orderBy(column: string, direction?: "ASC" | "DESC"): QueryBuilder<T>;
  limit(limit: number): QueryBuilder<T>;
  offset(offset: number): QueryBuilder<T>;
  include(options: IncludeOptions | IncludeOptions[]): QueryBuilder<T>;
  orm: SimpleORM;
}

// SimpleORM.ts adaptée pour better-sqlite3
class SimpleORM {
  private db: Database.Database;
  private prepared: Map<string, Database.Statement> = new Map();

  constructor(dbPath: string, options?: Database.Options) {
    this.db = new Database(dbPath, options);
  }

  // Méthode pour obtenir ou créer un statement préparé
  private getStatement(sql: string): any {
    if (!this.prepared.has(sql)) {
      this.prepared.set(sql, this.db.prepare(sql));
    }
    return this.prepared.get(sql)!;
  }

  private sanitizeParams(params: any[]): any[] {
    return params.map((param) => {
      // Gérer les valeurs null/undefined
      if (param === null || param === undefined) {
        return null;
      }

      // Gérer les objets Date
      if (param instanceof Date) {
        return param.toISOString();
      }

      // Gérer les booléens (SQLite utilise 0/1)
      if (typeof param === "boolean") {
        return param ? 1 : 0;
      }

      // Gérer les objets (les convertir en JSON)
      if (typeof param === "object" && param !== null) {
        return JSON.stringify(param);
      }

      // Retourner les autres types tels quels
      return param;
    });
  }

  query<T = DatabaseRow>(sql: string, params: any[] = []): T[] {
    try {
      const sanitizedParams = this.sanitizeParams(params);
      const stmt = this.getStatement(sql);

      // Pour better-sqlite3, utiliser all() pour plusieurs résultats
      if (stmt.all) {
        return stmt.all(sanitizedParams) as T[];
      }

      // Fallback pour d'autres implémentations
      const result = stmt.getAsObject ? stmt.getAsObject(sanitizedParams) : [];
      return Array.isArray(result) ? result : [result].filter(Boolean);
    } catch (error) {
      console.error("Query error:", error, "SQL:", sql, "Params:", params);
      throw error;
    }
  }

  // Méthode pour exécuter une seule ligne
  get<T = DatabaseRow>(sql: string, params: any[] = []): T | null {
    try {
      const sanitizedParams = this.sanitizeParams(params);
      const stmt = this.getStatement(sql);

      // Pour better-sqlite3, utiliser get() pour un seul résultat
      if (stmt.get) {
        return (stmt.get(sanitizedParams) as T) || null;
      }

      // Fallback pour d'autres implémentations
      stmt.bind(sanitizedParams);
      if (stmt.step()) {
        const result = stmt.getAsObject();
        stmt.reset();
        return result as T;
      }
      stmt.reset();
      return null;
    } catch (error) {
      console.error("Get error:", error, "SQL:", sql, "Params:", params);
      throw error;
    }
  }

  // Méthode pour exécuter des requêtes qui ne retournent pas de données
  run(sql: string, params: any[] = []): QueryResult {
    try {
      const sanitizedParams = this.sanitizeParams(params);
      const stmt = this.getStatement(sql);

      // Pour better-sqlite3
      if (stmt.run) {
        const result = stmt.run(sanitizedParams);
        return {
          lastInsertRowid: result.lastInsertRowid,
          changes: result.changes,
        };
      }

      // Fallback pour sql.js ou autres implémentations
      stmt.run(sanitizedParams);

      // Simuler lastInsertRowid pour sql.js
      const lastIdResult = this.db.exec("SELECT last_insert_rowid() as id");
      const lastInsertRowid = lastIdResult[0]?.values[0]?.[0] || 0;

      // Simuler changes pour sql.js
      const changesResult = this.db.exec("SELECT changes() as changes");
      const changes = changesResult[0]?.values[0]?.[0] || 0;

      return {
        lastInsertRowid: lastInsertRowid as number,
        changes: changes as number,
      };
    } catch (error) {
      console.error("Run error:", error, "SQL:", sql, "Params:", params);
      throw error;
    }
  }

  // Ajoutez aussi une méthode pour sauvegarder (qui semble manquer)
  private saveDatabase(): void {
    // Cette méthode semble être appelée mais n'est pas définie
    // Pour better-sqlite3, la sauvegarde est automatique
    // Pour sql.js, vous devriez implémenter la logique de sauvegarde
    if (typeof (this.db as any).export === "function") {
      // Logic pour sql.js
      try {
        const data = (this.db as any).export();
        // Sauvegarder les données selon vos besoins (localStorage, fichier, etc.)
        console.log("Database saved");
      } catch (error) {
        console.warn("Could not save database:", error);
      }
    }
    // Pour better-sqlite3, rien à faire, la sauvegarde est automatique
  }

  // Méthode pour les transactions (simplifiée pour sql.js)
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

  // Exécuter plusieurs statements SQL (DDL)
  exec(sql: string): void {
    try {
      this.db.exec(sql);
      this.saveDatabase(); // Sauvegarder après exec
    } catch (error) {
      console.error("Exec error:", error);
      throw error;
    }
  }

  // Fermer la connexion
  close(): void {
    this.saveDatabase(); // Sauvegarder avant fermeture
    this.prepared.clear();
    this.db.close();
  }

  // Méthodes compatibles avec better-sqlite3 (stubs)
  pragma(name: string, value?: string | number): any {
    console.warn("pragma() not fully supported with sql.js");
    return null;
  }

  backup(destination: string): void {
    console.warn("backup() not supported with sql.js in browser environment");
  }

  get isOpen(): boolean {
    return this.db !== null;
  }

  get name(): string {
    return "sql.js-database";
  }
}

export abstract class Model {
  protected tableName: string;
  protected orm: SimpleORM;
  protected attributes: DatabaseRow;

  constructor(tableName: string, orm: SimpleORM) {
    this.tableName = tableName;
    this.orm = orm;
    this.attributes = {};
  }

  // Créer la table
  static createTable(
    tableName: string,
    columns: TableSchema,
    orm: SimpleORM
  ): QueryResult {
    const columnDefs = Object.entries(columns)
      .map(([name, type]) => `${name} ${type}`)
      .join(", ");

    const sql = `CREATE TABLE IF NOT EXISTS ${tableName} (${columnDefs})`;
    return orm.run(sql);
  }

  // Insérer un nouvel enregistrement
  static create<T extends DatabaseRow>(
    tableName: string,
    data: Partial<T>,
    orm: SimpleORM
  ): T {
    const columns = Object.keys(data).join(", ");
    const placeholders = Object.keys(data)
      .map(() => "?")
      .join(", ");
    const values = Object.values(data);

    const sql = `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders})`;
    const result = orm.run(sql, values);

    return { id: result.lastInsertRowid, ...data } as T;
  }

  // Insérer plusieurs enregistrements (batch insert)
  static createMany<T extends DatabaseRow>(
    tableName: string,
    dataArray: Partial<T>[],
    orm: SimpleORM
  ): T[] {
    if (dataArray.length === 0) return [];

    const results: T[] = [];

    // Utiliser une transaction pour l'efficacité
    orm.transaction(() => {
      for (const data of dataArray) {
        const result = this.create<T>(tableName, data, orm);
        results.push(result);
      }
    });

    return results;
  }

  // Trouver tous les enregistrements avec options avancées
  static findAll<T extends DatabaseRow>(
    tableName: string,
    orm: SimpleORM,
    options: QueryOptions = {}
  ): T[] {
    const { where = {}, orderBy, limit, offset, include } = options;

    let sql = `SELECT * FROM ${tableName}`;
    let params: any[] = [];

    // WHERE clause
    if (Object.keys(where).length > 0) {
      const whereClause = Object.keys(where)
        .map((key) => `${key} = ?`)
        .join(" AND ");
      sql += ` WHERE ${whereClause}`;
      params = Object.values(where);
    }

    // ORDER BY clause
    if (orderBy) {
      const orderByArray = Array.isArray(orderBy) ? orderBy : [orderBy];
      const orderClauses = orderByArray
        .map((order) => `${order.column} ${order.direction || "ASC"}`)
        .join(", ");
      sql += ` ORDER BY ${orderClauses}`;
    }

    // LIMIT clause
    if (limit) {
      sql += ` LIMIT ${limit}`;
    }

    // OFFSET clause
    if (offset) {
      sql += ` OFFSET ${offset}`;
    }

    let results = orm.query<T>(sql, params);

    // Handle includes (relations)
    if (include && results.length > 0) {
      results = this.handleIncludes<T>(tableName, results, include, orm);
    }

    return results;
  }

  // Trouver un enregistrement par ID avec options
  static findById<T extends DatabaseRow>(
    tableName: string,
    id: string | number,
    orm: SimpleORM,
    options: { include?: IncludeOptions | IncludeOptions[] } = {}
  ): T | null {
    const { include } = options;

    const sql = `SELECT * FROM ${tableName} WHERE id = ?`;
    let result = orm.get<T>(sql, [id]);

    // Handle includes
    if (result && include) {
      const results = this.handleIncludes<T>(tableName, [result], include, orm);
      result = results[0];
    }

    return result;
  }

  // Trouver un seul enregistrement avec options
  static findOne<T extends DatabaseRow>(
    tableName: string,
    options: QueryOptions,
    orm: SimpleORM
  ): T | null {
    const { where = {}, orderBy, include } = options;

    const whereClause = Object.keys(where)
      .map((key) => `${key} = ?`)
      .join(" AND ");
    let sql = `SELECT * FROM ${tableName} WHERE ${whereClause}`;
    const params = Object.values(where);

    // ORDER BY clause
    if (orderBy) {
      const orderByArray = Array.isArray(orderBy) ? orderBy : [orderBy];
      const orderClauses = orderByArray
        .map((order) => `${order.column} ${order.direction || "ASC"}`)
        .join(", ");
      sql += ` ORDER BY ${orderClauses}`;
    }

    sql += " LIMIT 1";

    let result = orm.get<T>(sql, params);

    // Handle includes
    if (result && include) {
      const results = this.handleIncludes<T>(tableName, [result], include, orm);
      result = results[0];
    }

    return result;
  }

  // Vérifier si un enregistrement existe
  static exists(
    tableName: string,
    conditions: WhereConditions,
    orm: SimpleORM
  ): boolean {
    const whereClause = Object.keys(conditions)
      .map((key) => `${key} = ?`)
      .join(" AND ");
    const sql = `SELECT 1 FROM ${tableName} WHERE ${whereClause} LIMIT 1`;
    const params = Object.values(conditions);

    const result = orm.get(sql, params);
    return result !== null;
  }

  // Mettre à jour un enregistrement
  static update<T extends DatabaseRow>(
    tableName: string,
    id: string | number,
    data: Partial<T>,
    orm: SimpleORM
  ): T | null {
    const setClause = Object.keys(data)
      .map((key) => `${key} = ?`)
      .join(", ");
    const sql = `UPDATE ${tableName} SET ${setClause} WHERE id = ?`;
    const params = [...Object.values(data), id];

    orm.run(sql, params);
    return this.findById<T>(tableName, id, orm);
  }

  // Mettre à jour avec conditions
  static updateWhere<T extends DatabaseRow>(
    tableName: string,
    conditions: WhereConditions,
    data: Partial<T>,
    orm: SimpleORM
  ): number {
    const setClause = Object.keys(data)
      .map((key) => `${key} = ?`)
      .join(", ");
    const whereClause = Object.keys(conditions)
      .map((key) => `${key} = ?`)
      .join(" AND ");

    const sql = `UPDATE ${tableName} SET ${setClause} WHERE ${whereClause}`;
    const params = [...Object.values(data), ...Object.values(conditions)];

    const result = orm.run(sql, params);
    return result.changes;
  }

  // Incrémenter une colonne numérique
  static increment<T extends DatabaseRow>(
    tableName: string,
    id: string | number,
    column: string,
    value: number = 1,
    orm: SimpleORM
  ): T | null {
    const sql = `UPDATE ${tableName} SET ${column} = ${column} + ? WHERE id = ?`;
    orm.run(sql, [value, id]);
    return this.findById<T>(tableName, id, orm);
  }

  // Décrémenter une colonne numérique
  static decrement<T extends DatabaseRow>(
    tableName: string,
    id: string | number,
    column: string,
    value: number = 1,
    orm: SimpleORM
  ): T | null {
    const sql = `UPDATE ${tableName} SET ${column} = ${column} - ? WHERE id = ?`;
    orm.run(sql, [value, id]);
    return this.findById<T>(tableName, id, orm);
  }

  // Trouver ou créer un enregistrement
  static findOrCreate<T extends DatabaseRow>(
    tableName: string,
    conditions: WhereConditions,
    defaults: Partial<T> = {},
    orm: SimpleORM
  ): { record: T; created: boolean } {
    const existing = this.findOne<T>(tableName, { where: conditions }, orm);

    if (existing) {
      return { record: existing, created: false };
    }

    const newRecord = this.create<T>(
      tableName,
      { ...conditions, ...defaults },
      orm
    );
    return { record: newRecord, created: true };
  }

  // Supprimer un enregistrement
  static delete(
    tableName: string,
    id: string | number,
    orm: SimpleORM
  ): boolean {
    const sql = `DELETE FROM ${tableName} WHERE id = ?`;
    const result = orm.run(sql, [id]);
    return result.changes > 0;
  }

  // Supprimer avec conditions
  static deleteWhere(
    tableName: string,
    conditions: WhereConditions,
    orm: SimpleORM
  ): number {
    const whereClause = Object.keys(conditions)
      .map((key) => `${key} = ?`)
      .join(" AND ");
    const sql = `DELETE FROM ${tableName} WHERE ${whereClause}`;
    const params = Object.values(conditions);

    const result = orm.run(sql, params);
    return result.changes;
  }

  // INSERT OR REPLACE (Upsert)
  static upsert<T extends DatabaseRow>(
    tableName: string,
    data: Partial<T>,
    orm: SimpleORM
  ): T {
    const columns = Object.keys(data).join(", ");
    const placeholders = Object.keys(data)
      .map(() => "?")
      .join(", ");
    const values = Object.values(data);

    const sql = `INSERT OR REPLACE INTO ${tableName} (${columns}) VALUES (${placeholders})`;
    const result = orm.run(sql, values);

    return { id: result.lastInsertRowid || (data as any).id, ...data } as T;
  }

  static upsertWithCoalesce<T extends DatabaseRow>(
    tableName: string,
    data: Partial<T>,
    orm: SimpleORM
  ): T {
    const columns = Object.keys(data);
    const values = Object.values(data);

    if ((data as any).id !== undefined) {
      const targetId = (data as any).id;
      const nonIdColumns = columns.filter((col) => col !== "id");
      const nonIdValues = nonIdColumns.map((col) => (data as any)[col]);

      // Utiliser COALESCE pour préserver l'ID existant ou utiliser le nouveau
      const coalescePlaceholders = nonIdColumns.map(() => "?").join(", ");
      const allColumns = `id, ${nonIdColumns.join(", ")}`;
      const allPlaceholders = `COALESCE((SELECT id FROM ${tableName} WHERE id = ?), ?), ${coalescePlaceholders}`;

      const sql = `INSERT OR REPLACE INTO ${tableName} (${allColumns}) VALUES (${allPlaceholders})`;
      const params = [targetId, targetId, ...nonIdValues];

      const result = orm.run(sql, params);
      return { id: targetId, ...data } as T;
    }

    // Insertion normale
    const placeholders = columns.map(() => "?").join(", ");
    const sql = `INSERT OR REPLACE INTO ${tableName} (${columns.join(", ")}) VALUES (${placeholders})`;
    const result = orm.run(sql, values);
    return { id: result.lastInsertRowid, ...data } as T;
  }

  // Compter les enregistrements
  static count(
    tableName: string,
    conditions: WhereConditions = {},
    orm: SimpleORM
  ): number {
    let sql = `SELECT COUNT(*) as count FROM ${tableName}`;
    let params: any[] = [];

    if (Object.keys(conditions).length > 0) {
      const whereClause = Object.keys(conditions)
        .map((key) => `${key} = ?`)
        .join(" AND ");
      sql += ` WHERE ${whereClause}`;
      params = Object.values(conditions);
    }

    const result = orm.get<{ count: number }>(sql, params);
    return result?.count || 0;
  }

  // Méthode pour gérer les relations (includes) - Synchrone maintenant
  static handleIncludes<T extends DatabaseRow>(
    tableName: string,
    results: T[],
    include: IncludeOptions | IncludeOptions[],
    orm: SimpleORM
  ): T[] {
    const includeArray = Array.isArray(include) ? include : [include];

    for (const includeOption of includeArray) {
      const {
        model: includeTable,
        foreignKey,
        localKey = "id",
        as,
      } = includeOption;
      const relationName = as || includeTable;

      // Récupérer les IDs uniques pour éviter les requêtes multiples (optimisation N+1)
      const ids = [
        ...new Set(
          results.map((row) => (row as any)[localKey]).filter(Boolean)
        ),
      ];

      if (ids.length === 0) continue;

      // Requête pour récupérer les données liées
      const placeholders = ids.map(() => "?").join(", ");
      const relatedSql = `SELECT * FROM ${includeTable} WHERE ${foreignKey} IN (${placeholders})`;
      const relatedData = orm.query(relatedSql, ids);

      // Grouper les données liées par foreign key
      const relatedMap = new Map();
      relatedData.forEach((item) => {
        const key = (item as any)[foreignKey];
        if (!relatedMap.has(key)) {
          relatedMap.set(key, []);
        }
        relatedMap.get(key).push(item);
      });

      // Attacher les données liées aux résultats principaux
      results.forEach((row) => {
        const localId = (row as any)[localKey];
        (row as any)[relationName] = relatedMap.get(localId) || [];
      });
    }

    return results;
  }
}

// Classe pour créer des modèles spécifiques avec métadonnées et Query Builder
class ModelFactory {
  private orm: SimpleORM;

  constructor(orm: SimpleORM) {
    this.orm = orm;
  }

  createModel<T extends DatabaseRow>(
    tableName: string,
    schema: TableSchema = {},
    sampleData?: T
  ): ModelClass<T> {
    const orm = this.orm;

    // Générer les métadonnées à partir du schéma ou des données d'exemple
    const generateMetadata = (): {
      keys: ModelKeys<T>;
      types: ModelTypes<T>;
    } => {
      const keys = {} as ModelKeys<T>;
      const types = {} as ModelTypes<T>;

      // Utiliser les clés du schéma si disponible
      if (Object.keys(schema).length > 0) {
        Object.keys(schema).forEach((key) => {
          (keys as any)[key] = key;

          // Inférer le type à partir du schéma SQL
          const sqlType = schema[key].toUpperCase();
          if (sqlType.includes("INTEGER") || sqlType.includes("INT")) {
            (types as any)[key] = "number";
          } else if (sqlType.includes("TEXT") || sqlType.includes("VARCHAR")) {
            (types as any)[key] = "string";
          } else if (sqlType.includes("BOOLEAN") || sqlType.includes("BOOL")) {
            (types as any)[key] = "boolean";
          } else if (sqlType.includes("DATE") || sqlType.includes("TIME")) {
            (types as any)[key] = "date";
          } else {
            (types as any)[key] = "any";
          }
        });
      }

      // Utiliser les données d'exemple si fournies
      if (sampleData) {
        Object.keys(sampleData).forEach((key) => {
          (keys as any)[key] = key;

          const value = (sampleData as any)[key];
          if (typeof value === "string") {
            (types as any)[key] = "string";
          } else if (typeof value === "number") {
            (types as any)[key] = "number";
          } else if (typeof value === "boolean") {
            (types as any)[key] = "boolean";
          } else if (value instanceof Date) {
            (types as any)[key] = "date";
          } else {
            (types as any)[key] = "any";
          }
        });
      }

      return { keys, types };
    };

    const metadata = generateMetadata();

    // Query Builder Implementation - Maintenant synchrone
    class QueryBuilderImpl implements QueryBuilder<T> {
      private options: QueryOptions = {};

      constructor(
        private tableName: string,
        private orm: SimpleORM
      ) {}

      where(conditions: WhereConditions): QueryBuilder<T> {
        this.options.where = { ...this.options.where, ...conditions };
        return this;
      }

      orderBy(
        column: string,
        direction: "ASC" | "DESC" = "ASC"
      ): QueryBuilder<T> {
        const orderBy = { column, direction };
        if (this.options.orderBy) {
          this.options.orderBy = Array.isArray(this.options.orderBy)
            ? [...this.options.orderBy, orderBy]
            : [this.options.orderBy, orderBy];
        } else {
          this.options.orderBy = orderBy;
        }
        return this;
      }

      limit(limit: number): QueryBuilder<T> {
        this.options.limit = limit;
        return this;
      }

      offset(offset: number): QueryBuilder<T> {
        this.options.offset = offset;
        return this;
      }

      include(options: IncludeOptions | IncludeOptions[]): QueryBuilder<T> {
        if (this.options.include) {
          const currentIncludes = Array.isArray(this.options.include)
            ? this.options.include
            : [this.options.include];
          const newIncludes = Array.isArray(options) ? options : [options];
          this.options.include = [...currentIncludes, ...newIncludes];
        } else {
          this.options.include = options;
        }
        return this;
      }

      findAll(): T[] {
        return Model.findAll<T>(this.tableName, this.orm, this.options);
      }

      findOne(): T | null {
        return Model.findOne<T>(this.tableName, this.options, this.orm);
      }

      count(): number {
        const { where = {} } = this.options;
        return Model.count(this.tableName, where, this.orm);
      }
    }

    // Classe de modèle générée
    class GeneratedModel implements ModelInstance<T> {
      [key: string]: any;

      constructor(data: Partial<T> = {}) {
        Object.assign(this, data);
      }

      // Méthodes d'instance - Synchrones
      save(): T {
        if (this.id) {
          const result = Model.update<T>(
            tableName,
            this.id,
            this as Partial<T>,
            orm
          );
          if (result) Object.assign(this, result);
          return result!;
        } else {
          const result = Model.create<T>(tableName, this as Partial<T>, orm);
          this.id = result.id;
          Object.assign(this, result);
          return result;
        }
      }

      // Méthodes d'instance - Asynchrones
      async saveAsync(): Promise<T> {
        return new Promise((resolve, reject) => {
          try {
            setImmediate(() => {
              try {
                const result = this.save();
                resolve(result);
              } catch (error) {
                reject(error);
              }
            });
          } catch (error) {
            reject(error);
          }
        });
      }

      delete(): boolean {
        if (this.id) {
          return Model.delete(tableName, this.id, orm);
        }
        return false;
      }

      async deleteAsync(): Promise<boolean> {
        return new Promise((resolve, reject) => {
          try {
            setImmediate(() => {
              try {
                const result = this.delete();
                resolve(result);
              } catch (error) {
                reject(error);
              }
            });
          } catch (error) {
            reject(error);
          }
        });
      }

      // Méthodes statiques - CRUD de base (maintenant synchrones)
      static createTable(): QueryResult {
        return Model.createTable(tableName, schema, orm);
      }

      static create(data: Partial<T>): T {
        return Model.create<T>(tableName, data, orm);
      }

      static createMany(dataArray: Partial<T>[]): T[] {
        return Model.createMany<T>(tableName, dataArray, orm);
      }

      static findAll(options: QueryOptions = {}): T[] {
        return Model.findAll<T>(tableName, orm, options);
      }

      static findById(
        id: string | number,
        options: { include?: IncludeOptions | IncludeOptions[] } = {}
      ): T | null {
        return Model.findById<T>(tableName, id, orm, options);
      }

      static findOne(options: QueryOptions): T | null {
        return Model.findOne<T>(tableName, options, orm);
      }

      static exists(conditions: WhereConditions): boolean {
        return Model.exists(tableName, conditions, orm);
      }

      static findOrCreate(
        conditions: WhereConditions,
        defaults: Partial<T> = {}
      ): { record: T; created: boolean } {
        return Model.findOrCreate<T>(tableName, conditions, defaults, orm);
      }

      static update(id: string | number, data: Partial<T>): T | null {
        return Model.update<T>(tableName, id, data, orm);
      }

      static updateWhere(
        conditions: WhereConditions,
        data: Partial<T>
      ): number {
        return Model.updateWhere<T>(tableName, conditions, data, orm);
      }

      static increment(
        id: string | number,
        column: string,
        value: number = 1
      ): T | null {
        return Model.increment<T>(tableName, id, column, value, orm);
      }

      static decrement(
        id: string | number,
        column: string,
        value: number = 1
      ): T | null {
        return Model.decrement<T>(tableName, id, column, value, orm);
      }

      static delete(id: string | number): boolean {
        return Model.delete(tableName, id, orm);
      }

      static deleteWhere(conditions: WhereConditions): number {
        return Model.deleteWhere(tableName, conditions, orm);
      }

      static upsert(data: Partial<T>): T {
        return Model.upsert<T>(tableName, data, orm);
      }
      static upsertWithCoalesce(data: Partial<T>): T {
        return Model.upsertWithCoalesce<T>(tableName, data, orm);
      }

      static count(conditions: WhereConditions = {}): number {
        return Model.count(tableName, conditions, orm);
      }

      // Query Builder methods - Méthodes fluides
      static where(conditions: WhereConditions): QueryBuilder<T> {
        return new QueryBuilderImpl(tableName, orm).where(conditions);
      }

      static orderBy(
        column: string,
        direction: "ASC" | "DESC" = "ASC"
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

      // Métadonnées exportées
      static keys = metadata.keys;
      static types = metadata.types;
      static tableName = tableName;
      static orm = orm;
    }

    return GeneratedModel as any;
  }
}

// Exports
export { SimpleORM, ModelFactory };

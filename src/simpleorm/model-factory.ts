import { SimpleORM } from "./simpleorm-sync";
import {
  ModelClass,
  DatabaseRow,
  TableSchema,
  QueryBuilder,
  ModelInstance,
  WhereConditions,
  OrderByOptions,
  IncludeOptions,
  QueryOptions,
} from "./types";

export class ModelFactory {
  private orm: SimpleORM;

  constructor(orm: SimpleORM) {
    this.orm = orm;
  }

  createModel<T extends DatabaseRow>(
    tableName: string,
    schema: TableSchema = {}
  ): ModelClass<T> {
    const orm = this.orm;

    // Classe de modèle générée
    class GeneratedModel implements ModelInstance<T> {
      private data: Partial<T>;

      constructor(data: Partial<T> = {}) {
        this.data = { ...data };
      }

      async save(): Promise<T> {
        if ((this.data as any).id) {
          return orm.update(tableName, (this.data as any).id, this.data);
        }
        return orm.create(tableName, this.data);
      }

      async delete(): Promise<boolean> {
        if (!(this.data as any).id) {
          return false;
        }
        return orm.delete(tableName, (this.data as any).id);
      }

      static async findAll(options: QueryOptions = {}): Promise<T[]> {
        return orm.findAll(tableName, options);
      }

      static async findById(id: string | number): Promise<T | null> {
        return orm.findById(tableName, id);
      }

      static async create(data: Partial<T>): Promise<T> {
        return orm.create(tableName, data);
      }

      static async update(
        id: string | number,
        data: Partial<T>
      ): Promise<T | null> {
        return orm.update(tableName, id, data);
      }

      static async delete(id: string | number): Promise<boolean> {
        return orm.delete(tableName, id);
      }

      static createTable(): void {
        const columns = Object.entries(schema)
          .map(([name, type]) => `${name} ${type}`)
          .join(", ");

        orm.exec(`CREATE TABLE IF NOT EXISTS ${tableName} (${columns})`);
      }
    }

    return GeneratedModel as any;
  }
}

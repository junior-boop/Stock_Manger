import type { SimpleORM } from "../simpleorm/simpleorm-sync";

export type Migration = {
  version: number;
  name: string;
  up: (orm: SimpleORM) => void;
};

const SCHEMA_VERSION_TABLE = "_db_schema_version";

function ensureVersionTable(orm: SimpleORM): void {
  orm.exec(
    `CREATE TABLE IF NOT EXISTS ${SCHEMA_VERSION_TABLE} (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      version INTEGER NOT NULL,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
  );
  const row = orm.get<{ version: number }>(
    `SELECT version FROM ${SCHEMA_VERSION_TABLE} WHERE id = 1`,
  );
  if (!row) {
    orm.exec(
      `INSERT INTO ${SCHEMA_VERSION_TABLE} (id, version) VALUES (1, 0)`,
    );
  }
}

function getCurrentVersion(orm: SimpleORM): number {
  const row = orm.get<{ version: number }>(
    `SELECT version FROM ${SCHEMA_VERSION_TABLE} WHERE id = 1`,
  );
  return Number(row?.version ?? 0);
}

function setVersion(orm: SimpleORM, v: number): void {
  orm.exec(
    `UPDATE ${SCHEMA_VERSION_TABLE} SET version = ${v}, updatedAt = CURRENT_TIMESTAMP WHERE id = 1`,
  );
}

function columnExists(orm: SimpleORM, table: string, column: string): boolean {
  const rows = orm.query<{ name: string }>(`PRAGMA table_info(${table})`);
  return Array.isArray(rows) && rows.some((r) => r.name === column);
}

function safeAddColumn(orm: SimpleORM, table: string, column: string, ddlTail: string): void {
  if (columnExists(orm, table, column)) return;
  orm.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddlTail}`);
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: "baseline_alter_columns",
    up: (orm) => {
      safeAddColumn(orm, "devis", "afficherTVA", "INTEGER NOT NULL DEFAULT 1");
      safeAddColumn(orm, "devis", "afficherTVALignes", "INTEGER NOT NULL DEFAULT 1");
      safeAddColumn(orm, "factures", "afficherTVA", "INTEGER NOT NULL DEFAULT 1");
      safeAddColumn(orm, "factures", "afficherTVALignes", "INTEGER NOT NULL DEFAULT 1");
      safeAddColumn(orm, "taches_projet", "dateDebut", "DATETIME");
      safeAddColumn(orm, "taches_projet", "dateEcheance", "DATETIME");
      safeAddColumn(orm, "taches_projet", "description", "TEXT");
      safeAddColumn(orm, "taches_projet", "technicienIds", "TEXT NOT NULL DEFAULT '[]'");
      safeAddColumn(orm, "taches_projet", "ordre", "INTEGER NOT NULL DEFAULT 0");
    },
  },
];

export function runMigrations(orm: SimpleORM): void {
  ensureVersionTable(orm);
  const current = getCurrentVersion(orm);
  const pending = MIGRATIONS
    .filter((m) => m.version > current)
    .sort((a, b) => a.version - b.version);
  if (pending.length === 0) return;
  for (const m of pending) {
    try {
      orm.transaction(() => {
        m.up(orm);
      });
      setVersion(orm, m.version);
      console.info(`[migrations] v${m.version} (${m.name}) appliquée`);
    } catch (e) {
      console.error(`[migrations] échec v${m.version} (${m.name})`, e);
      throw e;
    }
  }
}

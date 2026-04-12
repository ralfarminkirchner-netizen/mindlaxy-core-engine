import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

/**
 * Creates a SQLite database connection. If the database file does not exist
 * it will be created automatically. The DB path can be configured via the
 * `CORE_DB_PATH` environment variable; if not provided a file named
 * `core.db` will be created in the current working directory.
 */
export const DB_PATH: string = process.env.CORE_DB_PATH || path.join(process.cwd(), "core.db");

export const db = new Database(DB_PATH);

/**
 * Initializes the database schema. This function reads the SQL definitions
 * from `schema.sql` and applies them. It is idempotent and can be safely
 * called multiple times.
 */
export function initDB(): void {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(sql);
  // Pragmas improve concurrency and enable foreign key enforcement.
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
}
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

function createDatabase(dbPath) {
  if (dbPath !== ":memory:") {
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
  }

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  return db;
}

function ensureMigrationsTable(db) {
  db.exec(
    `CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    )`
  );
}

function runMigrations(db, migrationsDir) {
  ensureMigrationsTable(db);
  const applied = new Set(
    db
      .prepare("SELECT name FROM _migrations ORDER BY id ASC")
      .all()
      .map((row) => row.name)
  );

  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (applied.has(file)) {
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    db.exec(sql);
    db.prepare(
      "INSERT INTO _migrations (name, applied_at) VALUES (?, ?)"
    ).run(file, new Date().toISOString());
  }
}

function cleanupEvents(db, cutoffIso) {
  return db
    .prepare("DELETE FROM events WHERE created_at < ?")
    .run(cutoffIso).changes;
}

module.exports = { createDatabase, runMigrations, cleanupEvents };

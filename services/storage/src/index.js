const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const defaultDbPath = path.resolve(__dirname, "../../../data/robodevil.db");
const dbPath = process.env.STORAGE_DB_PATH || defaultDbPath;
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

console.log("[storage] Ready", { dbPath });

// TODO: Add IPC interface and schema migrations later.
setInterval(() => {}, 1 << 30);

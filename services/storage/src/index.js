const path = require("path");
const { createDatabase, runMigrations, cleanupEvents } = require("./db");
const { createServer } = require("./server");
const { startHealthPing } = require("../../common/healthPing");

const defaultDbPath = path.resolve(__dirname, "../../../data/robodevil.db");
const dbPath = process.env.STORAGE_DB_PATH || defaultDbPath;
const db = createDatabase(dbPath);
const migrationsDir = path.resolve(__dirname, "../migrations");
runMigrations(db, migrationsDir);

const httpHost = process.env.STORAGE_HTTP_HOST || "127.0.0.1";
const httpPort = Number(process.env.STORAGE_HTTP_PORT || 17172);
const retentionDays = Number(process.env.STORAGE_RETENTION_DAYS || 30);

const server = createServer({ db });
server.listen(httpPort, httpHost, () => {
  console.log("[storage] HTTP listening", { httpHost, httpPort, dbPath });
});

startHealthPing({ name: "storage" });

function cleanupOldEvents() {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const removed = cleanupEvents(db, cutoff.toISOString());
  if (removed > 0) {
    console.log("[storage] Cleanup", { removed });
  }
}

setInterval(cleanupOldEvents, 60 * 60 * 1000);

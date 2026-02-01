const path = require("path");
const { createDatabase, runMigrations, cleanupEvents } = require("./db");
const { createServer } = require("./server");
const { startHealthPing } = require("../../common/healthPing");
const { getConfig } = require("../../common/config");

const config = getConfig();
const defaultDbPath = path.resolve(__dirname, "../../../data/robodevil.db");
const dbPath = config.storage.dbPath || defaultDbPath;
const db = createDatabase(dbPath);
const migrationsDir = path.resolve(__dirname, "../migrations");
runMigrations(db, migrationsDir);

const httpHost = config.storage.httpHost;
const httpPort = Number(config.storage.httpPort || 17172);
const retentionDays = Number(config.storage.retentionDays || 30);

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

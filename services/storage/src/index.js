const path = require("path");
const { createDatabase, runMigrations } = require("./db");
const { createServer } = require("./server");

const defaultDbPath = path.resolve(__dirname, "../../../data/robodevil.db");
const dbPath = process.env.STORAGE_DB_PATH || defaultDbPath;
const db = createDatabase(dbPath);
const migrationsDir = path.resolve(__dirname, "../migrations");
runMigrations(db, migrationsDir);

const httpHost = process.env.STORAGE_HTTP_HOST || "127.0.0.1";
const httpPort = Number(process.env.STORAGE_HTTP_PORT || 17172);

const server = createServer({ db });
server.listen(httpPort, httpHost, () => {
  console.log("[storage] HTTP listening", { httpHost, httpPort, dbPath });
});

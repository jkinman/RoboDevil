const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const { createDatabase, runMigrations, cleanupEvents } = require("../src/db");

test("cleanupEvents removes old rows", () => {
  const db = createDatabase(":memory:");
  const migrationsDir = path.resolve(__dirname, "../migrations");
  runMigrations(db, migrationsDir);

  db.prepare(
    "INSERT INTO events (created_at, type, payload) VALUES (?, ?, ?)"
  ).run("2020-01-01T00:00:00Z", "old", "{}");
  db.prepare(
    "INSERT INTO events (created_at, type, payload) VALUES (?, ?, ?)"
  ).run("2030-01-01T00:00:00Z", "new", "{}");

  const removed = cleanupEvents(db, "2022-01-01T00:00:00Z");
  const count = db.prepare("SELECT COUNT(*) as c FROM events").get().c;

  assert.equal(removed, 1);
  assert.equal(count, 1);
});

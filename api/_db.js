// Turso (hosted SQLite / libSQL) connection and schema.
// Vercel env vars: TURSO_DATABASE_URL (libsql://...turso.io) and TURSO_AUTH_TOKEN.
const { createClient } = require("@libsql/client");

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS votes (
     id     INTEGER PRIMARY KEY AUTOINCREMENT,
     team   TEXT    NOT NULL,
     device TEXT    NOT NULL,
     name   TEXT    NOT NULL DEFAULT '',
     r      TEXT    NOT NULL,
     ts     INTEGER NOT NULL,
     UNIQUE (device, team)
   )`,
  // A reset moves votes here instead of deleting them, so a reset can be undone.
  `CREATE TABLE IF NOT EXISTS votes_archive (
     id       INTEGER PRIMARY KEY AUTOINCREMENT,
     reset_at INTEGER NOT NULL,
     team     TEXT    NOT NULL,
     device   TEXT    NOT NULL,
     name     TEXT    NOT NULL DEFAULT '',
     r        TEXT    NOT NULL,
     ts       INTEGER NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS admin_log (
     id     INTEGER PRIMARY KEY AUTOINCREMENT,
     ts     INTEGER NOT NULL,
     action TEXT    NOT NULL,
     ip     TEXT    NOT NULL,
     ok     INTEGER NOT NULL
   )`,
];

let client = null;
let ready = null;

function db() {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL;
    if (!url) throw new Error("TURSO_DATABASE_URL is not set");
    client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  }
  if (!ready) {
    ready = client.batch(SCHEMA, "write").catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready.then(() => client);
}

async function getMeta(c, k, dflt = null) {
  const rs = await c.execute({ sql: "SELECT v FROM meta WHERE k = ?", args: [k] });
  return rs.rows.length ? rs.rows[0].v : dflt;
}

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Key");
}

function body(req) {
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body || "{}"); } catch (_) { return {}; }
  }
  return req.body && typeof req.body === "object" ? req.body : {};
}

function fail(res, e) {
  console.error("poll api:", e);
  res.setHeader("Cache-Control", "no-store");
  return res.status(500).json({ error: "server error", message: "Server error, please try again" });
}

module.exports = { db, getMeta, cors, body, fail };

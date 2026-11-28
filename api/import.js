// POST /api/import (admin, one-time migration). Body: {text: "team|device|ts|name|r" lines,
// optional first line "#reset_at=<ms>"}. Existing votes (same device + team) are skipped.
const { db, cors, body, fail } = require("./_db");
const { isAdmin } = require("./_admin");

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    const b = body(req);
    if (!isAdmin(req, b)) return res.status(403).json({ error: "forbidden" });
    const stmts = [];
    let resetAt = null;
    for (const line of String(b.text || "").split(/\r?\n/)) {
      if (!line.trim()) continue;
      const m = line.match(/^#reset_at=(\d+)$/);
      if (m) { resetAt = m[1]; continue; }
      const p = line.split("|");
      if (p.length !== 5) return res.status(400).json({ error: "bad line", line });
      stmts.push({
        sql: "INSERT OR IGNORE INTO votes (team, device, name, r, ts) VALUES (?, ?, ?, ?, ?)",
        args: [p[0], p[1], p[3], p[4], Number(p[2])],
      });
    }
    if (resetAt) stmts.push({ sql: "INSERT OR IGNORE INTO meta (k, v) VALUES ('reset_at', ?)", args: [resetAt] });
    const c = await db();
    const before = Number((await c.execute("SELECT COUNT(*) AS n FROM votes")).rows[0].n);
    if (stmts.length) await c.batch(stmts, "write");
    const after = Number((await c.execute("SELECT COUNT(*) AS n FROM votes")).rows[0].n);
    return res.status(200).json({ ok: true, read: stmts.length - (resetAt ? 1 : 0), added: after - before, total: after });
  } catch (e) {
    return fail(res, e);
  }
};

// POST /api/reset (admin) -> moves all votes to votes_archive and starts a new round.
const { db, cors, body, fail } = require("./_db");
const { isAdmin, clientIp } = require("./_admin");

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    const c = await db();
    const ok = isAdmin(req, body(req));
    await c.execute({
      sql: "INSERT INTO admin_log (ts, action, ip, ok) VALUES (?, 'reset', ?, ?)",
      args: [Date.now(), clientIp(req), ok ? 1 : 0],
    });
    if (!ok) {
      await new Promise((r) => setTimeout(r, 500)); // slow down key guessing
      return res.status(403).json({ error: "forbidden" });
    }
    const at = Date.now();
    await c.batch(
      [
        { sql: "INSERT INTO votes_archive (reset_at, team, device, name, r, ts) SELECT ?, team, device, name, r, ts FROM votes", args: [at] },
        "DELETE FROM votes",
        { sql: "INSERT INTO meta (k, v) VALUES ('reset_at', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v", args: [String(at)] },
      ],
      "write"
    );
    return res.status(200).json({ ok: true });
  } catch (e) {
    return fail(res, e);
  }
};

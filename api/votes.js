// GET /api/votes?device=...  -> this device's votes; admin (X-Admin-Key) gets all votes.
const { db, getMeta, cors, fail } = require("./_db");
const { isAdmin } = require("./_admin");

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });
  try {
    const c = await db();
    const admin = isAdmin(req);
    const device = String((req.query && req.query.device) || "").slice(0, 80);
    let rows = [];
    if (admin) {
      rows = (await c.execute("SELECT id, team, device, name, r, ts FROM votes ORDER BY id")).rows;
    } else if (device) {
      rows = (await c.execute({ sql: "SELECT id, team, device, name, r, ts FROM votes WHERE device = ? ORDER BY id", args: [device] })).rows;
    }
    const count = Number((await c.execute("SELECT COUNT(*) AS n FROM votes")).rows[0].n);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      votes: rows.map((v) => ({
        _id: Number(v.id),
        team_id: v.team,
        r: v.r,
        device: v.device,
        name: v.name,
        ts: Number(v.ts),
      })),
      count,
      reset_at: Number(await getMeta(c, "reset_at", 0)),
      admin,
    });
  } catch (e) {
    return fail(res, e);
  }
};

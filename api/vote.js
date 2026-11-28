// POST /api/vote {team_id, r, device, name}. One vote per device per poll, enforced by the DB.
const { db, cors, body, fail } = require("./_db");

const TEAMS = ["speed", "comm", "nobug", "amount", "punct", "ai"];
const BALLOT = /^v2:\d{1,2}=\d{1,3}(,\d{1,2}=\d{1,3})*$/; // "v2:" + "index=score" pairs

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    const b = body(req);
    const team = String(b.team_id || "");
    const r = String(b.r || "");
    const device = String(b.device || "").slice(0, 80);
    const name = String(b.name || "").slice(0, 80);
    if (!TEAMS.includes(team) || !device) return res.status(400).json({ error: "need team_id and device" });
    if (r.length > 2000 || !BALLOT.test(r)) return res.status(400).json({ error: "bad ranking" });

    const c = await db();
    const rs = await c.execute({
      sql: "INSERT OR IGNORE INTO votes (team, device, name, r, ts) VALUES (?, ?, ?, ?, ?)",
      args: [team, device, name, r, Date.now()],
    });
    if (!rs.rowsAffected) return res.status(409).json({ error: "already", message: "Already voted from this device" });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return fail(res, e);
  }
};

const { cors, listBallots, addBallot } = require("./_db");

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const team_id = body.team_id;
    const ranking = body.ranking; // array of names OR compact string in body.r
    const device = String(body.device || "anon").slice(0, 80);
    const name = String(body.name || "").slice(0, 80);
    let r = body.r;
    if (!r && Array.isArray(ranking)) {
      // Client may send ranking as names; store as comma indices only if r provided.
      // Prefer body.r (compact). If only names — store as JSON string of names (short teams ok).
      r = ranking.map(String).join("||");
      // Better: client always sends compact r. Fallback keep names joined.
    }
    if (!team_id || (!r && !(Array.isArray(ranking) && ranking.length))) {
      return res.status(400).json({ error: "need team_id and ranking" });
    }
    const all = await listBallots();
    if (all.some((v) => (v.d || v.device) === device && (v.t || v.team_id) === team_id)) {
      return res.status(409).json({ error: "already", message: "Уже голосовали с этого устройства" });
    }
    const payload = {
      t: team_id,
      r: r || "",
      d: device,
      n: name,
      ts: Date.now(),
    };
    // If client sent name ranking without r, encode positions unknown server-side — store names as || 
    if (!body.r && Array.isArray(ranking)) {
      payload.r = ranking.join("||");
      payload._fmt = "names";
    }
    const saved = await addBallot(payload);
    return res.status(200).json({ ok: true, id: saved._id, total: all.length + 1 });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }
};

const { cors, readStore, writeStore } = require("./_db");

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const team_id = body.team_id;
    const device = String(body.device || "anon").slice(0, 80);
    const name = String(body.name || "").slice(0, 80);
    let r = body.r;
    if (!r && Array.isArray(body.ranking)) {
      r = body.ranking.join("||");
    }
    if (!team_id || !r) {
      return res.status(400).json({ error: "need team_id and ranking" });
    }

    // rentry has no atomic update: two votes saved at the same moment can overwrite
    // each other. So after writing we read back and re-add our vote if it was lost.
    const key = device + ":" + team_id;
    const mine = (v) => (v.d || v.device) === device && (v.t || v.team_id) === team_id;
    const ts = Date.now();
    for (let i = 0; i <= 3; i++) {
      const data = await readStore({ fresh: true });
      data.devices = data.devices && typeof data.devices === "object" ? data.devices : {};
      const existing = data.votes.find(mine);
      if (existing) {
        if (i === 0) return res.status(409).json({ error: "already", message: "Already voted from this device" });
        return res.status(200).json({ ok: true, total: data.votes.length }); // our earlier write survived
      }
      if (i === 3) break; // three writes didn't stick
      data.votes.push({ t: team_id, r: r, d: device, n: name, ts });
      data.devices[key] = { ts, name };
      data.meta = Object.assign({}, data.meta || {}, { updated: Date.now() });
      await writeStore(data);
      // Give a concurrent writer time to land, then check on the next loop pass.
      await new Promise((ok) => setTimeout(ok, 700 + Math.random() * 600));
    }
    return res.status(503).json({ error: "busy", message: "Database is busy, please try again" });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }
};

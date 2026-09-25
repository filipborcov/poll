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

    // retry on rare conflicts
    for (let i = 0; i < 4; i++) {
      const data = await readStore();
      data.votes = Array.isArray(data.votes) ? data.votes : [];
      data.devices = data.devices && typeof data.devices === "object" ? data.devices : {};
      const key = device + ":" + team_id;
      if (data.devices[key] || data.votes.some((v) => (v.d || v.device) === device && (v.t || v.team_id) === team_id)) {
        return res.status(409).json({ error: "already", message: "Уже голосовали с этого устройства" });
      }
      data.votes.push({ t: team_id, r: r, d: device, n: name, ts: Date.now() });
      data.devices[key] = { ts: Date.now(), name };
      data.meta = Object.assign({}, data.meta || {}, { updated: Date.now() });
      try {
        await writeStore(data);
        return res.status(200).json({ ok: true, total: data.votes.length });
      } catch (e) {
        if (i === 3) throw e;
        await new Promise((r) => setTimeout(r, 120 * (i + 1)));
      }
    }
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }
};

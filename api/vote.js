const { readStore, writeStore, cors, token } = require("./_store");

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  try {
    if (!token()) {
      return res.status(503).json({ error: "server_not_configured", message: "POLL_GITHUB_TOKEN missing" });
    }
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const { team_id, ranking, device, name } = body;
    if (!team_id || !Array.isArray(ranking) || ranking.length < 1) {
      return res.status(400).json({ error: "team_id and ranking required" });
    }
    const dev = String(device || "anon").slice(0, 80);
    const key = dev + ":" + team_id;

    // retry on sha conflict
    let lastErr;
    for (let i = 0; i < 5; i++) {
      try {
        const { data, sha } = await readStore();
        data.devices = data.devices || {};
        if (data.devices[key] || (data.votes || []).some((v) => v.device === dev && v.team_id === team_id)) {
          return res.status(409).json({ error: "already_voted", message: "Уже голосовали с этого устройства" });
        }
        data.votes = data.votes || [];
        data.votes.push({
          team_id,
          ranking,
          ts: Date.now(),
          device: dev,
          name: String(name || "").slice(0, 80),
        });
        data.devices[key] = { ts: Date.now(), name: String(name || "").slice(0, 80) };
        data.meta = Object.assign({}, data.meta || {}, { updated: Date.now() });
        await writeStore(data, sha);
        return res.status(200).json({ ok: true, total: data.votes.length });
      } catch (e) {
        lastErr = e;
        if (e.status !== 409) break;
        await new Promise((r) => setTimeout(r, 150 * (i + 1)));
      }
    }
    throw lastErr || new Error("vote failed");
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message });
  }
};

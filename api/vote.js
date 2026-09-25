const { readStore, writeStore, cors, token } = require("./_store");

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    if (!token()) {
      return res.status(503).json({
        error: "no_db",
        message: "Добавьте POLL_GITHUB_TOKEN в Vercel → Environment Variables",
      });
    }
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const team_id = body.team_id;
    const ranking = body.ranking;
    const device = String(body.device || "anon").slice(0, 80);
    const name = String(body.name || "").slice(0, 80);
    if (!team_id || !Array.isArray(ranking) || !ranking.length) {
      return res.status(400).json({ error: "нужны team_id и ranking" });
    }
    const key = device + ":" + team_id;

    for (let i = 0; i < 6; i++) {
      try {
        const { data, sha } = await readStore();
        data.votes = data.votes || [];
        data.devices = data.devices || {};
        if (data.devices[key] || data.votes.some((v) => v.device === device && v.team_id === team_id)) {
          return res.status(409).json({ error: "already", message: "Уже голосовали с этого устройства" });
        }
        data.votes.push({ team_id, ranking, ts: Date.now(), device, name });
        data.devices[key] = { ts: Date.now(), name };
        data.meta = Object.assign({}, data.meta || {}, { updated: Date.now() });
        await writeStore(data, sha);
        return res.status(200).json({ ok: true, total: data.votes.length });
      } catch (e) {
        if (e.status === 409) {
          await new Promise((r) => setTimeout(r, 150 * (i + 1)));
          continue;
        }
        throw e;
      }
    }
    return res.status(500).json({ error: "не удалось сохранить после повторов" });
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message });
  }
};

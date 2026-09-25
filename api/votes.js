const { cors, readStore } = require("./_db");

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });
  try {
    const data = await readStore();
    const votes = Array.isArray(data.votes) ? data.votes : [];
    return res.status(200).json({
      votes: votes.map((row) => ({
        _id: row._id || row.ts || undefined,
        team_id: row.t || row.team_id,
        r: row.r,
        ranking: row.ranking,
        device: row.d || row.device || "",
        name: row.n || row.name || "",
        ts: row.ts || 0,
      })),
      count: votes.length,
      devices: data.devices || {},
      meta: data.meta || {},
    });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }
};

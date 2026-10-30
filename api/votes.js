const { cors, readStore } = require("./_db");
const { isAdminIp } = require("./_admin");

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });
  try {
    const data = await readStore();
    const all = Array.isArray(data.votes) ? data.votes : [];
    // Full ballots only for the admin IP; everyone else sees just their own device's votes.
    const admin = isAdminIp(req);
    const device = String((req.query && req.query.device) || "");
    const votes = admin ? all : all.filter((row) => device && (row.d || row.device) === device);
    res.setHeader("Cache-Control", "no-store");
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
      count: all.length,
      admin,
    });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }
};

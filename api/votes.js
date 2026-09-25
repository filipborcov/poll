const { cors, listBallots } = require("./_db");

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });
  try {
    const ballots = await listBallots();
    // Expand compact rows for client convenience is done client-side;
    // return raw + normalized votes array
    const votes = ballots.map((row) => ({
      _id: row._id,
      team_id: row.t || row.team_id,
      r: row.r,
      ranking: row.ranking,
      device: row.d || row.device || "",
      name: row.n || row.name || "",
      ts: row.ts || 0,
    }));
    return res.status(200).json({ votes, ballots, count: votes.length });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }
};

const { cors, deleteAll } = require("./_db");

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const admin = process.env.POLL_ADMIN_SECRET || "rank2026admin";
    if (body.key !== admin && req.headers["x-admin-key"] !== admin) {
      return res.status(403).json({ error: "forbidden" });
    }
    await deleteAll();
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }
};

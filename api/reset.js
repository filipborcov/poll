const { readStore, writeStore, empty, cors, token } = require("./_store");

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    if (!token()) return res.status(503).json({ error: "no_db" });
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const admin = process.env.POLL_ADMIN_SECRET || "rank2026admin";
    if (body.key !== admin && req.headers["x-admin-key"] !== admin) {
      return res.status(403).json({ error: "forbidden" });
    }
    const { sha } = await readStore();
    const data = empty();
    data.meta.reset_at = Date.now();
    await writeStore(data, sha);
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message });
  }
};

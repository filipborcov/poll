const { readStore, cors, token } = require("./_store");

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });
  try {
    if (!token()) {
      return res.status(503).json({ error: "server_not_configured", message: "POLL_GITHUB_TOKEN missing" });
    }
    const { data } = await readStore();
    return res.status(200).json(data);
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message });
  }
};

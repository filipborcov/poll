const { readStore, cors, token } = require("./_store");

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });
  try {
    // Read works even without token via public raw — but prefer authenticated
    if (!token()) {
      // public fallback
      const r = await fetch(
        "https://raw.githubusercontent.com/filipborcov/poll/main/data/votes.json?_=" + Date.now(),
        { cache: "no-store" }
      );
      if (!r.ok) return res.status(502).json({ error: "db read failed" });
      const data = await r.json();
      return res.status(200).json(data);
    }
    const { data } = await readStore();
    return res.status(200).json(data);
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message });
  }
};

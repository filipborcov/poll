// GET /api/admin with X-Admin-Key -> {ok: true} when the key (and IP) match.
const { cors } = require("./_db");
const { isAdmin } = require("./_admin");

module.exports = async function handler(req, res) {
  cors(res);
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ ok: isAdmin(req) });
};

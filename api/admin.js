const { cors } = require("./_db");
const { isAdminIp } = require("./_admin");

module.exports = async function handler(req, res) {
  cors(res);
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ ok: isAdminIp(req) });
};

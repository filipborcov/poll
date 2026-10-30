// Admin access is limited to these client IPs (plus the admin key).
const ADMIN_IPS = (process.env.POLL_ADMIN_IPS || "88.119.136.57").split(",").map((s) => s.trim()).filter(Boolean);

function clientIp(req) {
  const h = req.headers || {};
  const raw = h["x-vercel-forwarded-for"] || h["x-real-ip"] || h["x-forwarded-for"] || "";
  return String(raw).split(",")[0].trim();
}

function isAdminIp(req) {
  return ADMIN_IPS.includes(clientIp(req));
}

module.exports = { clientIp, isAdminIp };

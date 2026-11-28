// Admin = right key (Vercel env POLL_ADMIN_KEY, never in the repo) AND, if set, an allowed IP.
const crypto = require("crypto");

const ADMIN_IPS = (process.env.POLL_ADMIN_IPS || "88.157.111.3").split(",").map((s) => s.trim()).filter(Boolean);

function clientIp(req) {
  const h = req.headers || {};
  // x-vercel-forwarded-for is set by Vercel itself and can't be faked by the client.
  const raw = h["x-vercel-forwarded-for"] || h["x-real-ip"] || "";
  return String(raw).split(",")[0].trim();
}

function sameKey(a, b) {
  const x = crypto.createHash("sha256").update(String(a)).digest();
  const y = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

function isAdmin(req, body) {
  const key = process.env.POLL_ADMIN_KEY || "";
  if (!key) return false; // no key configured = admin disabled
  if (ADMIN_IPS.length && !ADMIN_IPS.includes("*") && !ADMIN_IPS.includes(clientIp(req))) return false;
  const given = (req.headers && req.headers["x-admin-key"]) || (body && body.key) || "";
  return !!given && sameKey(given, key);
}

module.exports = { clientIp, isAdmin };

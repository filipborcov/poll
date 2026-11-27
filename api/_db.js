const SHORT = "uszdsiz8";
const EDIT = "qF3YXWYu";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Key");
}

function empty() {
  return { votes: [], devices: {}, meta: {} };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function decode(s) {
  return s
    .replace(/&quot;|&#34;|&#x22;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function valid(obj) {
  return obj && typeof obj === "object" && Array.isArray(obj.votes);
}

// Pull the stored JSON out of the rentry page. Throws when it can't be found:
// returning an empty store here would let the next vote overwrite every saved vote.
function parsePage(page) {
  const tm = page.match(/<title>([\s\S]*?)<\/title>/i);
  if (tm) {
    const title = decode(tm[1]).trim();
    if (title.startsWith("{")) {
      try { const o = JSON.parse(title); if (valid(o)) return o; } catch (_) {}
    }
  }
  const am = page.match(/<article>([\s\S]*?)<\/article>/i);
  const text = decode((am ? am[1] : page).replace(/<[^>]+>/g, " "));
  const a = text.indexOf('{"votes"');
  const b = text.lastIndexOf("}");
  if (a >= 0 && b > a) {
    try { const o = JSON.parse(text.slice(a, b + 1)); if (valid(o)) return o; } catch (_) {}
  }
  throw new Error("db read: stored JSON not found on the page");
}

// Short in-memory cache for read-only requests, so a burst of page loads
// doesn't turn into a burst of rentry requests (which then get rate limited).
let cache = null; // { data, at }
const CACHE_MS = 3000;

async function fetchStore() {
  let lastErr;
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch("https://rentry.co/" + SHORT + "?_=" + Date.now(), {
        headers: { "User-Agent": UA, Accept: "text/html" },
        cache: "no-store",
      });
      if (!r.ok) throw new Error("db read " + r.status);
      const data = parsePage(await r.text());
      cache = { data, at: Date.now() };
      return JSON.parse(JSON.stringify(data));
    } catch (e) {
      lastErr = e;
      await sleep(300 * (i + 1) + Math.random() * 200);
    }
  }
  throw lastErr;
}

// opts.fresh: skip the cache (always used before a write).
async function readStore(opts = {}) {
  if (!opts.fresh && cache && Date.now() - cache.at < CACHE_MS) {
    return JSON.parse(JSON.stringify(cache.data));
  }
  return fetchStore();
}

async function writeStore(obj) {
  if (!valid(obj)) throw new Error("db write: refusing to save an invalid store");
  const body = new URLSearchParams();
  body.set("edit_code", EDIT);
  body.set("text", JSON.stringify(obj));
  let lastErr;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch("https://rentry.co/api/edit/" + SHORT, {
        method: "POST",
        headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
      if (!r.ok) throw new Error("db write " + r.status);
      const j = await r.json().catch(() => ({}));
      if (j && j.status && String(j.status) !== "200") throw new Error("db write " + (j.content || j.status));
      cache = { data: JSON.parse(JSON.stringify(obj)), at: Date.now() };
      return j;
    } catch (e) {
      lastErr = e;
      await sleep(400 * (i + 1) + Math.random() * 200);
    }
  }
  throw lastErr;
}

module.exports = { cors, readStore, writeStore, empty };

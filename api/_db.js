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

async function readStore() {
  const r = await fetch("https://rentry.co/" + SHORT, {
    headers: { "User-Agent": UA, Accept: "text/html" },
    cache: "no-store",
  });
  if (!r.ok) throw new Error("db read " + r.status);
  const page = await r.text();
  // title often holds the JSON
  const tm = page.match(/<title>([\s\S]*?)<\/title>/i);
  if (tm) {
    const title = tm[1]
      .replace(/"/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&/g, "&")
      .replace(/</g, "<")
      .replace(/>/g, ">")
      .trim();
    if (title.startsWith("{")) {
      try { return JSON.parse(title); } catch (_) {}
    }
  }
  const am = page.match(/<article>([\s\S]*?)<\/article>/i);
  let text = am ? am[1] : page;
  text = text.replace(/<[^>]+>/g, " ");
  text = text
    .replace(/"/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">");
  const a = text.indexOf("{");
  const b = text.lastIndexOf("}");
  if (a < 0 || b < 0) return empty();
  try {
    return JSON.parse(text.slice(a, b + 1));
  } catch (_) {
    return empty();
  }
}

async function writeStore(obj) {
  const body = new URLSearchParams();
  body.set("edit_code", EDIT);
  body.set("text", JSON.stringify(obj));
  const r = await fetch("https://rentry.co/api/edit/" + SHORT, {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });
  if (!r.ok) throw new Error("db write " + r.status);
  const j = await r.json().catch(() => ({}));
  if (j && j.status && String(j.status) !== "200") {
    throw new Error("db write " + (j.content || j.status));
  }
  return j;
}

module.exports = { cors, readStore, writeStore, empty };

const OWNER = "filipborcov";
const REPO = "poll";
const PATH = "data/votes.json";

function token() {
  return process.env.POLL_GITHUB_TOKEN || process.env.GITHUB_TOKEN || "";
}

function empty() {
  return { votes: [], devices: {}, meta: { created: Date.now() } };
}

async function gh(pathname, opts = {}) {
  const t = token();
  if (!t) {
    const err = new Error("POLL_GITHUB_TOKEN is not configured on Vercel");
    err.status = 503;
    throw err;
  }
  const res = await fetch("https://api.github.com" + pathname, {
    ...opts,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: "Bearer " + t,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  return res;
}

async function readStore() {
  const res = await gh(`/repos/${OWNER}/${REPO}/contents/${PATH}`);
  if (res.status === 404) {
    return { data: empty(), sha: null };
  }
  if (!res.ok) {
    const err = new Error("GitHub read failed: " + res.status);
    err.status = 502;
    throw err;
  }
  const json = await res.json();
  const text = Buffer.from(json.content.replace(/\n/g, ""), "base64").toString("utf8");
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = empty();
  }
  if (!Array.isArray(data.votes)) data.votes = [];
  if (!data.devices || typeof data.devices !== "object") data.devices = {};
  if (!data.meta) data.meta = {};
  return { data, sha: json.sha };
}

async function writeStore(data, sha) {
  const body = {
    message: "chore(poll): update votes " + new Date().toISOString(),
    content: Buffer.from(JSON.stringify(data), "utf8").toString("base64"),
    sha: sha || undefined,
  };
  const res = await gh(`/repos/${OWNER}/${REPO}/contents/${PATH}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    const err = new Error("GitHub write failed: " + res.status + " " + txt.slice(0, 200));
    err.status = res.status === 409 ? 409 : 502;
    throw err;
  }
  return res.json();
}

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Key");
}

module.exports = { readStore, writeStore, empty, token, cors };

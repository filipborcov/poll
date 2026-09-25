const OWNER = "filipborcov";
const REPO = "poll";
const PATH = "data/votes.json";

function token() {
  return process.env.POLL_GITHUB_TOKEN || process.env.GITHUB_TOKEN || "";
}

function empty() {
  return { votes: [], devices: {}, meta: { created: Date.now() } };
}

async function gh(path, opts = {}) {
  const t = token();
  if (!t) {
    const e = new Error("Нет POLL_GITHUB_TOKEN");
    e.status = 503;
    throw e;
  }
  const res = await fetch("https://api.github.com" + path, {
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
  if (res.status === 404) return { data: empty(), sha: null };
  if (!res.ok) {
    const e = new Error("Чтение БД: " + res.status);
    e.status = 502;
    throw e;
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
    message: "poll vote " + new Date().toISOString(),
    content: Buffer.from(JSON.stringify(data, null, 0), "utf8").toString("base64"),
  };
  if (sha) body.sha = sha;
  const res = await gh(`/repos/${OWNER}/${REPO}/contents/${PATH}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  if (res.status === 409) {
    const e = new Error("conflict");
    e.status = 409;
    throw e;
  }
  if (!res.ok) {
    const t = await res.text();
    const e = new Error("Запись БД: " + res.status + " " + t.slice(0, 150));
    e.status = 502;
    throw e;
  }
  return res.json();
}

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Key");
}

module.exports = { readStore, writeStore, empty, token, cors };

const CRUD = "https://crudcrud.com/api/d50f91a930494a7c9024c94f9ee48318";
const COL = "/ballots";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Key");
}

async function listBallots() {
  const r = await fetch(CRUD + COL + "?_=" + Date.now(), { cache: "no-store" });
  if (!r.ok) throw new Error("db list " + r.status);
  const arr = await r.json();
  return Array.isArray(arr) ? arr : [];
}

async function addBallot(payload) {
  const r = await fetch(CRUD + COL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error("db write " + r.status + " " + t.slice(0, 100));
  }
  return r.json();
}

async function deleteAll() {
  const arr = await listBallots();
  for (const row of arr) {
    if (!row._id) continue;
    await fetch(CRUD + COL + "/" + row._id, { method: "DELETE" });
  }
}

module.exports = { cors, listBallots, addBallot, deleteAll, CRUD };

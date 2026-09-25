(function () {
  // Простая облачная база (crudcrud). Без GitHub/Vercel токенов.
  // Бесплатный endpoint живёт ~сутки; если умрёт — обновим.
  const CRUD_BASE = "https://crudcrud.com/api/2b7ce23f2bbd4dab9c2afeb83fc5e9d7";
  const COL = "/ballots";
  const DEVICE_KEY = "team-rank-poll-device";
  const LOCAL_KEY = "team-rank-poll-local-votes";

  function getDeviceId() {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = "d_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      try { localStorage.setItem(DEVICE_KEY, id); } catch (_) {}
    }
    return id;
  }

  function localGet() {
    try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]"); } catch (_) { return []; }
  }
  function localAdd(vote) {
    try {
      const arr = localGet();
      arr.push(vote);
      localStorage.setItem(LOCAL_KEY, JSON.stringify(arr));
    } catch (_) {}
  }
  function localClear() {
    try { localStorage.removeItem(LOCAL_KEY); } catch (_) {}
  }

  function compact(teamId, ranking) {
    const members = ((window.POLL_CONFIG.TEAMS || {})[teamId] || {}).members || [];
    return ranking
      .map((name) => members.indexOf(name))
      .filter((i) => i >= 0)
      .join(",");
  }

  function expand(row) {
    const teamId = row.t || row.team_id;
    const members = ((window.POLL_CONFIG.TEAMS || {})[teamId] || {}).members || [];
    let ranking = row.ranking;
    if (typeof row.r === "string") {
      ranking = row.r.split(",").map((x) => members[parseInt(x, 10)]).filter(Boolean);
    }
    return {
      _id: row._id,
      team_id: teamId,
      ranking: ranking || [],
      device: row.d || row.device || "",
      name: row.n || row.name || "",
      ts: row.ts || 0,
    };
  }

  async function cloudList() {
    const res = await fetch(CRUD_BASE + COL + "?_=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error("База недоступна (" + res.status + ")");
    const arr = await res.json();
    if (!Array.isArray(arr)) throw new Error("Неверный ответ базы");
    return arr.map(expand);
  }

  async function cloudAdd(payload) {
    const res = await fetch(CRUD_BASE + COL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error("Не удалось сохранить голос (" + res.status + ") " + t.slice(0, 80));
    }
    return res.json();
  }

  async function cloudDeleteAll() {
    const res = await fetch(CRUD_BASE + COL + "?_=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error("Не удалось прочитать базу для сброса");
    const arr = await res.json();
    for (const row of arr) {
      if (!row._id) continue;
      await fetch(CRUD_BASE + COL + "/" + row._id, { method: "DELETE" });
    }
  }

  async function loadVotes() {
    try {
      return await cloudList();
    } catch (e) {
      console.warn("cloud load failed, local fallback", e);
      return localGet();
    }
  }

  async function load() {
    const votes = await loadVotes();
    const devices = {};
    for (const v of votes) {
      if (v.device && v.team_id) devices[v.device + ":" + v.team_id] = { ts: v.ts, name: v.name };
    }
    return { votes, devices, meta: {} };
  }

  async function hasVoted(teamId) {
    const device = getDeviceId();
    const votes = await loadVotes();
    return votes.some((v) => v.device === device && v.team_id === teamId);
  }

  async function addVote(teamId, ranking, voterName) {
    const device = getDeviceId();
    const votes = await loadVotes();
    if (votes.some((v) => v.device === device && v.team_id === teamId)) {
      const e = new Error("Уже голосовали с этого устройства за эту команду");
      e.code = "ALREADY";
      throw e;
    }
    const payload = {
      t: teamId,
      r: compact(teamId, ranking),
      d: device,
      n: String(voterName || "").slice(0, 80),
      ts: Date.now(),
    };
    if (!payload.r) throw new Error("Пустой рейтинг");
    const saved = await cloudAdd(payload);
    const full = expand(Object.assign({}, payload, saved));
    localAdd(full);
    return { ok: true, total: votes.length + 1 };
  }

  async function bordaScores(teamId) {
    const team = (window.POLL_CONFIG.TEAMS || {})[teamId];
    if (!team) return { ranked: [], vote_count: 0, name: "", member_count: 0 };
    const members = team.members;
    const n = members.length;
    const scores = Object.fromEntries(members.map((m) => [m, 0]));
    let voteCount = 0;
    for (const vote of await loadVotes()) {
      if (vote.team_id !== teamId) continue;
      voteCount++;
      (vote.ranking || []).forEach((name, pos) => {
        if (name in scores) scores[name] += n - pos;
      });
    }
    const ranked = Object.entries(scores)
      .map(([name, points]) => ({ name, points }))
      .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, "ru"));
    ranked.forEach((item, i) => {
      item.place = i + 1;
      item.max_points = n * voteCount;
    });
    return { ranked, vote_count: voteCount, name: team.name, member_count: n };
  }

  async function resetAll() {
    await cloudDeleteAll();
    localClear();
  }

  async function totalBallots() {
    return (await loadVotes()).length;
  }

  function exportJSON() {
    return JSON.stringify({ votes: localGet() }, null, 2);
  }
  async function importJSON() { return 0; }

  async function ping() {
    try {
      const votes = await cloudList();
      return { ok: true, mode: "cloud", count: votes.length };
    } catch (e) {
      return { ok: false, mode: "local", error: String(e.message || e), count: localGet().length };
    }
  }

  window.PollStore = {
    load, loadVotes, hasVoted, addVote, bordaScores, resetAll,
    exportJSON, importJSON, totalBallots, getDeviceId, ping,
    getMode: () => "cloud",
    cacheGet: () => ({ votes: localGet() }),
    _crud: CRUD_BASE,
  };
})();

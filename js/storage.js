(function () {
  const LOCAL_KEY = "team-rank-poll-v7";
  const DEVICE_KEY = "team-rank-poll-device";

  function getDeviceId() {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = "d_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      try { localStorage.setItem(DEVICE_KEY, id); } catch (_) {}
    }
    return id;
  }

  function cfg() { return window.POLL_CONFIG || {}; }

  function cacheGet() {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return { votes: [], devices: {}, meta: {} };
  }
  function cacheSet(data) {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(data)); } catch (_) {}
  }

  function api(path) {
    const base = (cfg().API_BASE || "").replace(/\/$/, "");
    return base + path;
  }

  async function loadFromRaw() {
    const url = (cfg().GH_RAW || "") + (cfg().GH_RAW && cfg().GH_RAW.indexOf("?") >= 0 ? "&" : "?") + "_=" + Date.now();
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("Не удалось загрузить результаты (" + res.status + ")");
    const data = await res.json();
    if (!Array.isArray(data.votes)) data.votes = [];
    if (!data.devices) data.devices = {};
    if (!data.meta) data.meta = {};
    cacheSet(data);
    return data;
  }

  async function loadFromApi() {
    const res = await fetch(api("/api/votes") + "?_=" + Date.now(), { cache: "no-store" });
    if (res.status === 404 || res.status === 503) return null;
    if (!res.ok) throw new Error("API " + res.status);
    const data = await res.json();
    if (!Array.isArray(data.votes)) data.votes = [];
    cacheSet(data);
    return data;
  }

  async function load() {
    try {
      const apiData = await loadFromApi();
      if (apiData) return apiData;
    } catch (e) {
      console.warn("api load", e);
    }
    return loadFromRaw();
  }

  async function loadVotes() {
    return (await load()).votes || [];
  }

  async function hasVoted(teamId) {
    const device = getDeviceId();
    const data = await load();
    const key = device + ":" + teamId;
    if (data.devices && data.devices[key]) return true;
    return (data.votes || []).some((v) => v.device === device && v.team_id === teamId);
  }

  async function addVote(teamId, ranking, voterName) {
    const device = getDeviceId();
    // local already-voted check
    const cur = await load();
    if ((cur.votes || []).some((v) => v.device === device && v.team_id === teamId)) {
      const err = new Error("Вы уже голосовали за эту команду с этого устройства.");
      err.code = "ALREADY";
      throw err;
    }
    const res = await fetch(api("/api/vote"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        team_id: teamId,
        ranking: ranking,
        device: device,
        name: String(voterName || "").slice(0, 80),
      }),
    });
    let data = {};
    try { data = await res.json(); } catch (_) {}
    if (res.status === 409) {
      const err = new Error(data.message || "Уже голосовали");
      err.code = "ALREADY";
      throw err;
    }
    if (res.status === 503) {
      throw new Error(
        "Сервер ещё не настроен для записи голосов. Админу: в Vercel → Environment Variables добавьте POLL_GITHUB_TOKEN (GitHub PAT с правом contents:write)."
      );
    }
    if (!res.ok) {
      throw new Error(data.error || data.message || "Ошибка сохранения (" + res.status + ")");
    }
    // refresh cache from source of truth
    try { await load(); } catch (_) {}
    return data;
  }

  async function bordaScores(teamId) {
    const team = (cfg().TEAMS || {})[teamId];
    if (!team) return { ranked: [], vote_count: 0, name: "", member_count: 0 };
    const members = team.members;
    const n = members.length;
    const scores = Object.fromEntries(members.map((m) => [m, 0]));
    let voteCount = 0;
    const votes = await loadVotes();
    for (const vote of votes) {
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
    const key = cfg().ADMIN_SECRET;
    const res = await fetch(api("/api/reset"), {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Admin-Key": key },
      body: JSON.stringify({ key: key }),
    });
    let data = {};
    try { data = await res.json(); } catch (_) {}
    if (res.status === 503) {
      throw new Error("Нужен POLL_GITHUB_TOKEN в Vercel Environment Variables");
    }
    if (!res.ok) throw new Error(data.error || "Сброс не удался (" + res.status + ")");
    cacheSet({ votes: [], devices: {}, meta: { reset_at: Date.now() } });
  }

  async function totalBallots() {
    return (await loadVotes()).length;
  }

  function exportJSON() {
    return JSON.stringify(cacheGet(), null, 2);
  }

  async function importJSON(raw) {
    const incoming = JSON.parse(raw);
    if (!incoming || !Array.isArray(incoming.votes)) throw new Error("Неверный формат");
    let added = 0;
    for (const v of incoming.votes) {
      try {
        const res = await fetch(api("/api/vote"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            team_id: v.team_id,
            ranking: v.ranking,
            device: (v.device || "import") + "_" + (v.ts || Date.now()),
            name: v.name || "",
          }),
        });
        if (res.ok) added++;
      } catch (_) {}
    }
    return added;
  }

  async function ping() {
    try {
      const data = await load();
      const count = (data.votes || []).length;
      // check if write API is configured
      let writeOk = false;
      try {
        const r = await fetch(api("/api/votes"), { cache: "no-store" });
        writeOk = r.ok;
      } catch (_) {}
      return { ok: true, mode: writeOk ? "github+api" : "github-read", count: count };
    } catch (e) {
      return { ok: false, mode: "none", error: String(e.message || e) };
    }
  }

  window.PollStore = {
    load, loadVotes, hasVoted, addVote, bordaScores, resetAll,
    exportJSON, importJSON, totalBallots, getDeviceId, ping,
    getMode: () => "github", cacheGet,
  };
})();

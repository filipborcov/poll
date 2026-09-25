(function () {
  const LOCAL_KEY = "team-rank-poll-v4";
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

  function votesUrl() { return cfg().VOTES_URL || ""; }

  function cacheGet() {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return { votes: [] };
  }

  function cacheSet(votes) {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify({ votes: votes })); } catch (_) {}
  }

  /** ranking names -> "0,3,1,2,..." compact string (cloud rejects large arrays) */
  function encodeRanking(teamId, ranking) {
    const members = (cfg().TEAMS[teamId] || {}).members || [];
    const idx = ranking.map((name) => {
      const i = members.indexOf(name);
      if (i < 0) throw new Error("Неизвестный участник: " + name);
      return i;
    });
    return idx.join(",");
  }

  function decodeRanking(teamId, r) {
    const members = (cfg().TEAMS[teamId] || {}).members || [];
    if (Array.isArray(r)) {
      // legacy: full names or indices
      if (typeof r[0] === "number") return r.map((i) => members[i]).filter(Boolean);
      return r;
    }
    if (typeof r === "string") {
      return r.split(",").map((s) => members[parseInt(s, 10)]).filter(Boolean);
    }
    return [];
  }

  function normalizeVote(raw) {
    // compact cloud format: {t,r,ts,d,n,_id} or full {team_id,ranking,...}
    const team_id = raw.team_id || raw.t;
    const device = raw.device || raw.d || "";
    const name = raw.name || raw.n || "";
    const ts = raw.ts || 0;
    const ranking = decodeRanking(team_id, raw.ranking != null ? raw.ranking : raw.r);
    return { team_id, ranking, ts, device, name, _id: raw._id };
  }

  async function cloudList() {
    const url = votesUrl();
    if (!url) throw new Error("VOTES_URL missing");
    const res = await fetch(url + "?_=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error("Не удалось загрузить голоса (" + res.status + ")");
    const arr = await res.json();
    if (!Array.isArray(arr)) return [];
    return arr.map(normalizeVote).filter((v) => v.team_id && v.ranking && v.ranking.length);
  }

  async function cloudPost(teamId, ranking, device, voterName) {
    const url = votesUrl();
    if (!url) throw new Error("VOTES_URL missing");
    // COMPACT body only — large JSON arrays get HTTP 500 on free cloud
    const body = {
      t: teamId,
      r: encodeRanking(teamId, ranking),
      ts: Date.now(),
      d: device,
      n: String(voterName || "").slice(0, 60),
    };
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error("Сохранение не удалось (" + res.status + ") " + t.slice(0, 60));
    }
    return res.json();
  }

  async function cloudReset() {
    const url = votesUrl();
    const list = await cloudList();
    // re-fetch raw for ids
    const res = await fetch(url + "?_=" + Date.now(), { cache: "no-store" });
    const arr = await res.json();
    if (!Array.isArray(arr)) return;
    for (const v of arr) {
      if (v._id) {
        await fetch(url + "/" + v._id, { method: "DELETE" }).catch(() => {});
      }
    }
  }

  // optional same-origin API
  async function apiGet() {
    try {
      const res = await fetch("/api/votes", { cache: "no-store" });
      if (res.status === 503 || res.status === 404) return null;
      if (!res.ok) return null;
      const data = await res.json();
      return Array.isArray(data.votes) ? data.votes.map(normalizeVote) : [];
    } catch (_) {
      return null;
    }
  }

  async function apiPost(vote) {
    try {
      const res = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vote),
      });
      if (res.status === 503 || res.status === 404) return null;
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        const err = new Error(data.message || "Уже голосовали");
        err.code = "ALREADY";
        throw err;
      }
      if (!res.ok) return null;
      return data;
    } catch (e) {
      if (e.code === "ALREADY") throw e;
      return null;
    }
  }

  async function apiReset(key) {
    try {
      const res = await fetch("/api/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Key": key },
        body: JSON.stringify({ key }),
      });
      if (res.status === 503 || res.status === 404) return null;
      return res.ok;
    } catch (_) {
      return null;
    }
  }

  let mode = "unknown";

  async function loadVotes() {
    const apiVotes = await apiGet();
    if (apiVotes) {
      mode = "api";
      cacheSet(apiVotes);
      return apiVotes;
    }
    const cloud = await cloudList();
    mode = "cloud";
    cacheSet(cloud);
    return cloud;
  }

  async function load() {
    return { votes: await loadVotes(), devices: {}, meta: {} };
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
      const err = new Error("Вы уже голосовали за эту команду с этого устройства.");
      err.code = "ALREADY";
      throw err;
    }

    // try API with full ranking
    const full = {
      team_id: teamId,
      ranking,
      ts: Date.now(),
      device,
      name: voterName || "",
    };
    try {
      const r = await apiPost(full);
      if (r) {
        mode = "api";
        cacheSet(await loadVotes());
        return;
      }
    } catch (e) {
      if (e.code === "ALREADY") throw e;
    }

    // cloud compact
    await cloudPost(teamId, ranking, device, voterName);
    mode = "cloud";
    const all = await loadVotes();
    cacheSet(all);
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
    const ok = await apiReset(key);
    if (!ok) await cloudReset();
    cacheSet([]);
  }

  async function totalBallots() {
    return (await loadVotes()).length;
  }

  function exportJSON() {
    return JSON.stringify({ votes: cacheGet().votes || [] }, null, 2);
  }

  async function importJSON(raw) {
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.votes)) throw new Error("Неверный формат");
    let added = 0;
    const existing = await loadVotes();
    const seen = new Set(existing.map((v) => v.team_id + "|" + v.ts + "|" + v.device));
    for (const v of data.votes) {
      const k = (v.team_id || v.t) + "|" + (v.ts || 0) + "|" + (v.device || v.d || "");
      if (seen.has(k)) continue;
      const teamId = v.team_id || v.t;
      const ranking = decodeRanking(teamId, v.ranking != null ? v.ranking : v.r);
      if (!teamId || !ranking.length) continue;
      try {
        await cloudPost(teamId, ranking, v.device || v.d || "import", v.name || v.n || "");
        added++;
      } catch (_) {}
    }
    return added;
  }

  async function ping() {
    try {
      const apiVotes = await apiGet();
      if (apiVotes) return { ok: true, mode: "api", count: apiVotes.length };
    } catch (_) {}
    try {
      const votes = await cloudList();
      return { ok: true, mode: "cloud", count: votes.length };
    } catch (e) {
      return { ok: false, mode: "local", error: String(e.message || e) };
    }
  }

  window.PollStore = {
    load,
    loadVotes,
    hasVoted,
    addVote,
    bordaScores,
    resetAll,
    exportJSON,
    importJSON,
    totalBallots,
    getDeviceId,
    ping,
    getMode: () => mode,
    cacheGet,
  };
})();

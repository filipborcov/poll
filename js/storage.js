(function () {
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
    if (typeof row.r === "string" && row.r.length) {
      if (row._fmt === "names" || row.r.indexOf("||") !== -1) {
        ranking = row.r.split("||").filter(Boolean);
      } else {
        ranking = row.r.split(",").map((x) => members[parseInt(x, 10)]).filter(Boolean);
      }
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

  async function api(path, opts) {
    const res = await fetch(path, opts);
    let data = null;
    try { data = await res.json(); } catch (_) {}
    return { res, data };
  }

  async function loadVotes() {
    try {
      const { res, data } = await api("/api/votes?_=" + Date.now(), { cache: "no-store" });
      if (res.ok && data && Array.isArray(data.votes)) {
        return data.votes.map(expand);
      }
      throw new Error((data && data.error) || "api " + (res && res.status));
    } catch (e) {
      console.warn("api load failed", e);
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
    const r = compact(teamId, ranking);
    if (!r) throw new Error("Пустой рейтинг — расставьте всех участников");

    const { res, data } = await api("/api/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        team_id: teamId,
        r: r,
        ranking: ranking,
        device: device,
        name: voterName || "",
      }),
    });

    if (res.status === 409) {
      const e = new Error((data && data.message) || "Уже голосовали");
      e.code = "ALREADY";
      throw e;
    }
    if (!res.ok) {
      throw new Error((data && data.error) || "Не удалось сохранить (" + res.status + ")");
    }

    localAdd({
      team_id: teamId,
      ranking: ranking,
      device: device,
      name: voterName || "",
      ts: Date.now(),
    });
    return data;
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
    const key = window.POLL_CONFIG.ADMIN_SECRET;
    const { res, data } = await api("/api/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Admin-Key": key },
      body: JSON.stringify({ key }),
    });
    if (!res.ok) throw new Error((data && data.error) || "Сброс не удался");
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
      const { res, data } = await api("/api/votes?_=" + Date.now(), { cache: "no-store" });
      if (!res.ok) return { ok: false, mode: "down", error: (data && data.error) || String(res.status) };
      return { ok: true, mode: "api", count: (data && data.count) || (data.votes || []).length };
    } catch (e) {
      return { ok: false, mode: "down", error: String(e.message || e) };
    }
  }

  window.PollStore = {
    load, loadVotes, hasVoted, addVote, bordaScores, resetAll,
    exportJSON, importJSON, totalBallots, getDeviceId, ping,
    getMode: () => "api",
    cacheGet: () => ({ votes: localGet() }),
  };
})();

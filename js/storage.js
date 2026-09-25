(function () {
  const DEVICE_KEY = "team-rank-poll-device";

  function getDeviceId() {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = "d_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      try { localStorage.setItem(DEVICE_KEY, id); } catch (_) {}
    }
    return id;
  }

  async function api(path, opts) {
    const res = await fetch(path, opts);
    let data = null;
    try { data = await res.json(); } catch (_) {}
    return { res, data };
  }

  async function load() {
    const { res, data } = await api("/api/votes?_=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error((data && data.error) || "Не удалось загрузить базу (" + res.status + ")");
    return {
      votes: (data && data.votes) || [],
      devices: (data && data.devices) || {},
      meta: (data && data.meta) || {},
    };
  }

  async function loadVotes() {
    return (await load()).votes;
  }

  async function hasVoted(teamId) {
    const device = getDeviceId();
    const d = await load();
    if (d.devices[device + ":" + teamId]) return true;
    return d.votes.some((v) => v.device === device && v.team_id === teamId);
  }

  async function addVote(teamId, ranking, voterName) {
    const { res, data } = await api("/api/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        team_id: teamId,
        ranking: ranking,
        device: getDeviceId(),
        name: voterName || "",
      }),
    });
    if (res.status === 409) {
      const e = new Error((data && data.message) || "Уже голосовали");
      e.code = "ALREADY";
      throw e;
    }
    if (res.status === 503) {
      throw new Error("База не подключена. Нужен POLL_GITHUB_TOKEN в Vercel (1 минута).");
    }
    if (!res.ok) throw new Error((data && (data.error || data.message)) || "Ошибка " + res.status);
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
  }

  async function totalBallots() {
    return (await loadVotes()).length;
  }

  function exportJSON() {
    return "{}";
  }
  async function importJSON() { return 0; }

  async function ping() {
    try {
      const d = await load();
      // probe write capability lightly: if votes endpoint works with auth path
      const { res } = await api("/api/votes?_=" + Date.now());
      return { ok: res.ok, mode: "db", count: (d.votes || []).length };
    } catch (e) {
      return { ok: false, mode: "down", error: String(e.message || e) };
    }
  }

  window.PollStore = {
    load, loadVotes, hasVoted, addVote, bordaScores, resetAll,
    exportJSON, importJSON, totalBallots, getDeviceId, ping,
    getMode: () => "db", cacheGet: () => ({ votes: [] }),
  };
})();

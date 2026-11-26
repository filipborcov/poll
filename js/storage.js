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

  // Ballot encoding in the shared store (field "r"):
  //   board ballots: "v2:" + "memberIndex=score" pairs, e.g. "v2:3=87,14=12" (score 0..100)
  //   old list ballots: "memberIndex,memberIndex,..." best first (score = place percentile)
  function compact(teamId, scored) {
    const members = ((window.POLL_CONFIG.TEAMS || {})[teamId] || {}).members || [];
    const parts = scored
      .map((x) => [members.indexOf(x.name), Math.round(Math.max(0, Math.min(100, x.score)))])
      .filter(([i]) => i >= 0)
      .map(([i, sc]) => i + "=" + sc);
    return parts.length ? "v2:" + parts.join(",") : "";
  }

  function expand(row) {
    const teamId = row.t || row.team_id;
    const members = ((window.POLL_CONFIG.TEAMS || {})[teamId] || {}).members || [];
    let ranking = row.ranking;
    let scores = null;
    if (typeof row.r === "string" && row.r.startsWith("v2:")) {
      scores = {};
      for (const pair of row.r.slice(3).split(",")) {
        const [i, sc] = pair.split("=");
        const name = members[parseInt(i, 10)];
        const v = Number(sc);
        if (name && Number.isFinite(v)) scores[name] = Math.max(0, Math.min(100, v));
      }
      ranking = Object.keys(scores).sort((a, b) => scores[b] - scores[a]);
    } else if (typeof row.r === "string" && row.r.length) {
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
      scores,
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
      const url = "/api/votes?device=" + encodeURIComponent(getDeviceId()) + "&_=" + Date.now();
      const { res, data } = await api(url, { cache: "no-store" });
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

  // scored: [{name, score}] from the board.
  async function addVote(teamId, scored, voterName) {
    const device = getDeviceId();
    const votes = await loadVotes();
    if (votes.some((v) => v.device === device && v.team_id === teamId)) {
      const e = new Error(I18N.t("errAlreadyDevice"));
      e.code = "ALREADY";
      throw e;
    }
    const r = compact(teamId, scored);
    if (!r) throw new Error(I18N.t("errEmpty"));

    const { res, data } = await api("/api/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        team_id: teamId,
        r: r,
        device: device,
        name: voterName || "",
      }),
    });

    if (res.status === 409) {
      const e = new Error(I18N.t("errAlreadyDevice"));
      e.code = "ALREADY";
      throw e;
    }
    if (!res.ok) {
      throw new Error((data && data.error) || I18N.t("errSave", { s: res.status }));
    }

    localAdd({
      team_id: teamId,
      r: r,
      ranking: scored.map((x) => x.name),
      device: device,
      name: voterName || "",
      ts: Date.now(),
    });
    return data;
  }

  async function votedIds() {
    const device = getDeviceId();
    const ids = {};
    for (const v of await loadVotes()) {
      if (v.device === device) ids[v.team_id] = true;
    }
    return ids;
  }

  // Score of one ballot for a person, 0..100:
  //   board ballots carry the score directly (height on the board: top = 100, bottom = 0);
  //   old list ballots use the place as a percentile: 1st = 100, last = 0, a one-person ballot = 100.
  // People a voter left in "no idea" aren't on that ballot, so a person's poll score
  // averages only the ballots that rated them.
  async function pollScores(teamId, allVotes) {
    const team = (window.POLL_CONFIG.TEAMS || {})[teamId];
    if (!team) return { ranked: [], vote_count: 0, name: "", member_count: 0 };
    const members = team.members;
    const sum = Object.fromEntries(members.map((m) => [m, 0]));
    const cnt = Object.fromEntries(members.map((m) => [m, 0]));
    let voteCount = 0;
    for (const vote of allVotes || (await loadVotes())) {
      if (vote.team_id !== teamId) continue;
      if (vote.scores) {
        const names = Object.keys(vote.scores).filter((name) => name in sum);
        if (!names.length) continue;
        voteCount++;
        names.forEach((name) => {
          sum[name] += vote.scores[name];
          cnt[name] += 1;
        });
        continue;
      }
      const ranking = (vote.ranking || []).filter((name) => name in sum);
      if (!ranking.length) continue;
      voteCount++;
      const k = ranking.length;
      ranking.forEach((name, pos) => {
        sum[name] += k === 1 ? 100 : (100 * (k - 1 - pos)) / (k - 1);
        cnt[name] += 1;
      });
    }
    const ranked = members
      .map((name) => ({ name, votes: cnt[name], score: cnt[name] ? sum[name] / cnt[name] : null }))
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || b.votes - a.votes || a.name.localeCompare(b.name));
    ranked.forEach((item, i) => (item.place = i + 1));
    return { ranked, vote_count: voteCount, name: team.name, member_count: members.length };
  }

  async function isAdmin() {
    try {
      const { res, data } = await api("/api/admin?_=" + Date.now(), { cache: "no-store" });
      return !!(res.ok && data && data.ok);
    } catch (_) {
      return false;
    }
  }

  async function resetAll() {
    const key = window.POLL_CONFIG.ADMIN_SECRET;
    const { res, data } = await api("/api/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Admin-Key": key },
      body: JSON.stringify({ key }),
    });
    if (!res.ok) throw new Error((data && data.error) || I18N.t("resetFailed"));
    localClear();
  }

  async function totalBallots(allVotes) {
    const teams = window.POLL_CONFIG.TEAMS || {};
    return (allVotes || (await loadVotes())).filter((v) => v.team_id in teams).length;
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
    load, loadVotes, hasVoted, votedIds, isAdmin, addVote, pollScores, resetAll,
    exportJSON, importJSON, totalBallots, getDeviceId, ping,
    getMode: () => "api",
    cacheGet: () => ({ votes: localGet() }),
  };
})();

(function () {
  const KEY = "team-rank-poll-v1";

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return { votes: [], meta: { created: Date.now() }, votedTeams: [] };
  }

  function save(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  function hasVoted(teamId) {
    const d = load();
    return (d.votedTeams || []).includes(teamId);
  }

  function markVoted(teamId) {
    const d = load();
    d.votedTeams = d.votedTeams || [];
    if (!d.votedTeams.includes(teamId)) d.votedTeams.push(teamId);
    save(d);
  }

  function addVote(teamId, ranking) {
    const d = load();
    d.votes.push({
      team_id: teamId,
      ranking: ranking,
      ts: Date.now(),
      device: getDeviceId(),
    });
    save(d);
    markVoted(teamId);
  }

  function getDeviceId() {
    let id = localStorage.getItem("team-rank-poll-device");
    if (!id) {
      id = "d_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem("team-rank-poll-device", id);
    }
    return id;
  }

  function bordaScores(teamId) {
    const cfg = window.POLL_CONFIG;
    const team = cfg.TEAMS[teamId];
    if (!team) return { ranked: [], vote_count: 0 };
    const members = team.members;
    const n = members.length;
    const scores = Object.fromEntries(members.map((m) => [m, 0]));
    let voteCount = 0;
    const data = load();
    for (const vote of data.votes || []) {
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

  function resetAll() {
    save({ votes: [], meta: { created: Date.now(), reset_at: Date.now() }, votedTeams: [] });
  }

  function exportJSON() {
    return JSON.stringify(load(), null, 2);
  }

  function importJSON(raw) {
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.votes)) throw new Error("Неверный формат");
    // merge votes by simple append of unique ts+device+team
    const cur = load();
    const seen = new Set(
      (cur.votes || []).map((v) => `${v.team_id}|${v.ts}|${v.device || ""}`)
    );
    let added = 0;
    for (const v of data.votes) {
      const k = `${v.team_id}|${v.ts}|${v.device || ""}`;
      if (!seen.has(k)) {
        cur.votes.push(v);
        seen.add(k);
        added++;
      }
    }
    save(cur);
    return added;
  }

  function totalBallots() {
    return (load().votes || []).length;
  }

  window.PollStore = {
    load,
    save,
    hasVoted,
    markVoted,
    addVote,
    bordaScores,
    resetAll,
    exportJSON,
    importJSON,
    totalBallots,
  };
})();

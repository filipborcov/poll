(function () {
  const LOCAL_KEY = "team-rank-poll-v2";
  const DEVICE_KEY = "team-rank-poll-device";

  function getDeviceId() {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = "d_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  }

  function emptyData() {
    return { votes: [], devices: {}, meta: { created: Date.now() } };
  }

  function cacheGet() {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return emptyData();
  }

  function cacheSet(data) {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
    } catch (_) {}
  }

  function storeUrl() {
    return (window.POLL_CONFIG && window.POLL_CONFIG.STORE_URL) || "";
  }

  async function remoteGet() {
    const url = storeUrl();
    if (!url) return null;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("Не удалось загрузить базу голосов (" + res.status + ")");
    const data = await res.json();
    // crudcrud wraps with _id
    return {
      votes: Array.isArray(data.votes) ? data.votes : [],
      devices: data.devices && typeof data.devices === "object" ? data.devices : {},
      meta: data.meta || {},
      _id: data._id,
    };
  }

  async function remotePut(data) {
    const url = storeUrl();
    if (!url) throw new Error("STORE_URL не задан");
    const body = {
      votes: data.votes || [],
      devices: data.devices || {},
      meta: Object.assign({}, data.meta || {}, { updated: Date.now() }),
    };
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("Не удалось сохранить в базу (" + res.status + ")");
    return body;
  }

  async function load() {
    try {
      const remote = await remoteGet();
      if (remote) {
        cacheSet(remote);
        return remote;
      }
    } catch (e) {
      console.warn("remote load failed, using cache", e);
    }
    return cacheGet();
  }

  async function save(data) {
    cacheSet(data);
    await remotePut(data);
    return data;
  }

  function hasVotedLocal(teamId) {
    const d = cacheGet();
    const device = getDeviceId();
    const key = device + ":" + teamId;
    if (d.devices && d.devices[key]) return true;
    return (d.votes || []).some((v) => v.device === device && v.team_id === teamId);
  }

  async function hasVoted(teamId) {
    try {
      const d = await load();
      const device = getDeviceId();
      const key = device + ":" + teamId;
      if (d.devices && d.devices[key]) return true;
      return (d.votes || []).some((v) => v.device === device && v.team_id === teamId);
    } catch (_) {
      return hasVotedLocal(teamId);
    }
  }

  async function addVote(teamId, ranking, voterName) {
    // retry read-modify-write a few times (naive concurrency)
    let lastErr;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const d = await load();
        const device = getDeviceId();
        const key = device + ":" + teamId;
        if (d.devices && d.devices[key]) {
          const err = new Error("Вы уже голосовали за эту команду с этого устройства.");
          err.code = "ALREADY";
          throw err;
        }
        if ((d.votes || []).some((v) => v.device === device && v.team_id === teamId)) {
          const err = new Error("Вы уже голосовали за эту команду с этого устройства.");
          err.code = "ALREADY";
          throw err;
        }
        d.votes = d.votes || [];
        d.devices = d.devices || {};
        d.votes.push({
          team_id: teamId,
          ranking: ranking,
          ts: Date.now(),
          device: device,
          name: voterName || "",
        });
        d.devices[key] = { ts: Date.now(), name: voterName || "" };
        await save(d);
        return d;
      } catch (e) {
        if (e.code === "ALREADY") throw e;
        lastErr = e;
        await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
      }
    }
    throw lastErr || new Error("Не удалось сохранить голос");
  }

  async function bordaScores(teamId) {
    const cfg = window.POLL_CONFIG;
    const team = cfg.TEAMS[teamId];
    if (!team) return { ranked: [], vote_count: 0 };
    const members = team.members;
    const n = members.length;
    const scores = Object.fromEntries(members.map((m) => [m, 0]));
    let voteCount = 0;
    const data = await load();
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

  async function resetAll() {
    const data = emptyData();
    data.meta.reset_at = Date.now();
    await save(data);
    return data;
  }

  async function totalBallots() {
    const d = await load();
    return (d.votes || []).length;
  }

  function exportJSON() {
    return JSON.stringify(cacheGet(), null, 2);
  }

  async function importJSON(raw) {
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.votes)) throw new Error("Неверный формат");
    const cur = await load();
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
        if (v.device && v.team_id) {
          cur.devices = cur.devices || {};
          cur.devices[v.device + ":" + v.team_id] = { ts: v.ts || Date.now(), name: v.name || "" };
        }
      }
    }
    await save(cur);
    return added;
  }

  async function ping() {
    try {
      await remoteGet();
      return { ok: true, mode: "cloud" };
    } catch (e) {
      return { ok: false, mode: "local", error: String(e.message || e) };
    }
  }

  window.PollStore = {
    load,
    save,
    hasVoted,
    hasVotedLocal,
    addVote,
    bordaScores,
    resetAll,
    exportJSON,
    importJSON,
    totalBallots,
    getDeviceId,
    ping,
    cacheGet,
  };
})();

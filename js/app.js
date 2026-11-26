(function () {
  const cfg = window.POLL_CONFIG;
  const root = document.getElementById("app");

  function takeFlash() {
    try {
      const raw = sessionStorage.getItem("poll_flash");
      if (!raw) return null;
      sessionStorage.removeItem("poll_flash");
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function pushFlash(msg, cat) {
    try {
      sessionStorage.setItem("poll_flash", JSON.stringify({ msg: msg, cat: cat || "success" }));
    } catch (_) {}
  }

  function showFlash(msg, cat) {
    const el = document.getElementById("flash");
    if (!el) return;
    el.innerHTML = `<div class="flash flash-${cat || "success"}">${msg}</div>`;
    setTimeout(() => {
      if (el) el.innerHTML = "";
    }, 5000);
  }

  function applyPendingFlash() {
    const f = takeFlash();
    if (f) showFlash(f.msg, f.cat);
  }

  async function route() {
    const hash = location.hash.slice(1) || "/";
    const [path, qs] = hash.split("?");
    const params = new URLSearchParams(qs || "");
    try {
      if (path === "/" || path === "") await renderIndex();
      else if (path.startsWith("/vote/")) await renderVote(path.split("/")[2]);
      else if (path === "/admin") await renderAdmin(params.get("key") || "");
      else await renderIndex();
      applyPendingFlash();
    } catch (e) {
      root.innerHTML = `<div class="hero"><h1>Error</h1><p class="subtitle">${e.message}</p>
        <a class="back" href="#/">← Home</a></div>`;
    }
  }

  async function renderIndex() {
    document.title = cfg.TITLE;
    root.innerHTML = `<p style="color:#94a3b8;text-align:center;padding:3rem">Loading…</p>`;

    const ping = await PollStore.ping();
    const statusHtml = ping.ok
      ? `<span class="pill success">☁ Database online, votes: ${ping.count || 0}</span>`
      : `<span class="pill danger">⚠ Database unavailable, votes may not sync</span>`;

    const entries = Object.entries(cfg.TEAMS);
    const votedFlags = await PollStore.votedIds();
    const doneCount = entries.filter(([tid]) => votedFlags[tid]).length;

    const teamsHtml = entries
      .map(([tid, team], i) => {
        const done = votedFlags[tid];
        return `
        <a class="team-card ${done ? "done" : ""}"
           href="${done ? "#" : `#/vote/${tid}`}">
          <div class="team-badge">${i + 1}</div>
          <div class="team-info">
            <h2>${team.name}</h2>
            <p>${team.desc || team.members.length + " people"}</p>
          </div>
          <div class="team-action">
            ${
              done
                ? '<span class="pill success">✓ Voted</span>'
                : '<span class="pill">Let’s vote →</span>'
            }
          </div>
        </a>`;
      })
      .join("");

    root.innerHTML = `
      <div id="flash" class="flash-wrap"></div>
      <header class="hero">
        <h1>${cfg.TITLE}</h1>
        ${cfg.SUBTITLE ? `<p class="subtitle">${cfg.SUBTITLE}</p>` : ""}
        <div style="margin-top:12px">${statusHtml}
          <span class="pill">Your votes: ${doneCount} of ${entries.length}</span></div>
      </header>
      <section class="teams">${teamsHtml}</section>`;
  }

  async function renderVote(teamId) {
    const team = cfg.TEAMS[teamId];
    if (!team) {
      location.hash = "#/";
      return;
    }
    if (await PollStore.hasVoted(teamId)) {
      pushFlash("You have already voted in this poll.", "warning");
      location.hash = "#/";
      return;
    }
    document.title = team.name + " — " + cfg.TITLE;
    // Shuffle the starting order so nobody gets an edge from position in the "no idea" tray.
    const order = team.members.slice();
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const cards = order
      .map(
        (m) => `<div class="board-card" data-name="${encodeURIComponent(m)}"><span class="card-name">${m}</span><span class="card-score"></span></div>`
      )
      .join("");

    root.innerHTML = `
      <div id="flash" class="flash-wrap"></div>
      <header class="hero compact">
        <a class="back" href="#/">← Back</a>
        <h1>${team.name}</h1>
        ${team.desc ? `<p class="subtitle poll-desc">${team.desc}</p>` : ""}
        <p class="subtitle">Drag people onto the board: <strong>the higher, the better</strong>. Leave anyone you don't know in the middle, in “No idea”. Horizontal position doesn't matter.</p>
      </header>
      <div class="board" id="board">
        <div class="zone zone-top" data-zone="top"><span class="zone-label">▲ MAX · 100</span></div>
        <div class="zone zone-none" data-zone="none"><span class="zone-label">No idea / don't work with them</span>${cards}</div>
        <div class="zone zone-bottom" data-zone="bottom"><span class="zone-label zone-label-bottom">▼ MIN · 0</span></div>
      </div>
      <div class="actions sticky-actions">
        <span class="pill" id="rank-count">Rated: 0 of ${team.members.length}</span>
        <button type="button" class="btn primary" id="submit-btn">Submit</button>
      </div>`;

    const boardApi = initBoard(document.getElementById("board"), () => {
      document.getElementById("rank-count").textContent = `Rated: ${boardApi.scores().length} of ${team.members.length}`;
    });

    const btn = document.getElementById("submit-btn");
    btn.addEventListener("click", async () => {
      const scored = boardApi.scores();
      const expected = new Set(team.members);
      if (!scored.length || scored.some((x) => !expected.has(x.name))) {
        showFlash("Place at least one person on the board (above or below “No idea”).", "error");
        return;
      }
      btn.disabled = true;
      btn.textContent = "Saving…";
      try {
        await PollStore.addVote(teamId, scored, "");
        pushFlash(`Thanks! Your vote for “${team.name}” is saved.`, "success");
        location.hash = "#/";
      } catch (e) {
        btn.disabled = false;
        btn.textContent = "Submit";
        showFlash(e.message || "Could not save", "error");
      }
    });
  }

  function pluralVotes(n) {
    if (n === 0) return "no votes";
    if (n === 1) return "1 vote";
        return n + " votes";
  }

  async function renderAdmin(key) {
    if (key !== cfg.ADMIN_SECRET || !(await PollStore.isAdmin())) {
      root.innerHTML = `
        <div class="hero">
          <h1>403</h1>
          <p class="subtitle">Access denied.</p>
          <a class="back" href="#/">← Home</a>
        </div>`;
      return;
    }
    document.title = "Results — " + cfg.TITLE;
    root.innerHTML = `<p style="color:#94a3b8;text-align:center;padding:3rem">Loading results…</p>`;

    const allVotes = await PollStore.loadVotes();
    const total = await PollStore.totalBallots(allVotes);
    const ping = await PollStore.ping();
    const pollIds = Object.keys(cfg.TEAMS);
    const people = cfg.PEOPLE || cfg.TEAMS[pollIds[0]].members;
    // Per poll: average percentile score (0..100) over the ballots that ranked the person.
    const scores = {};
    const votesOf = {};
    const counts = {};
    people.forEach((p) => ((scores[p] = {}), (votesOf[p] = 0)));
    const fmt = (v) => (v == null ? "—" : String(Math.round(v)));
    const cardsParts = [];
    for (const tid of pollIds) {
      const res = await PollStore.pollScores(tid, allVotes);
      counts[tid] = res.vote_count;
      res.ranked.forEach((item) => {
        if (!scores[item.name]) return;
        scores[item.name][tid] = item.score;
        votesOf[item.name] += item.votes;
      });
      const rows =
        res.vote_count === 0
          ? `<p class="empty">No votes yet</p>`
          : `<ol class="results-list">
            ${res.ranked
              .map((item) => {
                const top = item.place <= 3 && item.score != null ? "top" : "";
                return `<li class="result-row ${top}">
                  <span class="r-place">${item.place}</span>
                  <span class="r-name">${item.name}</span>
                  <span class="r-pts"><strong>${fmt(item.score)}</strong> <small>· ${item.votes} votes</small></span>
                  <div class="r-bar-wrap"><div class="r-bar" style="width:${item.score || 0}%"></div></div>
                </li>`;
              })
              .join("")}
          </ol>`;
      cardsParts.push(`
        <section class="result-card">
          <div class="result-head">
            <h2>${res.name}</h2>
            <span class="pill">${pluralVotes(res.vote_count)}</span>
          </div>
          ${rows}
        </section>`);
    }

    // Overall = average of the person's poll scores (polls where nobody rated them are left out).
    const summary = people
      .map((name) => {
        const vals = pollIds.map((tid) => scores[name][tid]);
        const have = vals.filter((v) => v != null);
        const total = have.length ? have.reduce((a, v) => a + v, 0) / have.length : null;
        return { name, vals, total, votes: votesOf[name] };
      })
      .sort((a, b) => (b.total ?? -1) - (a.total ?? -1) || b.votes - a.votes || a.name.localeCompare(b.name));
    const summaryHtml = `
      <section class="result-card summary-card">
        <div class="result-head">
          <h2>🏆 Overall ranking</h2>
          <span class="pill">0–100: top of board = 100, bottom = 0</span>
        </div>
        <div class="table-wrap">
          <table class="summary">
            <thead><tr>
              <th>#</th><th class="l">Person</th>
              ${pollIds.map((tid) => `<th title="${cfg.TEAMS[tid].desc || ""}">${cfg.TEAMS[tid].short || cfg.TEAMS[tid].name}<br><small>${pluralVotes(counts[tid])}</small></th>`).join("")}
              <th>Total<br><small>average</small></th>
              <th>Votes<br><small>rated by</small></th>
            </tr></thead>
            <tbody>
              ${summary
                .map(
                  (row, i) => `<tr class="${i < 3 && row.total != null ? "top top" + (i + 1) : ""}">
                <td class="pl">${i + 1}</td>
                <td class="l">${row.name}</td>
                ${row.vals.map((v) => `<td>${fmt(v)}</td>`).join("")}
                <td class="tot">${fmt(row.total)}</td>
                <td class="vc">${row.votes}</td>
              </tr>`
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </section>`;

    root.innerHTML = `
      <div id="flash" class="flash-wrap"></div>
      <header class="hero">
        <a class="back" href="#/">← Home</a>
        <h1>📊 Results</h1>
        <p class="subtitle">Ballots: <strong>${total}</strong> · score = height on the board: top = 100, bottom = 0 (older list ballots: 1st place = 100, last = 0); “No idea” is not counted</p>
        <p class="subtitle">${
          ping.ok
            ? "☁ Database online, ballots: " + (ping.count || 0)
            : "⚠ Database unavailable: " + (ping.error || "")
        }</p>
      </header>

      <div class="reset-box">
        <div>
          <strong>Reset the poll</strong>
          <p class="muted">Deletes ALL votes from the shared database. This cannot be undone.</p>
        </div>
        <button type="button" class="btn danger big" id="btn-reset-main">Reset the poll</button>
      </div>

      ${summaryHtml}
      <div class="admin-grid">${cardsParts.join("")}</div>`;

    async function doReset() {
      if (!confirm("DELETE ALL VOTES from the shared database? This cannot be undone.")) return;
      try {
        await PollStore.resetAll();
        pushFlash("Poll reset. All votes deleted.", "success");
        await renderAdmin(key);
        applyPendingFlash();
      } catch (e) {
        showFlash("Reset failed: " + e.message, "error");
      }
    }

    document.getElementById("btn-reset-main").onclick = doReset;
  }

  window.addEventListener("hashchange", () => {
    route();
  });
  route();
})();

(function () {
  const cfg = window.POLL_CONFIG;
  const root = document.getElementById("app");
  const t = I18N.t;

  // Avatar: photo from cfg.AVATARS if set, otherwise initials on a brand colour picked from the name.
  const AVATAR_COLORS = ["#EB1E2A", "#F26518", "#2196F3", "#489335", "#5833A4", "#D24B69", "#F68C14", "#7A4CD6", "#85001D", "#61B9FF"];
  function avatar(name) {
    const src = (cfg.AVATARS || {})[name];
    if (src) return `<img class="avatar" src="${src}" alt="" draggable="false">`;
    const initials = name.replace(/[^\p{L}\s]/gu, " ").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
    let h = 0;
    for (const ch of name) h = (h * 31 + ch.codePointAt(0)) >>> 0;
    return `<span class="avatar" style="background:${AVATAR_COLORS[h % AVATAR_COLORS.length]}">${initials}</span>`;
  }
  let currentBoard = null; // { teamId, api } while the voting board is shown

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

  let pendingRestore = null;

  // Language switcher, fixed at the top of the page. Switching keeps board placements.
  function renderLangSwitch() {
    let bar = document.getElementById("lang-switch");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "lang-switch";
      bar.className = "lang-switch";
      document.body.insertBefore(bar, document.body.firstChild);
      bar.addEventListener("click", (e) => {
        const b = e.target.closest("button[data-lang]");
        if (!b) return;
        const snap = currentBoard && document.getElementById("board") ? { teamId: currentBoard.teamId, cards: currentBoard.api.snapshot() } : null;
        if (!I18N.setLang(b.getAttribute("data-lang"))) return;
        pendingRestore = snap;
        renderLangSwitch();
        route();
      });
    }
    bar.innerHTML = I18N.LANGS.map(
      ([code, label, full]) =>
        `<button type="button" data-lang="${code}" title="${full}" class="${code === I18N.getLang() ? "active" : ""}">${label}</button>`
    ).join("");
  }

  async function route() {
    currentBoard = null;
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
      root.innerHTML = `<div class="hero"><h1>${t("error")}</h1><p class="subtitle">${e.message}</p>
        <a class="back" href="#/">${t("home")}</a></div>`;
    }
  }

  async function renderIndex() {
    document.title = cfg.TITLE;
    root.innerHTML = `<p style="color:#595959;text-align:center;padding:3rem">${t("loading")}</p>`;

    const ping = await PollStore.ping();
    const statusHtml = ping.ok
      ? `<span class="pill success">${t("dbOnline", { n: ping.count || 0 })}</span>`
      : `<span class="pill danger">${t("dbDown")}</span>`;

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
            <p>${team.desc || t("people", { n: team.members.length })}</p>
          </div>
          <div class="team-action">
            ${
              done
                ? `<span class="pill success">${t("voted")}</span>`
                : `<span class="pill">${t("letsVote")}</span>`
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
          <span class="pill">${t("yourVotes", { a: doneCount, b: entries.length })}</span></div>
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
      pushFlash(t("alreadyVoted"), "warning");
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
        (m) => `<div class="board-card" data-name="${encodeURIComponent(m)}">${avatar(m)}<span class="card-name">${m}</span><span class="card-score"></span></div>`
      )
      .join("");

    root.innerHTML = `
      <div id="flash" class="flash-wrap"></div>
      <header class="hero compact">
        <a class="back" href="#/">${t("back")}</a>
        <h1>${team.name}</h1>
        ${team.desc ? `<p class="subtitle poll-desc">${team.desc}</p>` : ""}
        <p class="subtitle">${t("boardHint")}</p>
      </header>
      <div class="board" id="board">
        <div class="zone zone-top" data-zone="top"><span class="zone-label">▲ MAX · 100</span></div>
        <div class="zone zone-none" data-zone="none"><span class="zone-label">${t("noIdea")}</span>${cards}</div>
        <div class="zone zone-bottom" data-zone="bottom"><span class="zone-label zone-label-bottom">▼ MIN · 0</span></div>
      </div>
      <div class="actions sticky-actions">
        <span class="pill" id="rank-count">${t("rated", { a: 0, b: team.members.length })}</span>
        <button type="button" class="btn primary" id="submit-btn">${t("submit")}</button>
      </div>`;

    const boardApi = initBoard(document.getElementById("board"), () => {
      document.getElementById("rank-count").textContent = t("rated", { a: boardApi.scores().length, b: team.members.length });
    });

    if (pendingRestore && pendingRestore.teamId === teamId) boardApi.restore(pendingRestore.cards);
    pendingRestore = null;
    currentBoard = { teamId, api: boardApi };

    const btn = document.getElementById("submit-btn");
    btn.addEventListener("click", async () => {
      const scored = boardApi.scores();
      const expected = new Set(team.members);
      if (!scored.length || scored.some((x) => !expected.has(x.name))) {
        showFlash(t("needOne"), "error");
        return;
      }
      btn.disabled = true;
      btn.textContent = t("saving");
      try {
        await PollStore.addVote(teamId, scored, "");
        pushFlash(t("thanks", { name: team.name }), "success");
        location.hash = "#/";
      } catch (e) {
        btn.disabled = false;
        btn.textContent = t("submit");
        showFlash(e.message || t("saveFailed"), "error");
      }
    });
  }

  const pluralVotes = (n) => I18N.votes(n);

  async function renderAdmin(key) {
    if (key !== cfg.ADMIN_SECRET || !(await PollStore.isAdmin())) {
      root.innerHTML = `
        <div class="hero">
          <h1>403</h1>
          <p class="subtitle">${t("accessDenied")}</p>
          <a class="back" href="#/">${t("home")}</a>
        </div>`;
      return;
    }
    document.title = t("resultsTitle") + " — " + cfg.TITLE;
    root.innerHTML = `<p style="color:#595959;text-align:center;padding:3rem">${t("loadingResults")}</p>`;

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
          ? `<p class="empty">${t("noVotesYet")}</p>`
          : `<ol class="results-list">
            ${res.ranked
              .map((item) => {
                const top = item.place <= 3 && item.score != null ? "top" : "";
                return `<li class="result-row ${top}">
                  <span class="r-place">${item.place}</span>
                  <span class="r-name">${avatar(item.name)}${item.name}</span>
                  <span class="r-pts"><strong>${fmt(item.score)}</strong> <small>· ${I18N.votes(item.votes)}</small></span>
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
          <h2>${t("overall")}</h2>
          <span class="pill">${t("scale")}</span>
        </div>
        <div class="table-wrap">
          <table class="summary">
            <thead><tr>
              <th>#</th><th class="l">${t("person")}</th>
              ${pollIds.map((tid) => `<th title="${cfg.TEAMS[tid].desc || ""}">${cfg.TEAMS[tid].short || cfg.TEAMS[tid].name}<br><small>${pluralVotes(counts[tid])}</small></th>`).join("")}
              <th>${t("total")}<br><small>${t("average")}</small></th>
              <th>${t("votesCol")}<br><small>${t("ratedBy")}</small></th>
            </tr></thead>
            <tbody>
              ${summary
                .map(
                  (row, i) => `<tr class="${i < 3 && row.total != null ? "top top" + (i + 1) : ""}">
                <td class="pl">${i + 1}</td>
                <td class="l"><span class="who">${avatar(row.name)}${row.name}</span></td>
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
        <a class="back" href="#/">${t("home")}</a>
        <h1>${t("results")}</h1>
        <p class="subtitle">${t("ballotsLine", { n: total })}</p>
        <p class="subtitle">${
          ping.ok
            ? t("dbOnlineBallots", { n: ping.count || 0 })
            : t("dbDownErr", { e: ping.error || "" })
        }</p>
      </header>

      <div class="reset-box">
        <div>
          <strong>${t("resetTitle")}</strong>
          <p class="muted">${t("resetDesc")}</p>
        </div>
        <button type="button" class="btn danger big" id="btn-reset-main">${t("resetBtn")}</button>
      </div>

      ${summaryHtml}
      <div class="admin-grid">${cardsParts.join("")}</div>`;

    async function doReset() {
      if (!confirm(t("resetConfirm"))) return;
      try {
        await PollStore.resetAll();
        pushFlash(t("resetDone"), "success");
        await renderAdmin(key);
        applyPendingFlash();
      } catch (e) {
        showFlash(t("resetFailed") + ": " + e.message, "error");
      }
    }

    document.getElementById("btn-reset-main").onclick = doReset;
  }

  renderLangSwitch();
  window.addEventListener("hashchange", () => {
    route();
  });
  route();
})();

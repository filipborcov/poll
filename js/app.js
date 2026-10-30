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
      root.innerHTML = `<div class="hero"><h1>Ошибка</h1><p class="subtitle">${e.message}</p>
        <a class="back" href="#/">← На главную</a></div>`;
    }
  }

  async function renderIndex() {
    document.title = cfg.TITLE;
    root.innerHTML = `<p style="color:#94a3b8;text-align:center;padding:3rem">Загрузка…</p>`;

    const ping = await PollStore.ping();
    const statusHtml = ping.ok
      ? `<span class="pill success">☁ База онлайн, голосов: ${ping.count || 0}</span>`
      : `<span class="pill danger">⚠ База недоступна — голоса могут не синхронизироваться</span>`;

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
            <p>${team.desc || team.members.length + " участников"}</p>
          </div>
          <div class="team-action">
            ${
              done
                ? '<span class="pill success">✓ Голос учтён</span>'
                : '<span class="pill">Lets Vote →</span>'
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
          <span class="pill">Ваши голоса: ${doneCount} из ${entries.length}</span></div>
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
      pushFlash("Вы уже проголосовали в этом голосовании.", "warning");
      location.hash = "#/";
      return;
    }
    document.title = team.name + " — " + cfg.TITLE;
    // Shuffle the starting order so nobody gets an edge from list position.
    const order = team.members.slice();
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const items = order
      .map(
        (m, i) => `
      <li class="rank-item" data-name="${encodeURIComponent(m)}" draggable="true">
        <span class="handle" title="Перетащить">⠿</span>
        <span class="place">${i + 1}</span>
        <span class="name">${m}</span>
      </li>`
      )
      .join("");

    root.innerHTML = `
      <div id="flash" class="flash-wrap"></div>
      <header class="hero compact">
        <a class="back" href="#/">← Назад</a>
        <h1>${team.name}</h1>
        ${team.desc ? `<p class="subtitle poll-desc">${team.desc}</p>` : ""}
        <p class="subtitle">Перетащите карточки: <strong>1 место = лучший</strong>. Обязательно расставьте всех.</p>
      </header>
      <div class="hint-bar">
        <span>↑ Лучше</span>
        <span>${team.members.length} / ${team.members.length}</span>
        <span>Хуже ↓</span>
      </div>
      <ul id="sortable" class="rank-list" aria-label="Список для ранжирования">
        ${items}
      </ul>
      <div class="actions sticky-actions">
        <button type="button" class="btn primary" id="submit-btn">Отправить рейтинг</button>
      </div>`;

    const list = document.getElementById("sortable");
    initSortable(list);
    const btn = document.getElementById("submit-btn");
    btn.addEventListener("click", async () => {
      const ranking = getRanking(list);
      const expected = new Set(team.members);
      if (ranking.length !== expected.size || ranking.some((n) => !expected.has(n))) {
        showFlash("Нужно расставить ВСЕХ участников.", "error");
        return;
      }
      const voterName = "";
      btn.disabled = true;
      btn.textContent = "Сохраняем…";
      try {
        await PollStore.addVote(teamId, ranking, voterName);
        pushFlash(`Спасибо! Голос за «${team.name}» сохранён в общую базу.`, "success");
        location.hash = "#/";
      } catch (e) {
        btn.disabled = false;
        btn.textContent = "Отправить рейтинг";
        showFlash(e.message || "Ошибка сохранения", "error");
      }
    });
  }

  function pluralVotes(n) {
    if (n === 0) return "нет голосов";
    if (n === 1) return "1 голос";
    if (n >= 2 && n <= 4) return n + " голоса";
    return n + " голосов";
  }

  async function renderAdmin(key) {
    if (key !== cfg.ADMIN_SECRET || !(await PollStore.isAdmin())) {
      root.innerHTML = `
        <div class="hero">
          <h1>403</h1>
          <p class="subtitle">Нет доступа.</p>
          <a class="back" href="#/">← На главную</a>
        </div>`;
      return;
    }
    document.title = "Результаты — " + cfg.TITLE;
    root.innerHTML = `<p style="color:#94a3b8;text-align:center;padding:3rem">Загрузка результатов…</p>`;

    const allVotes = await PollStore.loadVotes();
    const total = await PollStore.totalBallots(allVotes);
    const ping = await PollStore.ping();
    const pollIds = Object.keys(cfg.TEAMS);
    const people = cfg.PEOPLE || cfg.TEAMS[pollIds[0]].members;
    const n = people.length;
    // Per poll: average Borda score per ballot (1..N), so polls with more voters don't weigh more.
    const avg = {};
    const counts = {};
    people.forEach((p) => (avg[p] = {}));
    const cardsParts = [];
    for (const tid of pollIds) {
      const res = await PollStore.bordaScores(tid, allVotes);
      counts[tid] = res.vote_count;
      res.ranked.forEach((item) => {
        if (avg[item.name]) avg[item.name][tid] = res.vote_count ? item.points / res.vote_count : null;
      });
      const rows =
        res.vote_count === 0
          ? `<p class="empty">Пока нет голосов</p>`
          : `<ol class="results-list">
            ${res.ranked
              .map((item) => {
                const pct = item.max_points ? (item.points / item.max_points) * 100 : 0;
                const top = item.place <= 3 ? "top" : "";
                return `<li class="result-row ${top}">
                  <span class="r-place">${item.place}</span>
                  <span class="r-name">${item.name}</span>
                  <span class="r-pts"><strong>${item.points}</strong> <small>очк.</small></span>
                  <div class="r-bar-wrap"><div class="r-bar" style="width:${pct}%"></div></div>
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

    const summary = people
      .map((name) => {
        const vals = pollIds.map((tid) => avg[name][tid]);
        const total = vals.reduce((a, v) => a + (v || 0), 0);
        return { name, vals, total };
      })
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
    const fmt = (v) => (v == null ? "—" : v.toFixed(1));
    const maxTotal = n * pollIds.length;
    const summaryHtml = `
      <section class="result-card summary-card">
        <div class="result-head">
          <h2>🏆 Общий рейтинг</h2>
          <span class="pill">средний балл, макс. ${n} за голосование</span>
        </div>
        <div class="table-wrap">
          <table class="summary">
            <thead><tr>
              <th>#</th><th class="l">Человек</th>
              ${pollIds.map((tid) => `<th title="${cfg.TEAMS[tid].desc || ""}">${cfg.TEAMS[tid].short || cfg.TEAMS[tid].name}<br><small>${pluralVotes(counts[tid])}</small></th>`).join("")}
              <th>Итого<br><small>из ${maxTotal}</small></th>
            </tr></thead>
            <tbody>
              ${summary
                .map(
                  (row, i) => `<tr class="${i < 3 ? "top top" + (i + 1) : ""}">
                <td class="pl">${i + 1}</td>
                <td class="l">${row.name}</td>
                ${row.vals.map((v) => `<td>${fmt(v)}</td>`).join("")}
                <td class="tot">${row.total.toFixed(1)}</td>
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
        <a class="back" href="#/">← На главную</a>
        <h1>📊 Результаты</h1>
        <p class="subtitle">Всего бюллетеней: <strong>${total}</strong> · Borda: 1 место = N очков, последнее = 1</p>
        <p class="subtitle">${
          ping.ok
            ? "☁ База онлайн, бюллетеней: " + (ping.count || 0)
            : "⚠ Облако недоступно: " + (ping.error || "")
        }</p>
      </header>

      <div class="reset-box">
        <div>
          <strong>Скинуть голосование</strong>
          <p class="muted">Удалит ВСЕ голоса из общей базы. Действие необратимо.</p>
        </div>
        <button type="button" class="btn danger big" id="btn-reset-main">Скинуть голосование</button>
      </div>

      ${summaryHtml}
      <div class="admin-grid">${cardsParts.join("")}</div>`;

    async function doReset() {
      if (!confirm("СКИНУТЬ ВСЕ ГОЛОСА из общей базы? Это нельзя отменить.")) return;
      try {
        await PollStore.resetAll();
        pushFlash("Голосование сброшено. Все голоса удалены.", "success");
        await renderAdmin(key);
        applyPendingFlash();
      } catch (e) {
        showFlash("Ошибка сброса: " + e.message, "error");
      }
    }

    document.getElementById("btn-reset-main").onclick = doReset;
  }

  window.addEventListener("hashchange", () => {
    route();
  });
  route();
})();

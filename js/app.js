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
      ? `<span class="pill success">☁ Общая база подключена</span>`
      : `<span class="pill danger">⚠ База недоступна — голоса могут не синхронизироваться</span>`;

    const entries = Object.entries(cfg.TEAMS);
    const votedFlags = {};
    for (const [tid] of entries) {
      votedFlags[tid] = await PollStore.hasVoted(tid);
    }

    const teamsHtml = entries
      .map(([tid, team], i) => {
        const done = votedFlags[tid];
        return `
        <a class="team-card ${done ? "done" : ""}"
           href="${done ? "#" : `#/vote/${tid}`}">
          <div class="team-badge">${i + 1}</div>
          <div class="team-info">
            <h2>${team.name}</h2>
            <p>${team.members.length} участников</p>
          </div>
          <div class="team-action">
            ${
              done
                ? '<span class="pill success">✓ Голос учтён</span>'
                : '<span class="pill">Ранжировать →</span>'
            }
          </div>
        </a>`;
      })
      .join("");

    root.innerHTML = `
      <div id="flash" class="flash-wrap"></div>
      <header class="hero">
        <h1>${cfg.TITLE}</h1>
        <p class="subtitle">${cfg.SUBTITLE}</p>
        <div style="margin-top:12px">${statusHtml}</div>
      </header>
      <section class="teams">${teamsHtml}</section>
      <footer class="foot">
        <p>Один голос на команду с этого устройства. Расставьте всех от <strong>самого значимого</strong> (верх) к менее значимому (низ).</p>
        <a class="admin-link" href="#/admin?key=${encodeURIComponent(cfg.ADMIN_SECRET)}">Результаты (админ)</a>
      </footer>`;
  }

  async function renderVote(teamId) {
    const team = cfg.TEAMS[teamId];
    if (!team) {
      location.hash = "#/";
      return;
    }
    if (await PollStore.hasVoted(teamId)) {
      pushFlash("Вы уже проголосовали за эту команду.", "warning");
      location.hash = "#/";
      return;
    }
    document.title = team.name + " — " + cfg.TITLE;
    const items = team.members
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
        <p class="subtitle">Перетащите карточки: <strong>1 место = самый значимый</strong>. Обязательно расставьте всех.</p>
      </header>
      <div class="voter-box">
        <label for="voter-name">Ваше имя <span class="muted">(необязательно)</span></label>
        <input id="voter-name" type="text" placeholder="Как вас записать в журнал голосов" maxlength="80" />
      </div>
      <div class="hint-bar">
        <span>↑ Более значимый</span>
        <span>${team.members.length} / ${team.members.length}</span>
        <span>Менее значимый ↓</span>
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
      const voterName = (document.getElementById("voter-name").value || "").trim();
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
    if (key !== cfg.ADMIN_SECRET) {
      root.innerHTML = `
        <div class="hero">
          <h1>403</h1>
          <p class="subtitle">Неверный ключ. Откройте <code>/#/admin?key=…</code></p>
          <a class="back" href="#/">← На главную</a>
        </div>`;
      return;
    }
    document.title = "Результаты — " + cfg.TITLE;
    root.innerHTML = `<p style="color:#94a3b8;text-align:center;padding:3rem">Загрузка результатов…</p>`;

    const total = await PollStore.totalBallots();
    const ping = await PollStore.ping();
    const cardsParts = [];
    for (const tid of Object.keys(cfg.TEAMS)) {
      const res = await PollStore.bordaScores(tid);
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

    root.innerHTML = `
      <div id="flash" class="flash-wrap"></div>
      <header class="hero">
        <a class="back" href="#/">← На главную</a>
        <h1>📊 Результаты</h1>
        <p class="subtitle">Всего бюллетеней: <strong>${total}</strong> · Borda: 1 место = N очков, последнее = 1</p>
        <p class="subtitle">${
          ping.ok
            ? "☁ Голоса в общей облачной базе (все устройства)"
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

      <div class="admin-grid">${cardsParts.join("")}</div>
      <div class="import-box">
        <strong>Экспорт / импорт (резервная копия)</strong>
        <textarea id="io-json" placeholder="JSON голосов…"></textarea>
        <div class="row">
          <button type="button" class="btn secondary" id="btn-export">Экспорт</button>
          <button type="button" class="btn secondary" id="btn-import">Импорт (merge)</button>
          <button type="button" class="btn danger" id="btn-reset">Скинуть голосование</button>
        </div>
      </div>
      <footer class="foot">
        <p>Админ-ссылка: <code>/#/admin?key=${cfg.ADMIN_SECRET}</code></p>
      </footer>`;

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
    document.getElementById("btn-reset").onclick = doReset;

    document.getElementById("btn-export").onclick = async () => {
      try {
        const d = await PollStore.load();
        document.getElementById("io-json").value = JSON.stringify(d, null, 2);
        showFlash("Экспортировано.", "success");
      } catch (e) {
        showFlash(e.message, "error");
      }
    };
    document.getElementById("btn-import").onclick = async () => {
      try {
        const n = await PollStore.importJSON(document.getElementById("io-json").value);
        showFlash(`Добавлено новых голосов: ${n}`, "success");
        await renderAdmin(key);
        applyPendingFlash();
      } catch (e) {
        showFlash("Ошибка импорта: " + e.message, "error");
      }
    };
  }

  window.addEventListener("hashchange", () => {
    route();
  });
  route();
})();

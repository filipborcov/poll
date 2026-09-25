(function () {
  const cfg = window.POLL_CONFIG;
  const root = document.getElementById("app");

  function flash(msg, cat) {
    const el = document.getElementById("flash");
    if (!el) return;
    el.innerHTML = `<div class="flash flash-${cat || "success"}">${msg}</div>`;
    setTimeout(() => { el.innerHTML = ""; }, 4000);
  }

  function route() {
    const hash = location.hash.slice(1) || "/";
    const [path, qs] = hash.split("?");
    const params = new URLSearchParams(qs || "");
    if (path === "/" || path === "") renderIndex();
    else if (path.startsWith("/vote/")) renderVote(path.split("/")[2]);
    else if (path === "/admin") renderAdmin(params.get("key") || "");
    else renderIndex();
  }

  function renderIndex() {
    document.title = cfg.TITLE;
    const teamsHtml = Object.entries(cfg.TEAMS)
      .map(([tid, team], i) => {
        const done = PollStore.hasVoted(tid);
        return `
        <a class="team-card ${done ? "done" : ""}"
           href="${done ? "#" : `#/vote/${tid}`}">
          <div class="team-badge">${i + 1}</div>
          <div class="team-info">
            <h2>${team.name}</h2>
            <p>${team.members.length} участников</p>
          </div>
          <div class="team-action">
            ${done
              ? '<span class="pill success">✓ Голос учтён</span>'
              : '<span class="pill">Ранжировать →</span>'}
          </div>
        </a>`;
      })
      .join("");

    root.innerHTML = `
      <div id="flash" class="flash-wrap"></div>
      <header class="hero">
        <h1>${cfg.TITLE}</h1>
        <p class="subtitle">${cfg.SUBTITLE}</p>
      </header>
      <section class="teams">${teamsHtml}</section>
      <footer class="foot">
        <p>Один голос на команду с этого устройства. Расставьте всех от <strong>самого значимого</strong> (верх) к менее значимому (низ).</p>
        <a class="admin-link" href="#/admin?key=${encodeURIComponent(cfg.ADMIN_SECRET)}">Результаты (админ)</a>
      </footer>`;
  }

  function renderVote(teamId) {
    const team = cfg.TEAMS[teamId];
    if (!team) { location.hash = "#/"; return; }
    if (PollStore.hasVoted(teamId)) {
      flash("Вы уже проголосовали за эту команду.", "warning");
      location.hash = "#/";
      return;
    }
    document.title = team.name + " — " + cfg.TITLE;
    const items = team.members
      .map(
        (m, i) => `
      <li class="rank-item" data-name="${m.replace(/"/g, """)}" draggable="true">
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
    document.getElementById("submit-btn").addEventListener("click", () => {
      const ranking = getRanking(list);
      const expected = new Set(team.members);
      if (ranking.length !== expected.size || ranking.some((n) => !expected.has(n))) {
        flash("Нужно расставить ВСЕХ участников.", "error");
        return;
      }
      PollStore.addVote(teamId, ranking);
      flash(`Спасибо! Ваш рейтинг для «${team.name}» сохранён.`, "success");
      location.hash = "#/";
    });
  }

  function pluralVotes(n) {
    if (n === 0) return "нет голосов";
    if (n === 1) return "1 голос";
    if (n >= 2 && n <= 4) return n + " голоса";
    return n + " голосов";
  }

  function renderAdmin(key) {
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
    const total = PollStore.totalBallots();
    const cards = Object.keys(cfg.TEAMS)
      .map((tid) => {
        const res = PollStore.bordaScores(tid);
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
        return `
        <section class="result-card">
          <div class="result-head">
            <h2>${res.name}</h2>
            <span class="pill">${pluralVotes(res.vote_count)}</span>
          </div>
          ${rows}
        </section>`;
      })
      .join("");

    root.innerHTML = `
      <div id="flash" class="flash-wrap"></div>
      <header class="hero">
        <a class="back" href="#/">← На главную</a>
        <h1>📊 Результаты</h1>
        <p class="subtitle">Всего бюллетеней: <strong>${total}</strong> · Borda: 1 место = N очков, последнее = 1</p>
      </header>
      <div class="note-banner">
        Голоса хранятся в браузере (localStorage). Чтобы объединить голоса с других устройств — экспортируйте JSON у каждого и импортируйте здесь.
      </div>
      <div class="admin-grid">${cards}</div>
      <div class="import-box">
        <strong>Экспорт / импорт голосов</strong>
        <textarea id="io-json" placeholder="JSON голосов…"></textarea>
        <div class="row">
          <button type="button" class="btn secondary" id="btn-export">Экспорт</button>
          <button type="button" class="btn secondary" id="btn-import">Импорт (merge)</button>
          <button type="button" class="btn danger" id="btn-reset">Сбросить все голоса</button>
        </div>
      </div>
      <footer class="foot">
        <p>Админ-ссылка: <code>/#/admin?key=${cfg.ADMIN_SECRET}</code></p>
      </footer>`;

    document.getElementById("btn-export").onclick = () => {
      document.getElementById("io-json").value = PollStore.exportJSON();
      flash("Экспортировано в поле ниже.", "success");
    };
    document.getElementById("btn-import").onclick = () => {
      try {
        const n = PollStore.importJSON(document.getElementById("io-json").value);
        flash(`Добавлено новых голосов: ${n}`, "success");
        renderAdmin(key);
      } catch (e) {
        flash("Ошибка импорта: " + e.message, "error");
      }
    };
    document.getElementById("btn-reset").onclick = () => {
      if (confirm("Сбросить ВСЕ голоса на этом устройстве?")) {
        PollStore.resetAll();
        flash("Все голоса сброшены.", "success");
        renderAdmin(key);
      }
    };
  }

  window.addEventListener("hashchange", route);
  route();
})();

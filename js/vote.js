(function () {
  // Free-placement board: three zones stacked vertically.
  //   top zone    -> score 100 (top edge) .. 50 (bottom edge)
  //   "no idea"   -> not rated
  //   bottom zone -> score 50 (top edge) .. 0 (bottom edge)
  // Horizontal position means nothing; it only lets people spread cards out.
  // Works with mouse and touch through Pointer Events.

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function scoreFor(zone, fracY) {
    // fracY: card centre within the zone, 0 = top edge, 1 = bottom edge.
    if (zone === "top") return Math.round(100 - 50 * fracY);
    if (zone === "bottom") return Math.round(50 - 50 * fracY);
    return null;
  }

  function initBoard(board, onChange) {
    const zones = {
      top: board.querySelector('[data-zone="top"]'),
      none: board.querySelector('[data-zone="none"]'),
      bottom: board.querySelector('[data-zone="bottom"]'),
    };
    let drag = null;
    let scrollRaf = 0;
    let lastPointer = null;

    function cardScore(card) {
      const zone = card.parentElement && card.parentElement.getAttribute("data-zone");
      if (zone !== "top" && zone !== "bottom") return null;
      const fy = parseFloat(card.dataset.fy || "0.5");
      return scoreFor(zone, fy);
    }

    function paint(card) {
      const s = cardScore(card);
      const badge = card.querySelector(".card-score");
      if (badge) badge.textContent = s == null ? "" : String(s);
      card.classList.toggle("placed", s != null);
    }

    function zoneAt(clientY) {
      for (const key of ["top", "none", "bottom"]) {
        const r = zones[key].getBoundingClientRect();
        if (clientY >= r.top && clientY <= r.bottom) return key;
      }
      const topR = zones.top.getBoundingClientRect();
      return clientY < topR.top ? "top" : "bottom";
    }

    function placeIn(card, zone, clientX, clientY) {
      const z = zones[zone];
      if (zone === "none") {
        card.style.left = card.style.top = "";
        delete card.dataset.fx;
        delete card.dataset.fy;
        z.appendChild(card);
      } else {
        z.appendChild(card);
        const r = z.getBoundingClientRect();
        const w = card.offsetWidth, h = card.offsetHeight;
        // Keep the whole card inside the zone; store the centre as fractions.
        const cx = clamp(clientX - r.left, w / 2, r.width - w / 2);
        const cy = clamp(clientY - r.top, h / 2, r.height - h / 2);
        const fx = r.width > w ? (cx - w / 2) / (r.width - w) : 0;
        const fy = r.height > h ? (cy - h / 2) / (r.height - h) : 0.5;
        card.dataset.fx = fx.toFixed(4);
        card.dataset.fy = fy.toFixed(4);
        card.style.left = `calc(${(fx * 100).toFixed(2)}% - ${(fx * w).toFixed(1)}px)`;
        card.style.top = `calc(${(fy * 100).toFixed(2)}% - ${(fy * h).toFixed(1)}px)`;
      }
      paint(card);
    }

    function autoScroll() {
      scrollRaf = 0;
      if (!drag || !lastPointer) return;
      const edge = 70, y = lastPointer.y, vh = window.innerHeight;
      let dy = 0;
      if (y < edge) dy = -Math.ceil((edge - y) / 5);
      else if (y > vh - edge) dy = Math.ceil((y - (vh - edge)) / 5);
      if (dy) {
        window.scrollBy(0, dy);
        scrollRaf = requestAnimationFrame(autoScroll);
      }
    }

    function onDown(e) {
      const card = e.target.closest(".board-card");
      if (!card || !board.contains(card) || (e.button != null && e.button !== 0)) return;
      e.preventDefault();
      const r = card.getBoundingClientRect();
      drag = { card, dx: e.clientX - (r.left + r.width / 2), dy: e.clientY - (r.top + r.height / 2), id: e.pointerId };
      card.setPointerCapture && card.setPointerCapture(e.pointerId);
      card.classList.add("dragging");
      card.style.width = r.width + "px";
      card.style.position = "fixed";
      card.style.left = r.left + "px";
      card.style.top = r.top + "px";
      lastPointer = { x: e.clientX, y: e.clientY };
    }

    function onMove(e) {
      if (!drag || e.pointerId !== drag.id) return;
      e.preventDefault();
      const c = drag.card;
      c.style.left = e.clientX - drag.dx - c.offsetWidth / 2 + "px";
      c.style.top = e.clientY - drag.dy - c.offsetHeight / 2 + "px";
      lastPointer = { x: e.clientX, y: e.clientY };
      const z = zoneAt(e.clientY - drag.dy);
      for (const k in zones) zones[k].classList.toggle("drop-target", k === z);
      if (!scrollRaf) scrollRaf = requestAnimationFrame(autoScroll);
    }

    function onUp(e) {
      if (!drag || e.pointerId !== drag.id) return;
      const c = drag.card;
      const cx = e.clientX - drag.dx, cy = e.clientY - drag.dy;
      c.classList.remove("dragging");
      c.style.position = c.style.width = "";
      for (const k in zones) zones[k].classList.remove("drop-target");
      placeIn(c, zoneAt(cy), cx, cy);
      drag = null;
      if (onChange) onChange();
    }

    board.addEventListener("pointerdown", onDown);
    board.addEventListener("pointermove", onMove);
    board.addEventListener("pointerup", onUp);
    board.addEventListener("pointercancel", onUp);
    board.querySelectorAll(".board-card").forEach(paint);

    return {
      // [{name, score}] for every card placed outside "no idea".
      scores() {
        return Array.from(board.querySelectorAll(".board-card"))
          .map((c) => ({ name: decodeURIComponent(c.getAttribute("data-name") || ""), score: cardScore(c) }))
          .filter((x) => x.score != null);
      },
      // Board state, to keep placements when the page is re-rendered (e.g. language switch).
      snapshot() {
        return Array.from(board.querySelectorAll(".board-card"))
          .filter((c) => c.dataset.fy != null)
          .map((c) => ({ name: c.getAttribute("data-name"), zone: c.parentElement.getAttribute("data-zone"), fx: +c.dataset.fx, fy: +c.dataset.fy }));
      },
      restore(list) {
        for (const it of list || []) {
          const card = Array.from(board.querySelectorAll(".board-card")).find((c) => c.getAttribute("data-name") === it.name);
          const z = zones[it.zone];
          if (!card || !z || it.zone === "none") continue;
          z.appendChild(card);
          const w = card.offsetWidth, h = card.offsetHeight;
          card.dataset.fx = String(it.fx);
          card.dataset.fy = String(it.fy);
          card.style.left = `calc(${(it.fx * 100).toFixed(2)}% - ${(it.fx * w).toFixed(1)}px)`;
          card.style.top = `calc(${(it.fy * 100).toFixed(2)}% - ${(it.fy * h).toFixed(1)}px)`;
          paint(card);
        }
        if (onChange) onChange();
      },
      placeIn,
      zones,
    };
  }

  window.initBoard = initBoard;
  window.boardScoreFor = scoreFor;
})();

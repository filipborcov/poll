(function () {
  function initSortable(list) {
    if (!list) return;
    let dragEl = null;

    function renumber() {
      list.querySelectorAll(".rank-item").forEach((li, i) => {
        const place = li.querySelector(".place");
        if (place) place.textContent = String(i + 1);
      });
    }

    list.querySelectorAll(".rank-item").forEach((item) => {
      item.addEventListener("dragstart", (e) => {
        dragEl = item;
        item.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", item.getAttribute("data-name"));
      });
      item.addEventListener("dragend", () => {
        item.classList.remove("dragging");
        list.querySelectorAll(".rank-item").forEach((el) => el.classList.remove("drag-over"));
        dragEl = null;
        renumber();
      });
      item.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        const target = e.currentTarget;
        if (!dragEl || target === dragEl) return;
        target.classList.add("drag-over");
        const rect = target.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        if (e.clientY < mid) list.insertBefore(dragEl, target);
        else list.insertBefore(dragEl, target.nextSibling);
        renumber();
      });
      item.addEventListener("dragleave", (e) => {
        e.currentTarget.classList.remove("drag-over");
      });
      item.addEventListener("drop", (e) => {
        e.preventDefault();
        e.currentTarget.classList.remove("drag-over");
        renumber();
      });
    });

    let touchItem = null;
    list.querySelectorAll(".rank-item").forEach((item) => {
      item.addEventListener("touchstart", () => {
        touchItem = item;
        item.classList.add("dragging");
      }, { passive: true });
    });
    list.addEventListener("touchmove", (e) => {
      if (!touchItem) return;
      e.preventDefault();
      const touch = e.touches[0];
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      const target = el && el.closest(".rank-item");
      if (target && target !== touchItem && list.contains(target)) {
        const rect = target.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        if (touch.clientY < mid) list.insertBefore(touchItem, target);
        else list.insertBefore(touchItem, target.nextSibling);
        renumber();
      }
    }, { passive: false });
    list.addEventListener("touchend", () => {
      if (touchItem) {
        touchItem.classList.remove("dragging");
        touchItem = null;
        renumber();
      }
    }, { passive: true });
  }

  window.initSortable = initSortable;
  window.getRanking = function (list) {
    return Array.from(list.querySelectorAll(".rank-item")).map(
      (li) => li.getAttribute("data-name")
    );
  };
})();

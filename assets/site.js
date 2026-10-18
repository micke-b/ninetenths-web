/* The header's Menu button on narrow screens: opens and closes the menu panel. */
"use strict";
(() => {
  const btn = document.querySelector(".top__menu"), menu = document.getElementById("menu");
  if (!btn || !menu) return;
  const set = open => {
    menu.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
    btn.textContent = open ? "Close" : "Menu";
  };
  btn.addEventListener("click", () => set(menu.hidden));
  menu.addEventListener("click", e => { if (e.target.closest("a")) set(false); });
  addEventListener("keydown", e => { if (e.key === "Escape" && !menu.hidden) { set(false); btn.focus(); } });
  matchMedia("(min-width: 981px)").addEventListener("change", e => { if (e.matches) set(false); });
})();

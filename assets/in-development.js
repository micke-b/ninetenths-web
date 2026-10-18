/* In development: drives the live gauge (in-development/gauge.html, the gauge's browser mock),
   the user manual's Try buttons and the warm-up shift dial. */
"use strict";
(() => {
  const $ = id => document.getElementById(id);
  const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");

  /* ---- the live gauge: messages to the embedded mock (tools/gauge-embed.html) ---- */
  const gauge = $("gauge");
  let ready = false;
  const queue = [];
  const send = m => {
    const msg = Object.assign({ grg: 1 }, m);
    if (ready && gauge.contentWindow) gauge.contentWindow.postMessage(msg, location.origin);
    else queue.push(msg);
  };
  gauge.addEventListener("load", () => {
    ready = true;
    while (queue.length) gauge.contentWindow.postMessage(queue.shift(), location.origin);
  });

  /* what to watch, per demo */
  const NOTES = {
    drive: "<b>On track.</b> A simulated lap: watch boost build, the shift light flash at 6500 and the temperatures settle.",
    cold: "<b>Cold start.</b> The status reads COLD, and the shift ladder starts at 4500 rpm. Both move up as the oil warms.",
    heatsoak: "<b>Heat soak.</b> Intake and charge-air temps climb, their trend wedges point up and the status says COOL DOWN.",
    tuned: "<b>Tuned car.</b> Boost runs past 2.0 bar and the scale widens to 2.5, then 3.0 bar on its own. It remembers.",
    pit: "<b>Pit stop.</b> After 20 s of idle the turbo timer counts down, and the tires page shows how much to add or bleed.",
    lean: "<b>Lean and knock.</b> Under boost the mixture runs leaner than commanded and the ECU pulls timing: both turn orange.",
    oiltemp: "<b>Oil overheats.</b> Past 130 °C the warning takes over the screen. Tap the gauge to acknowledge it.",
    puncture: "<b>Slow puncture, front left.</b> The corner turns orange, then the TIRE FL warning takes over under 1.6 bar.",
    oilp: "<b>Oil pressure drops.</b> Under the minimum for the rpm, the OIL P warning takes over the screen.",
    alt: "<b>Alternator stops charging.</b> After 10 s under 12.0 V with the engine running, BATT takes over.",
    mute: "<b>A control unit goes quiet.</b> Its readings dim after one second and turn to dashes after three. Nothing stale is shown as live.",
    restart: "<b>Restarted.</b> The start-up animation runs, then the simulated car drives off. Tap the gauge to skip the animation.",
    next: "<b>Tap.</b> The next page. Tap the gauge itself to do the same.",
    prev: "<b>Swipe right.</b> The previous page; swipe left for the next. Swipe on the gauge itself to do the same.",
    settings: "<b>Settings.</b> Tap the − and + bars to change a value, swipe for the next screen, DONE to leave. They close by themselves after 15 s.",
  };
  const note = $("note");
  const runs = [...document.querySelectorAll(".chips [data-run]")];
  const tour = [...document.querySelectorAll(".tour [data-page]")];
  const showPage = p => tour.forEach(b => b.setAttribute("aria-pressed", String(+b.dataset.page === p)));
  const showRun = name => runs.forEach(b => b.setAttribute("aria-pressed", String(b.dataset.run === name)));
  const narrow = matchMedia("(max-width: 1079px)");
  const toGauge = () => { if (narrow.matches) gauge.closest(".rig").scrollIntoView({ block: "start" }); };

  function run(name, page) {
    send({ run: name, page });
    showRun(name);
    note.innerHTML = NOTES[name];
    showPage(page);
  }
  function restart() {
    ready = false;
    queue.length = 0;
    gauge.contentWindow.location.reload();      /* the boot animation plays again; page and units are remembered */
    showRun("drive");
    note.innerHTML = NOTES.restart;
  }
  note.innerHTML = NOTES.drive;
  runs.forEach(b => b.addEventListener("click", () => run(b.dataset.run, +b.dataset.page)));
  document.querySelectorAll(".warns [data-run], .manual [data-run]").forEach(b =>
    b.addEventListener("click", () => { run(b.dataset.run, +b.dataset.page); toGauge(); }));
  document.querySelectorAll(".manual [data-nav]").forEach(b =>
    b.addEventListener("click", () => { send({ nav: b.dataset.nav }); note.innerHTML = NOTES[b.dataset.nav]; toGauge(); }));
  $("restart").addEventListener("click", restart);
  document.querySelectorAll("[data-restart]").forEach(b => b.addEventListener("click", () => { restart(); toGauge(); }));
  tour.forEach(b => b.addEventListener("click", () => { send({ page: +b.dataset.page }); showPage(+b.dataset.page); toGauge(); }));

  const unitBtns = [...document.querySelectorAll("[data-units]")];
  const showUnits = u => unitBtns.forEach(b => b.setAttribute("aria-pressed", String(b.dataset.units === u)));
  unitBtns.forEach(b => b.addEventListener("click", () => { send({ units: b.dataset.units }); showUnits(b.dataset.units); }));

  /* the gauge reports its page and units (it can be tapped directly) */
  addEventListener("message", e => {
    const m = e.data;
    if (!m || m.grg !== 1 || e.source !== gauge.contentWindow) return;
    if (Number.isInteger(m.page)) showPage(m.page);
    if (typeof m.units === "string") showUnits(m.units);
  });

  /* on a wide screen the gauge follows the section you are reading */
  let lastPage = -1;
  const io = new IntersectionObserver(entries => {
    if (narrow.matches) return;
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      const p = +en.target.dataset.page;
      if (p !== lastPage) { lastPage = p; send({ page: p }); showPage(p); }
    }
  }, { rootMargin: "-45% 0px -50% 0px" });
  document.querySelectorAll(".copy > section[data-page]").forEach(s => io.observe(s));

  /* ---- warm-up shift: the firmware's shift_point() (gauge core/track.c) on the tach's ring ---- */
  const SHIFT_RPM = 6500, WARM_RPM = 4500, WARM_OIL = 40, WARM_STEP = 250, READY_OIL = 85, READY_COLD = 60;
  const shiftAt = oil => oil >= READY_OIL ? SHIFT_RPM
    : Math.min(SHIFT_RPM, Math.round((WARM_RPM + Math.max(0, (oil - WARM_OIL) / (READY_OIL - WARM_OIL)) * (SHIFT_RPM - WARM_RPM)) / WARM_STEP) * WARM_STEP);
  const dial = $("dial"), dc = dial.getContext("2d");
  const SEGS = 42, R0 = 196, R1 = 224, GAP = 0.9, TACH_MAX = 7000, STEP = TACH_MAX / SEGS;   /* the gauge's ring */
  const BLINK_MS = 80;                                                                        /* SHIFT_BLINK_MS */
  const GHOST = "#211B14", RED_GHOST = "#40100F", NUM = "#8A7A5E";
  let sp = shiftAt(50);

  /* one sweep: rev up past the shift point, flash, drop, pause */
  const RISE = 1700, HOLD = 600, FALL = 450, REST = 500, CYCLE = RISE + HOLD + FALL + REST, IDLE = 1200;
  function rpmAt(t) {
    const top = sp + 300;
    t %= CYCLE;
    if (t < RISE) { const u = t / RISE; return IDLE + (top - IDLE) * u * u * (3 - 2 * u); }
    if (t < RISE + HOLD) return top;
    if (t < RISE + HOLD + FALL) return top - (top - IDLE) * (t - RISE - HOLD) / FALL;
    return IDLE;
  }
  function drawDial(rpm, now) {
    const s = dial.width / 466, rad = d => d * Math.PI / 180;
    dc.setTransform(s, 0, 0, s, 0, 0);
    dc.clearRect(0, 0, 466, 466);
    dc.fillStyle = css("--panel");
    dc.beginPath(); dc.arc(233, 233, 233, 0, Math.PI * 2); dc.fill();
    const red = Math.floor(sp / STEP), cur = Math.floor(rpm / STEP), pitch = 270 / SEGS;
    const shifting = rpm > sp, on = shifting && Math.floor(now / BLINK_MS) % 2 === 0;
    for (let i = 0; i < SEGS; i++) {
      const redline = i >= red ? RED_GHOST : GHOST;       /* the redline is printed on the dial from the shift point */
      const c = shifting ? (on ? css("--warn") : redline) : i < cur ? css("--amber") : redline;
      const a0 = rad(135 + i * pitch + GAP / 2), a1 = rad(135 + (i + 1) * pitch - GAP / 2);
      dc.beginPath();
      dc.arc(233, 233, R1, a0, a1);
      dc.arc(233, 233, R0, a1, a0, true);
      dc.closePath();
      dc.fillStyle = c;
      dc.fill();
    }
    dc.textAlign = "center";
    dc.font = "700 26px DSEG7, monospace";
    for (let k = 1; k <= 7; k++) {
      const a = rad(135 + k * 1000 / TACH_MAX * 270);
      dc.fillStyle = k * 1000 > sp ? "#7A2A26" : NUM;
      dc.fillText(String(k), 233 + Math.cos(a) * 168, 233 + Math.sin(a) * 168 + 10);
    }
    dc.fillStyle = on ? css("--warn") : css("--amber");
    dc.font = "700 64px DSEG7, monospace";
    dc.fillText(String(Math.round(rpm / 10) * 10).padStart(4, " "), 233, 252);
    dc.fillStyle = css("--steel");
    dc.font = "600 17px 'Archivo Expanded', system-ui, sans-serif";
    dc.fillText("RPM", 233, 292);
  }
  let t0 = performance.now(), running = false, raf = 0;
  const frame = now => {
    drawDial(rpmAt(now - t0), now);
    raf = running ? requestAnimationFrame(frame) : 0;
  };
  const still = () => drawDial(sp - STEP, 0);               /* reduced motion: lit up to just under the shift point */
  function play(on) {
    running = on && !reduced.matches;
    if (running && !raf) raf = requestAnimationFrame(frame);
    if (!running) still();
  }
  new IntersectionObserver(es => play(es[0].isIntersecting)).observe(dial);   /* only animate while it is on screen */

  const temps = [...document.querySelectorAll("[data-oil]")];
  function setOil(oil) {
    sp = shiftAt(oil);
    temps.forEach(b => b.setAttribute("aria-pressed", String(+b.dataset.oil === oil)));
    $("oil-v").textContent = oil;
    $("rpm-v").textContent = sp;
    const st = oil >= READY_OIL ? ["READY", "--go"] : oil >= READY_COLD ? ["WARMING", "--caution"] : ["COLD", "--caution"];
    $("st-v").textContent = st[0];
    $("st-v").style.color = `var(${st[1]})`;
    t0 = performance.now();
    if (!running) still();
  }
  temps.forEach(b => b.addEventListener("click", () => setOil(+b.dataset.oil)));

  /* ---- pixel density: a 5 mm 7-segment "8" in a 6 mm square, at 266 and 125 PPI ---- */
  function patch(id, ppi) {
    const cv = $(id), g = cv.getContext("2d"), n = Math.round(6 / 25.4 * ppi);   /* pixels across 6 mm */
    const off = document.createElement("canvas");
    off.width = off.height = n;
    const o = off.getContext("2d");
    o.fillStyle = css("--panel"); o.fillRect(0, 0, n, n);
    o.fillStyle = css("--amber");
    o.font = `700 ${n * 5 / 6}px DSEG7, monospace`;                                  /* DSEG's digit is about the font size tall */
    o.textAlign = "center"; o.textBaseline = "alphabetic";
    o.fillText("8", n / 2, n * 11 / 12);
    g.imageSmoothingEnabled = false;
    g.drawImage(off, 0, 0, n, n, 0, 0, cv.width, cv.height);
  }
  const drawAll = () => { setOil(+(temps.find(b => b.getAttribute("aria-pressed") === "true") || temps[1]).dataset.oil); patch("px-a", 266); patch("px-b", 125); };
  drawAll();
  Promise.all([document.fonts.load("700 20px DSEG7"), document.fonts.load("600 17px 'Archivo Expanded'")]).then(drawAll, drawAll);
})();

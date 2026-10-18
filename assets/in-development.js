/* In development: drives the live gauge (in-development/gauge.html, the gauge's browser mock)
   and the warm-up shift dial. */
"use strict";
(() => {
  const $ = id => document.getElementById(id);
  const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

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
  };
  const note = $("note");
  const runs = [...document.querySelectorAll(".chips [data-run]")];
  const tour = [...document.querySelectorAll(".tour [data-page]")];
  const showPage = p => tour.forEach(b => b.setAttribute("aria-pressed", String(+b.dataset.page === p)));
  const narrow = matchMedia("(max-width: 1079px)");
  const toGauge = () => { if (narrow.matches) gauge.closest(".rig").scrollIntoView({ block: "start" }); };

  function run(name, page) {
    send({ run: name, page });
    runs.forEach(b => b.setAttribute("aria-pressed", String(b.dataset.run === name)));
    note.innerHTML = NOTES[name];
    showPage(page);
  }
  note.innerHTML = NOTES.drive;
  runs.forEach(b => b.addEventListener("click", () => run(b.dataset.run, +b.dataset.page)));
  document.querySelectorAll(".warns [data-run]").forEach(b =>
    b.addEventListener("click", () => { run(b.dataset.run, +b.dataset.page); toGauge(); }));
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

  /* ---- warm-up shift: the firmware's shift_point() (gauge core/track.c) ---- */
  const SHIFT_RPM = 6500, WARM_RPM = 4500, WARM_OIL = 40, WARM_STEP = 250, READY_OIL = 85, READY_COLD = 60;
  const shiftAt = oil => oil >= READY_OIL ? SHIFT_RPM
    : Math.min(SHIFT_RPM, Math.round((WARM_RPM + Math.max(0, (oil - WARM_OIL) / (READY_OIL - WARM_OIL)) * (SHIFT_RPM - WARM_RPM)) / WARM_STEP) * WARM_STEP);
  const dial = $("dial"), dc = dial.getContext("2d");
  const SEGS = 42, R0 = 196, R1 = 224, GAP = 0.9, TACH_MAX = 7000;   /* the gauge's shared ring geometry */
  function drawDial(sp) {
    const s = dial.width / 466, rad = d => d * Math.PI / 180;
    dc.setTransform(s, 0, 0, s, 0, 0);
    dc.clearRect(0, 0, 466, 466);
    dc.fillStyle = css("--panel");
    dc.beginPath(); dc.arc(233, 233, 233, 0, Math.PI * 2); dc.fill();
    const red = Math.floor(sp / (TACH_MAX / SEGS)), pitch = 270 / SEGS;
    for (let i = 0; i < SEGS; i++) {
      const a0 = rad(135 + i * pitch + GAP / 2), a1 = rad(135 + (i + 1) * pitch - GAP / 2);
      dc.beginPath();
      dc.arc(233, 233, R1, a0, a1);
      dc.arc(233, 233, R0, a1, a0, true);
      dc.closePath();
      dc.fillStyle = i >= red ? css("--warn") : "#2A2219";
      dc.fill();
    }
    dc.textAlign = "center";
    dc.font = "700 26px DSEG7, monospace";
    for (let k = 1; k <= 7; k++) {
      const a = rad(135 + k * 1000 / TACH_MAX * 270);
      dc.fillStyle = k * 1000 >= sp ? css("--warn") : "#8A7A5E";
      dc.fillText(String(k), 233 + Math.cos(a) * 168, 233 + Math.sin(a) * 168 + 10);
    }
    dc.fillStyle = css("--warn");
    dc.font = "700 64px DSEG7, monospace";
    dc.fillText(String(sp), 233, 252);
    dc.fillStyle = css("--steel");
    dc.font = "600 17px 'Archivo Expanded', system-ui, sans-serif";
    dc.fillText("SHIFT RPM", 233, 292);
  }
  const oilIn = $("oil");
  function updateWarm() {
    const oil = +oilIn.value, sp = shiftAt(oil);
    $("oil-v").textContent = oil;
    $("rpm-v").textContent = sp;
    const st = oil >= READY_OIL ? ["READY", "--go"] : oil >= READY_COLD ? ["WARMING", "--caution"] : ["COLD", "--caution"];
    $("st-v").textContent = st[0];
    $("st-v").style.color = `var(${st[1]})`;
    oilIn.setAttribute("aria-valuetext", `${oil} °C oil, shift at ${sp} rpm, ${st[0]}`);
    drawDial(sp);
  }
  oilIn.addEventListener("input", updateWarm);

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
  const drawAll = () => { updateWarm(); patch("px-a", 266); patch("px-b", 125); };
  drawAll();
  Promise.all([document.fonts.load("700 20px DSEG7"), document.fonts.load("600 17px 'Archivo Expanded'")]).then(drawAll, drawAll);
})();

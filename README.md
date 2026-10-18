# ninetenths.se

Company site for Nine Tenths Engineering AB. Static HTML/CSS, hosted on GitHub Pages.

- `index.html` — the page
- `in-development/` — products in development: the GR Yaris gauge, with a live demo.
  `gauge.html` is generated from the gauge repo's browser mock by
  `tools/build-gauge.py ../gr-yaris-dash` (embed hook: `tools/gauge-embed.html`);
  rerun it when the mock changes. Page styles and script: `assets/in-development.css`, `.js`
- `assets/styles.css` — styles
- `assets/fonts/` — Archivo and DSEG7 (SIL Open Font License), self-hosted
- `assets/img/` — logo, social sharing image

No build step: edit and push.

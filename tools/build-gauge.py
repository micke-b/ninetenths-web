#!/usr/bin/env python3
"""Regenerate in-development/gauge.html: the GR Yaris gauge's browser mock, embedded.

The live gauge on /in-development/ is the mock from the gauge repo
(mock-display/index.html) with its control panel hidden, sized to its frame
and driven from the page by postMessage (tools/gauge-embed.html). Fonts and
the logo are inlined, so the result is one self-contained file.

Run it after the mock changes, then commit in-development/gauge.html and index.html
(the page loads the gauge with a hash of it, so browsers fetch every new build):
    python3 tools/build-gauge.py ../gr-yaris-dash
"""
import base64
import hashlib
import pathlib
import re
import sys

if len(sys.argv) != 2:
    sys.exit(__doc__)
site = pathlib.Path(__file__).resolve().parent.parent
mock_dir = pathlib.Path(sys.argv[1]).resolve() / "mock-display"


def data_uri(path, mime):
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode()


mock = (mock_dir / "index.html").read_text()
mock = re.sub(r'url\("fonts/([^"]+\.woff2)"\)',
              lambda m: f'url("{data_uri(mock_dir / "fonts" / m.group(1), "font/woff2")}")', mock)
logo = "brand/nine-tenths_primary_for-dark-bg.png"
mock = mock.replace(f'logo.src = "{logo}";', f'logo.src = "{data_uri(mock_dir / logo, "image/png")}";')
if 'url("fonts/' in mock or logo in mock:
    sys.exit("the mock loads a file this script doesn't inline: update the script")
mock = re.sub(r"<title>[^<]*</title>", '<title>Gauge</title>\n<meta name="robots" content="noindex">', mock, count=1)
# the boot title shows the firmware's version, not the mock's "V0.1  MOCK"
boot_c = (mock_dir.parent / "gauge/main/ui/screen_boot.c").read_text()
version = re.search(r'label\("(V[0-9.]+)"', boot_c)
if not version or 'label("V0.1  MOCK"' not in mock:
    sys.exit("can't find the version label in screen_boot.c or the mock: update the script")
mock = mock.replace('label("V0.1  MOCK"', f'label("{version.group(1)}"')
if mock.count("</body>") != 1:
    sys.exit("expected one </body> in the mock")
mock = mock.replace("</body>", (site / "tools/gauge-embed.html").read_text() + "\n</body>")
out = site / "in-development/gauge.html"
out.write_text(mock)
# the page loads gauge.html?v=<hash>, so a browser never keeps showing an older build
page = site / "in-development/index.html"
html = page.read_text()
stamp = hashlib.sha1(mock.encode()).hexdigest()[:10]
html, n = re.subn(r'src="gauge\.html(\?v=[0-9a-f]+)?"', f'src="gauge.html?v={stamp}"', html)
if n != 1:
    sys.exit("expected one gauge.html iframe in in-development/index.html")
page.write_text(html)
print(f"wrote {out.relative_to(site)} ({out.stat().st_size // 1024} KB), page loads it as ?v={stamp}")

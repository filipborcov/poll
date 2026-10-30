# Rebuilds index.html / poll.html: one self-contained page from css/ and js/.
import pathlib, re

root = pathlib.Path(__file__).parent
page = (root / "index.html").read_text()
css = (root / "css/style.css").read_text()
js = "".join((root / "js" / f).read_text() for f in ["config.js", "storage.js", "vote.js", "app.js"])
page = re.sub(r"(<style>\n).*?(\n?  </style>)", lambda m: m.group(1) + css + m.group(2), page, count=1, flags=re.S)
page = re.sub(r"(  <script>\n).*?(\n  </script>)", lambda m: m.group(1) + js + m.group(2), page, count=1, flags=re.S)
for name in ["index.html", "poll.html"]:
    (root / name).write_text(page)

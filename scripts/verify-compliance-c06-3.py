#!/usr/bin/env python3
"""C06.3 static public scenario page checks; not browser/WCAG certification."""
import json
import subprocess
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "compliance/web"
html = (WEB / "scenarios.html").read_text()

def need(ok, message):
    if not ok:
        raise SystemExit("C06.3 FAIL: " + message)

class Inspect(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags = []
        self.ids = []
        self.labels = []
        self.selects = {}
        self.current = None
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        self.tags.append((tag, a))
        if "id" in a:
            self.ids.append(a["id"])
        if tag == "label":
            self.labels.append(a.get("for"))
        if tag == "select":
            self.current = a["id"]
            self.selects[self.current] = {"attrs": a, "options": []}
        if tag == "option" and self.current:
            self.selects[self.current]["options"].append(a["value"])
    def handle_endtag(self, tag):
        if tag == "select":
            self.current = None

p = Inspect()
p.feed(html)
need(len(p.ids) == len(set(p.ids)), "duplicate IDs")
need(sum(t == "h1" for t, a in p.tags) == 1, "single H1")
need(any(t == "html" and a.get("lang") == "en" for t, a in p.tags), "language")
need(any(t == "meta" and a.get("name") == "viewport" for t, a in p.tags), "viewport")
need(any(t == "main" and a.get("id") == "main" for t, a in p.tags), "main landmark")
need(any(t == "a" and a.get("href") == "#main" for t, a in p.tags), "skip link")
need(any(t == "section" and a.get("aria-live") == "polite" and a.get("aria-atomic") == "true" for t, a in p.tags), "announced results")
need(any(t == "noscript" for t, a in p.tags), "no-JavaScript fallback")
need(not any(t in {"input", "textarea", "form", "iframe"} for t, a in p.tags), "private data/submission controls")
choices = json.loads(subprocess.check_output(["node", "-e", "console.log(JSON.stringify(require('./compliance/web/scenarios.js').choices))"], cwd=ROOT, text=True))
need(set(p.selects) == {"scenario-" + key for key in choices}, "closed scenario fields")
for key, values in choices.items():
    field = p.selects["scenario-" + key]
    need(set(field["options"]) == set(values) and len(field["options"]) == len(values), "model/select drift: " + key)
    need("scenario-" + key in p.labels, "label: " + key)
    need(field["attrs"].get("data-default") in values and "disabled" in field["attrs"], "safe disabled default: " + key)
need(any(t == "button" and a.get("id") == "scenario-reset" and a.get("type") == "button" and "disabled" in a for t, a in p.tags), "safe reset")
scripts = [a.get("src") for t, a in p.tags if t == "script"]
need(scripts == ["./scenarios.js", "./scenarios-ui.js"], "only local model and UI scripts")
need(all("defer" in a for t, a in p.tags if t == "script"), "deferred scripts")
for tag, a in p.tags:
    for attr in ("href", "src"):
        if attr in a:
            link = a[attr]
            if link.startswith("#"):
                need(link[1:] in p.ids, "missing anchor")
            else:
                need(link.startswith("./") and ".." not in link and (WEB / link).is_file(), "missing/unsafe local resource")
    need(not any(key.startswith("on") for key in a), "inline event handler")
csp = next((a.get("content", "") for t, a in p.tags if t == "meta" and a.get("http-equiv") == "Content-Security-Policy"), "")
for directive in ("default-src 'none'", "script-src 'self'", "connect-src 'none'", "form-action 'none'", "base-uri 'none'"):
    need(directive in csp, "missing CSP: " + directive)
for phrase in ("No published reviewed rules", "Current law, effective dates and individual permissions", "cannot authenticate evidence", "Unresolved requirements", "eligibility not assessed", "Nothing is sent or saved", "No legal advice or authorization"):
    need(phrase in html, "public boundary disclosure: " + phrase)
need("./scenarios.html" in (WEB / "index.html").read_text(), "overview entry")
need("./scenarios.html" in (WEB / "browser.html").read_text(), "browser entry")
print("C06.3 static public scenario controls, disclosures and navigation: PASS")

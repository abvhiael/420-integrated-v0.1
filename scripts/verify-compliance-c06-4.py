#!/usr/bin/env python3
"""C06.4 private source/asset separation and editor contract static checks."""
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PRIVATE = ROOT / "services/complianceauth/authorweb"
html = (PRIVATE / "workspace.html").read_text()
def require(ok, message):
    if not ok:
        raise SystemExit("C06.4 FAIL: " + message)
class Inspect(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags = []
        self.ids = []
        self.labels = []
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        self.tags.append((tag, a))
        if "id" in a: self.ids.append(a["id"])
        if tag == "label": self.labels.append(a.get("for"))
p = Inspect()
p.feed(html)
require(len(p.ids) == len(set(p.ids)), "unique IDs")
require(sum(t == "h1" for t,a in p.tags) == 1, "single heading")
require(any(t == "html" and a.get("lang") == "en" for t,a in p.tags), "language")
require(any(t == "meta" and a.get("name") == "viewport" for t,a in p.tags), "viewport")
require(any(t == "main" and a.get("id") == "main" for t,a in p.tags), "main landmark")
require(any(t == "a" and a.get("href") == "#main" for t,a in p.tags), "skip link")
require(any(t == "fieldset" and a.get("id") == "editor-fields" and "disabled" in a for t,a in p.tags), "editor locked before authentication")
require(any(t == "noscript" for t,a in p.tags), "no-script locked state")
for t,a in p.tags:
    if t in {"input","textarea"}:
        require(a.get("id") in p.labels, "label for editor field")
    if t == "button":
        require(a.get("type") == "button", "no unintended form submission")
    for key in a:
        require(not key.startswith("on"), "inline code")
    if "src" in a:
        require(a["src"] == "/private/author/editor.js", "private local script only")
for phrase in ("DRAFT_REVIEW_REQUIRED", "does not review, approve, publish or activate", "Pinned citation references", "Compare immutable versions", "Excerpts come from the authorized integrity-checked snapshot archive"):
    require(phrase in html, "missing editor boundary: " + phrase)
require(not (ROOT / "compliance/web/authorweb").exists(), "private assets in public root")
for path in (ROOT / "compliance/web").glob("*"):
    if path.suffix in {".html",".js",".json"}:
        require("/api/v1/author/" not in path.read_text(), "private API mixed into public site")
source = (ROOT / "services/complianceauth/author_workspace.go").read_text()
store = (ROOT / "services/complianceauth/author_workspace_postgres.go").read_text()
for contract in ("VerifyAuthorSession", "EndAuthorSession", "X-CSRF-Token", "context.WithDeadline", "reauthorize", "PARSED_PENDING_REVIEW", "c064SchemaValid", "c064Comparison", "c064Assets.ReadFile"):
    require(contract in source, "missing private boundary")
for contract in ("FOR UPDATE", "ON CONFLICT", "tx.Commit()", "document_digest", "c064DocumentDigest", "pg_is_in_recovery()"):
    require(contract in store, "missing durable store contract")
require("LifecycleActive" not in source and "AuthorizeReview(" not in source, "author has review/publication transition")
require("t.Skip(" not in (ROOT / "services/complianceauth/author_workspace_postgres_test.go").read_text(), "required PostgreSQL check may not skip")
print("C06.4 private asset separation, locked editor and durable-store contracts: PASS")

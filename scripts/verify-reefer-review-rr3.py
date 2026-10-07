#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
errors = []

def req(ok, msg):
    if not ok:
        errors.append(msg)

required = [
    "reefer-review/model.go",
    "reefer-review/service.go",
    "reefer-review/memory.go",
    "reefer-review/http.go",
    "reefer-review/editorial_test.go",
    "reefer-review/editorial_http_test.go",
    "reefer-review/client/client.go",
    "reefer-review/client/client_test.go",
    "reefer-review/web/index.html",
    "reefer-review/web/app.js",
    "reefer-review/web/styles.css",
    "docs/reefer-review/RR-3-EDITORIAL-PUBLISHING-COMPLETION.md",
]
for rel in required:
    req((ROOT / rel).exists(), f"missing {rel}")

model = (ROOT / "reefer-review/model.go").read_text() if (ROOT / "reefer-review/model.go").exists() else ""
service = (ROOT / "reefer-review/service.go").read_text() if (ROOT / "reefer-review/service.go").exists() else ""
memory = (ROOT / "reefer-review/memory.go").read_text() if (ROOT / "reefer-review/memory.go").exists() else ""
http = (ROOT / "reefer-review/http.go").read_text() if (ROOT / "reefer-review/http.go").exists() else ""
client = (ROOT / "reefer-review/client/client.go").read_text() if (ROOT / "reefer-review/client/client.go").exists() else ""
index = (ROOT / "reefer-review/web/index.html").read_text() if (ROOT / "reefer-review/web/index.html").exists() else ""
js = (ROOT / "reefer-review/web/app.js").read_text() if (ROOT / "reefer-review/web/app.js").exists() else ""
doc = (ROOT / "docs/reefer-review/RR-3-EDITORIAL-PUBLISHING-COMPLETION.md").read_text() if (ROOT / "docs/reefer-review/RR-3-EDITORIAL-PUBLISHING-COMPLETION.md").exists() else ""

for marker in ["PublicationRevision", "ModerationEvent", "UpdatePublicationRequest", "CurrentRevisionID", "Revision"]:
    req(marker in model, f"model missing {marker}")
for marker in ["CanEdit", "CanTombstone", "CanRead", "AppendRevision", "UpdateRevision", "AppendModerationEvent", "ListModerationEvents", "ListAll"]:
    req(marker in service, f"service interface missing {marker}")
for marker in [
    "func (s Service) Update(",
    "func (s Service) Tombstone(",
    "func (s Service) GetForActor(",
    "func (s Service) ListEditorial(",
    "func (s Service) ListRevisions(",
    "func (s Service) ListModerationHistory(",
]:
    req(marker in service, f"service missing {marker}")
for marker in ["StatusTombstoned", "Rights.Assert", "CurrentRevisionID", "search-delete:"]:
    req(marker in service, f"lifecycle missing {marker}")
for marker in ["AppendRevision", "AppendModerationEvent", "CanRead"]:
    req(marker in memory, f"memory/development policy missing {marker}")

for route in ["/v1/editorial/publications", "/tombstone", "/revisions", "/moderation"]:
    req(route in http, f"HTTP route missing {route}")
req("http.MethodPut" in http, "publication update route missing")

for method in ["Ready(", "GetPublication(", "UpdatePublication(", "Moderate(", "Tombstone(", "Revisions(", "ModerationHistory(", "ListEditorial("]:
    req(method in client, f"client missing {method}")

for marker in [
    'data-route="editorial"',
    'data-route="moderation"',
    'data-view="article"',
    'id="draft-form"',
    'id="edit-form"',
    'id="editorial-list"',
    'id="moderation-list"',
    'id="moderation-history"',
]:
    req(marker in index, f"web UI missing {marker}")

for marker in [
    "loadArticle(",
    "loadEditorial(",
    "selectForEdit(",
    "publishPublication(",
    "tombstonePublication(",
    "moderatePublication(",
    "showModerationHistory(",
    "showRevisions(",
    "sessionStorage",
    "/v1/editorial/publications",
    "/tombstone",
    "/revisions",
    "/moderation",
]:
    req(marker in js, f"web app missing {marker}")

req(".innerHTML" not in js, "RR-3 web app must preserve safe DOM rendering")
req("X-420-Actor" in js, "repository-stage actor boundary missing")

for suffix in "ABCDEFGH":
    req(f"RR-3.{suffix}" in doc, f"RR-3 requirement {suffix} missing")

if errors:
    for err in errors:
        print("ERROR:", err)
    sys.exit(1)

print("Reefer Review RR-3 verifier: PASS")

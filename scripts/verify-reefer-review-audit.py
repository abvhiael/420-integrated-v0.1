#!/usr/bin/env python3
from pathlib import Path
import json,sys

ROOT=Path(__file__).resolve().parents[1]
errors=[]
def req(ok,msg):
    if not ok: errors.append(msg)

registry=json.loads((ROOT/"config/genesis-consumer-services.json").read_text())
cfg=json.loads((ROOT/"config/reefer-review.json").read_text())
frozen=json.loads((ROOT/"config/genesis-applications.json").read_text())
svc=next((x for x in registry["services"] if x["id"]=="420/service/reefer-review/v1"),None)
req(svc is not None,"missing canonical Reefer Review service")
if svc:
    req(svc["name"]=="Reefer Review Publishing","wrong service name")
    req(svc["role"]=="GENESIS_FACING_MVP","wrong service role")
    req(svc["genesis_target"]=="editorial_news_plus_medium_style_publishing","wrong target")
    req(svc["authority"]=="REPLACEABLE_APPLICATION","wrong authority")
    req(svc["depends_on"]==["420 Identity","420 Rights","420 Storage","420 Search","420 Notifications","420Mail"],"dependency drift")
flags={x["key"]:x["genesis_default"] for x in registry["feature_flags"]}
req(flags.get("publishing.paid_external_newsletters") is False,"paid external newsletters must remain disabled")
req(cfg["feature_flags"]["publishing.paid_external_newsletters"] is False,"app config must keep newsletter flag disabled")
req(all(x["name"]!="Reefer Review Publishing" for x in frozen["apps"]),"audit must not silently promote frozen catalog")
required=[
 "reefer-review/model.go","reefer-review/service.go","reefer-review/memory.go","reefer-review/http.go",
 "reefer-review/service_test.go","reefer-review/http_test.go","reefer-review/client/client.go",
 "reefer-review/web/index.html","reefer-review/README.md","cmd/reefer-review/main.go",
 "docs/audit/REEFER-REVIEW-AUDIT-REMEDIATION-ROADMAP.md","docs/audit/REEFER-REVIEW-SECURITY.md"
]
for p in required:req((ROOT/p).exists(),f"missing {p}")
source=(ROOT/"reefer-review/service.go").read_text()
for needle in ["Rights.Assert","VisibilityPublic","StatusPublished","BindIdempotency"]:
    req(needle in source,f"service missing {needle}")
cmd=(ROOT/"cmd/reefer-review/main.go").read_text()
req('mode!="development"' in cmd,"production executable must fail closed")
req(not (ROOT/"contracts/src/reefer-review").exists(),"unexpected dedicated Reefer Review contract authority")
if errors:
    for e in errors: print("ERROR:",e)
    sys.exit(1)
print("Reefer Review repository audit verifier: PASS")

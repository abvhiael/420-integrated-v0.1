#!/usr/bin/env python3
import json,pathlib,sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
errors=[]
def read(p): return (ROOT/p).read_text()
road=json.loads(read("docs/audit/EXP-2R.5-authoritative-next-phase-roadmap.json"))
step=next((s for s in road["sequence"] if s["id"]=="EXP-NEXT.2"),None)
if not step or step.get("title")!="Transaction-fee and raw-event browser presentation":
    errors.append("canonical EXP-NEXT.2 definition mismatch")
app=read("explorer/web/static/app.js")
pres=read("explorer/web/static/presentation.mjs")
tests=read("explorer/web/presentation.test.mjs")
webtests=read("explorer/web/web_test.go")
index=read("explorer/web/static/index.html")
css=read("explorer/web/static/app.css")
matrix=json.loads(read("docs/audit/EXP-0.2.2-user-workflow-matrix.json"))
audit=json.loads(read("docs/audit/EXP-NEXT.2-fee-raw-event-browser.json"))
required_app=[
 "renderFeeSummary420","transactionDetailPresentation420","inspectableRaw420","renderRawLogs420",
 "Raw input","Raw logs","logTable(logs)","block-log","data-copy-value"
]
for token in required_app:
    if token not in app: errors.append("app.js missing "+token)
required_pres=[
 "actual fee is inconsistent with gas used × effective gas price",
 "transaction and receipt provenance are inconsistent",
 "log emitting address","log topic","log data","Raw indexed values are primary",
 "Copy full value","Number.isSafeInteger"
]
for token in required_pres:
    if token not in pres: errors.append("presentation.mjs missing "+token)
for token in [
 "known fee vector","zero fee","very large integer-string","reverted transaction",
 "multi-topic raw event","empty raw event data","same deterministic raw renderer",
 "malformed event address","hostile strings","long raw values"
]:
    if token not in tests: errors.append("browser test missing "+token)
if 'type="module" src="/app.js"' not in index: errors.append("Explorer app is not loaded as a browser module")
if ".raw-event" not in css or ".inspectable-raw" not in css: errors.append("raw-event presentation styles missing")
if "presentation.mjs" not in webtests: errors.append("Go web asset regression does not cover presentation module")
for wid in ("EXP-WF-003","EXP-WF-013"):
    wf=next((x for x in matrix.get("workflows",[]) if x.get("id")==wid),None)
    if not wf: errors.append("workflow missing "+wid); continue
    if "exp_next_2_repository_disposition" not in wf: errors.append("workflow lacks EXP-NEXT.2 disposition "+wid)
    if "docs/audit/EXP-NEXT.2-fee-raw-event-browser.json" not in wf.get("exp_next_2_evidence",[]): errors.append("workflow lacks audit evidence "+wid)
scope=audit.get("scope",{})
if scope.get("live_target_network_fee_witness_qualified") is not False: errors.append("live fee witness overclaim")
if scope.get("abi_decoded_semantics_qualified") is not False: errors.append("ABI semantic overclaim")
if scope.get("production_deployment_qualified") is not False: errors.append("production deployment overclaim")
if scope.get("canonical_authority") is not False or scope.get("genesis_ready_claim") is not False: errors.append("authority/readiness overclaim")
if "short(" in pres: errors.append("qualified raw renderer must not silently shorten values")
out=ROOT/"exp-next-2-evidence"; out.mkdir(exist_ok=True)
(out/"summary.json").write_text(json.dumps({"step":"EXP-NEXT.2","status":audit.get("status"),"errors":errors},indent=2)+"\n")
if errors:
    print("\n".join("ERROR: "+e for e in errors)); sys.exit(1)
print("EXP-NEXT.2 verifier passed")

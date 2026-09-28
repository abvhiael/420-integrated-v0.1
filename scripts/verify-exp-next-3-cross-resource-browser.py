#!/usr/bin/env python3
import json,pathlib,sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
errors=[]
def read(p): return (ROOT/p).read_text()
road=json.loads(read("docs/audit/EXP-2R.5-authoritative-next-phase-roadmap.json"))
step=next((s for s in road["sequence"] if s["id"]=="EXP-NEXT.3"),None)
if not step or step.get("title")!="Consensus/producer and cross-resource browser workflow closeout":
    errors.append("canonical EXP-NEXT.3 definition mismatch")
app=read("explorer/web/static/app.js")
module=read("explorer/web/static/workflow-presentation.mjs")
tests=read("explorer/web/workflow-presentation.test.mjs")
webtests=read("explorer/web/web_test.go")
matrix=json.loads(read("docs/audit/EXP-0.2.2-user-workflow-matrix.json"))
audit=json.loads(read("docs/audit/EXP-NEXT.3-cross-resource-browser.json"))
for token in [
 "producerPresentation420","registryServicePresentation420","registryVersionPresentation420",
 "addressHistoryPresentation420","assetTransfersPresentation420","contractPresentation420",
 "diagnosticPresentation420","Consensus context"
]:
    if token not in app: errors.append("app.js missing "+token)
for token in [
 "historical producer trace is incomplete","consensus/execution producer provenance mismatch",
 "Explorer projection cannot claim canonical authority","Registry implementation mismatch",
 "Registry version identity mismatch","ready status contradicts degraded diagnostics"
]:
    if token not in module: errors.append("workflow presentation missing "+token)
for token in [
 "historical block producer fixture","missing producer trace","validator consensus navigation",
 "Registry implementation","Registry version identity","address history","asset transfers",
 "contract deployment","malicious or malformed","wrong-chain stale degraded"
]:
    if token not in tests: errors.append("workflow test missing "+token)
if "workflow-presentation.mjs" not in webtests: errors.append("Go web regression does not cover workflow module")
ids={"EXP-WF-004","EXP-WF-005","EXP-WF-006","EXP-WF-007","EXP-WF-008","EXP-WF-010","EXP-WF-011","EXP-WF-014","EXP-WF-015"}
for wid in ids:
    wf=next((x for x in matrix.get("workflows",[]) if x.get("id")==wid),None)
    if not wf: errors.append("workflow missing "+wid); continue
    if wf.get("exp_next_3_repository_disposition")!="REPOSITORY_BROWSER_CROSS_RESOURCE_WORKFLOW_QUALIFIED_LIVE_DEPLOYMENT_PENDING":
        errors.append("workflow disposition missing "+wid)
    if "docs/audit/EXP-NEXT.3-cross-resource-browser.json" not in wf.get("exp_next_3_evidence",[]):
        errors.append("workflow evidence missing "+wid)
scope=audit.get("scope",{})
for key in ["live_canonical_producer_witness_qualified","deployed_consensus_provider_proof_qualified","production_availability_sla_qualified","canonical_authority","genesis_ready_claim"]:
    if scope.get(key) is not False: errors.append("scope overclaim "+key)
out=ROOT/"exp-next-3-evidence";out.mkdir(exist_ok=True)
(out/"summary.json").write_text(json.dumps({"step":"EXP-NEXT.3","status":audit.get("status"),"errors":errors},indent=2)+"\n")
if errors:
    print("\n".join("ERROR: "+e for e in errors));sys.exit(1)
print("EXP-NEXT.3 verifier passed")

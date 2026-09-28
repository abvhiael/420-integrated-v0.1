#!/usr/bin/env python3
import json, subprocess
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
REC=ROOT/"docs/audit/EXP-1.9-ci-qualification-automation.json"
READY=ROOT/"testnet/public-services/indexer/readiness.json"
CFG=ROOT/"config/420indexer-v1.json"
INDEXER=ROOT/".github/workflows/420indexer.yml"
DOCS=ROOT/".github/workflows/docs-qualify.yml"
INTEGRATED=ROOT/".github/workflows/qualification.yml"
DEDICATED=ROOT/".github/workflows/explorer-exp-1-9.yml"
EVIDENCE=ROOT/"exp-1-9-evidence"

EXACT_EXPR="${{ github.event.pull_request.head.sha || github.sha }}"
ASSERTION='test "$(git rev-parse HEAD)" = "$EXPECTED_SHA"'

def git(*args):
    return subprocess.check_output(["git",*args],cwd=ROOT,text=True).strip()

def main():
    errors=[]
    required=[REC,READY,CFG,INDEXER,DOCS,INTEGRATED,DEDICATED]
    for p in required:
        if not p.exists(): errors.append(f"missing {p.relative_to(ROOT)}")
    if errors:
        print(json.dumps({"pass":False,"errors":errors},indent=2)); raise SystemExit(1)

    rec=json.loads(REC.read_text())
    ready=json.loads(READY.read_text())
    cfg=json.loads(CFG.read_text())
    indexer=INDEXER.read_text()
    docs=DOCS.read_text()
    integrated=INTEGRATED.read_text()
    dedicated=DEDICATED.read_text()

    if rec.get("schema")!="420explorer-exp-1.9-ci-qualification-automation-v1":
        errors.append("schema drift")
    if rec.get("milestone")!="EXP-1.9": errors.append("milestone drift")
    if rec.get("predecessor",{}).get("exp_1_8_qualified_head")!="1df16a6cf81dfcd7c7bb88b326ec644629dd50dd":
        errors.append("EXP-1.8 predecessor drift")
    if rec.get("summary",{}).get("next_step")!="EXP-1.10":
        errors.append("handoff drift")

    for name,text,min_exact,min_assert in [
        ("420Indexer",indexer,1,1),
        ("420Docs Qualification",docs,1,1),
        ("420 Integrated Qualification",integrated,4,4),
        ("EXP-1.9 dedicated",dedicated,1,1),
    ]:
        if text.count(EXACT_EXPR) < min_exact:
            errors.append(f"{name}: exact-head checkout expression missing")
        if text.count(ASSERTION) < min_assert:
            errors.append(f"{name}: exact-head assertion missing")
        if "cancel-in-progress: true" not in text:
            errors.append(f"{name}: superseded-run cancellation missing")

    for name,text in [
        ("420Indexer",indexer),
        ("420Docs Qualification",docs),
        ("420 Integrated Qualification",integrated),
        ("EXP-1.9 dedicated",dedicated),
    ]:
        if "permissions:" not in text or "contents: read" not in text:
            errors.append(f"{name}: read-only contents permission missing")

    for step in range(1,10):
        token=f"verify-exp-1-{step}-"
        if step==1:
            token="verify-exp-1-1-runtime-authority.py"
        if step==2:
            token="verify-exp-1-2-rpc-binding.py"
        if step==3:
            token="verify-exp-1-3-canonical-indexing.py"
        if step==4:
            token="verify-exp-1-4-indexer-runtime.py"
        if step==5:
            token="verify-exp-1-5-consensus-provider.py"
        if step==6:
            token="verify-exp-1-6-historical-producer.py"
        if step==7:
            token="verify-exp-1-7-cross-layer-traceability.py"
        if step==8:
            token="verify-exp-1-8-runtime-negative-divergence.py"
        if step==9:
            token="verify-exp-1-9-ci-automation.py"
        if token not in indexer:
            errors.append(f"420Indexer retained gate missing: EXP-1.{step}")
        if token not in dedicated:
            errors.append(f"dedicated retained gate missing: EXP-1.{step}")

    for token in [
        "exp-1-9-ci-qualification-automation",
        "exp-1-9-evidence/",
        "retention-days: 7",
    ]:
        if token not in indexer:
            errors.append(f"420Indexer EXP-1.9 evidence automation missing: {token}")

    for token in [
        "exp-1-9-ci-qualification-automation-dedicated",
        "exp-1-9-evidence/",
        "retention-days: 7",
    ]:
        if token not in dedicated:
            errors.append(f"dedicated EXP-1.9 evidence automation missing: {token}")

    if "push:" not in dedicated or "- main" not in dedicated:
        errors.append("dedicated EXP-1.9 post-merge main trigger missing")
    for token in [
        "docs/audit/EXP-1.9-ci-qualification-automation.json",
        "scripts/verify-exp-1-9-ci-automation.py",
        ".github/workflows/explorer-exp-1-9.yml",
    ]:
        if indexer.count(token) < 2:
            errors.append(f"420Indexer PR/main trigger coverage missing: {token}")

    qa=cfg.get("qualificationAutomation",{})
    if qa.get("milestone")!="EXP-1.9": errors.append("qualification automation config milestone drift")
    if qa.get("exactHeadExpression")!="github.event.pull_request.head.sha || github.sha":
        errors.append("qualification exact-head expression drift")
    if qa.get("exactCheckoutAssertionRequired") is not True:
        errors.append("exact checkout assertion requirement disabled")
    if qa.get("concurrencyCancellationRequired") is not True:
        errors.append("concurrency cancellation requirement disabled")
    if qa.get("contentsPermission")!="read":
        errors.append("qualification permissions drift")
    if qa.get("retainedExp1Range")!="EXP-1.1..EXP-1.9":
        errors.append("retained EXP-1 range drift")
    if qa.get("evidenceRetentionDays")!=7:
        errors.append("evidence retention drift")
    if qa.get("postMergeQualificationRequired") is not True:
        errors.append("post-merge qualification requirement disabled")
    if qa.get("automaticTriggers")!=["pull_request","push:main"]:
        errors.append("qualification automatic trigger contract drift")
    if qa.get("liveDeploymentQualified") is not False:
        errors.append("live deployment overpromoted")

    if ready.get("status")!="EXP_1_9_CI_QUALIFICATION_AUTOMATION":
        errors.append("readiness milestone drift")
    backend=ready.get("backend",{})
    runtime=backend.get("runtime",{})
    if runtime.get("qualification_exact_head_required") is not True:
        errors.append("readiness exact-head requirement missing")
    if runtime.get("qualification_live_network_claim") is not False:
        errors.append("readiness live claim overpromoted")
    if backend.get("live_deployment",{}).get("qualified") is not False:
        errors.append("live deployment overpromoted")

    evidence=backend.get("qualification_evidence",{})
    for key in [
        "primary_indexer_exact_head_checkout",
        "docs_exact_head_checkout",
        "integrated_exact_head_checkout",
        "exact_head_assertions",
        "pr_concurrency_cancellation",
        "read_only_workflow_permissions",
        "exp_1_1_through_1_9_retained_automation",
        "exp_1_9_evidence_artifact",
    ]:
        if not str(evidence.get(key,"")).startswith("IMPLEMENTED"):
            errors.append(f"qualification evidence missing: {key}")

    acc=rec.get("acceptance",{})
    for key in [
        "primary_indexer_exact_head_complete",
        "docs_exact_head_complete",
        "integrated_exact_head_complete",
        "exact_sha_assertions_complete",
        "concurrency_automation_complete",
        "least_privilege_contents_read_complete",
        "retained_exp1_automation_complete",
        "dedicated_exp_1_9_gate_complete",
        "evidence_retention_complete",
    ]:
        if acc.get(key) is not True:
            errors.append(f"acceptance missing: {key}")
    if acc.get("live_network_qualification_complete") is not False:
        errors.append("live network qualification overpromoted")

    EVIDENCE.mkdir(exist_ok=True)
    out={
        "schema":"420explorer-exp-1.9-evidence-v1",
        "milestone":"EXP-1.9",
        "head_sha":git("rev-parse","HEAD"),
        "exact_head_checkout_required":True,
        "sha_assertion_required":True,
        "concurrency_cancel_in_progress":True,
        "contents_permission":"read",
        "retained_exp1_range":"EXP-1.1..EXP-1.9",
        "evidence_retention_days":7,
        "post_merge_main_qualification":True,
        "live_network_qualified":False,
        "errors":errors,
        "pass":not errors,
    }
    (EVIDENCE/"summary.json").write_text(json.dumps(out,indent=2)+"\n")
    print(json.dumps(out,indent=2))
    if errors: raise SystemExit(1)

if __name__=="__main__":
    main()

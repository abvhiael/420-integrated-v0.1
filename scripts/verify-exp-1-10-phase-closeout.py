#!/usr/bin/env python3
import json, subprocess
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
REC=ROOT/"docs/audit/EXP-1.10-phase-closeout.json"
GAPS=ROOT/"docs/audit/EXP-0.2.5-genesis-gap-register.json"
AC=ROOT/"docs/audit/EXP-0.2.6-genesis-acceptance-criteria.json"
M11=ROOT/"docs/audit/EXP-1.1-runtime-authority-manifest.json"
M12=ROOT/"docs/audit/EXP-1.2-rpc-binding.json"
READY=ROOT/"testnet/public-services/indexer/readiness.json"
CFG=ROOT/"config/420indexer-v1.json"
INDEXER_WF=ROOT/".github/workflows/420indexer.yml"
DEDICATED_WF=ROOT/".github/workflows/explorer-exp-1-10.yml"
EVIDENCE=ROOT/"exp-1-10-evidence"

EXPECTED_MILESTONES=[f"EXP-1.{i}" for i in range(1,10)]
FINDINGS=["EXP-FIND-002","EXP-FIND-004","EXP-FIND-007","EXP-FIND-009"]

def git(*args):
    return subprocess.check_output(["git",*args],cwd=ROOT,text=True).strip()

def main():
    errors=[]
    for p in [REC,GAPS,AC,M11,M12,READY,CFG,INDEXER_WF,DEDICATED_WF]:
        if not p.exists(): errors.append(f"missing {p.relative_to(ROOT)}")
    if errors:
        print(json.dumps({"pass":False,"errors":errors},indent=2)); raise SystemExit(1)

    rec=json.loads(REC.read_text())
    gaps=json.loads(GAPS.read_text())
    ac=json.loads(AC.read_text())
    m11=json.loads(M11.read_text())
    m12=json.loads(M12.read_text())
    ready=json.loads(READY.read_text())
    cfg=json.loads(CFG.read_text())
    indexer=INDEXER_WF.read_text()
    dedicated=DEDICATED_WF.read_text()

    if rec.get("schema")!="420explorer-exp-1.10-phase-closeout-v1": errors.append("schema drift")
    if rec.get("milestone")!="EXP-1.10" or rec.get("phase")!="EXP-1": errors.append("phase identity drift")
    baseline=rec.get("baseline",{})
    if baseline.get("predecessor_exp_1_9_head")!="238cd6ecd4bc7797a40c8ffbbe966eacd5448f31":
        errors.append("EXP-1.9 predecessor drift")
    base=baseline.get("main_sha")
    if not base:
        errors.append("baseline main SHA missing")
    else:
        try:
            subprocess.check_call(["git","merge-base","--is-ancestor",base,"HEAD"],cwd=ROOT)
        except subprocess.CalledProcessError:
            errors.append("recorded main baseline is not an ancestor of closeout head")

    ledger=rec.get("milestone_ledger",[])
    ids=[x.get("milestone") for x in ledger]
    if ids!=EXPECTED_MILESTONES:
        errors.append(f"milestone ledger mismatch: {ids}")
    for item in ledger:
        if not item.get("qualified_head") or item.get("status","").startswith("QUALIFIED") is False:
            errors.append(f"{item.get('milestone')}: qualified-head/status evidence missing")
        for key in ["indexer_run","docs_run","integrated_run"]:
            if not item.get(key): errors.append(f"{item.get('milestone')}: {key} missing")
        art=item.get("artifact",{})
        if not art.get("id") or not str(art.get("digest","")).startswith("sha256:"):
            errors.append(f"{item.get('milestone')}: artifact provenance missing")

    by={x.get("id"):x for x in gaps.get("findings",[])}
    disposition={x.get("id"):x for x in rec.get("finding_dispositions",[])}
    for fid in FINDINGS:
        if fid not in by or fid not in disposition:
            errors.append(f"{fid}: closeout finding missing")
            continue
        g=by[fid]; d=disposition[fid]
        if d.get("exp_1_repository_work")!="COMPLETE":
            errors.append(f"{fid}: EXP-1 repository work not complete")
        if g.get("genesis_blocking") is not True or d.get("genesis_blocking") is not True:
            errors.append(f"{fid}: live Genesis blocker was prematurely cleared")
        if not str(g.get("exp_1_disposition","")).strip():
            errors.append(f"{fid}: gap register EXP-1 disposition missing")
        if "EXP-1" in d.get("next_owners",[]):
            errors.append(f"{fid}: residual work incorrectly remains owned by EXP-1")
    if by.get("EXP-FIND-009",{}).get("exp_1_disposition")!="REPOSITORY_IMPLEMENTATION_FULLY_REMEDIATED_LIVE_WITNESS_PENDING":
        errors.append("EXP-FIND-009 implementation remediation disposition drift")

    criteria={x.get("id"):x for x in ac.get("criteria",[])}
    for aid in ["AC-1","AC-2","AC-3","AC-5","AC-6"]:
        if aid not in criteria: errors.append(f"{aid}: acceptance criterion missing")
        elif criteria[aid].get("current_status")!="unverified":
            errors.append(f"{aid}: global acceptance was prematurely promoted")

    if m11.get("status")!="COMPLETE_REPOSITORY_SCOPE":
        errors.append("EXP-1.1 closeout status not reconciled")
    if m11.get("summary",{}).get("final_evidence_head_requalification_required") is not False:
        errors.append("EXP-1.1 stale exact-head requalification flag remains")
    bind=m12.get("current_binding_state",{})
    if bind.get("runtime_binding_implementation_qualified") is not True:
        errors.append("EXP-1.2 runtime implementation not reconciled")
    if bind.get("live_binding_qualified") is not False:
        errors.append("EXP-1.2 live binding overpromoted")

    if ready.get("status")!="EXP_1_10_PHASE_CLOSEOUT_QUALIFICATION":
        errors.append("readiness closeout milestone drift")
    backend=ready.get("backend",{})
    runtime=backend.get("runtime",{})
    if backend.get("qualification_evidence",{}).get("first_consumer_420explorer")!="IMPLEMENTED_AND_EXACT_HEAD_QUALIFIED":
        errors.append("Explorer consumer final CI status not reconciled")
    if runtime.get("exp_1_repository_scope_complete") is not True:
        errors.append("EXP-1 repository completion readiness missing")
    if runtime.get("exp_1_live_network_complete") is not False or runtime.get("exp_1_genesis_complete") is not False:
        errors.append("EXP-1 live/Genesis readiness overpromoted")
    if backend.get("live_deployment",{}).get("qualified") is not False:
        errors.append("live deployment overpromoted")

    close=cfg.get("exp1PhaseCloseout",{})
    if close.get("phase")!="EXP-1" or close.get("repositoryScopeComplete") is not True:
        errors.append("config EXP-1 closeout contract missing")
    if close.get("liveNetworkComplete") is not False or close.get("genesisComplete") is not False:
        errors.append("config live/Genesis state overpromoted")
    if close.get("milestonesRequired") != [f"EXP-1.{i}" for i in range(1,11)]:
        errors.append("config required milestone set drift")
    qa=cfg.get("qualificationAutomation",{})
    if qa.get("milestone")!="EXP-1.10":
        errors.append("qualification automation not advanced to EXP-1.10")
    if qa.get("retainedExp1Range")!="EXP-1.1..EXP-1.10":
        errors.append("retained EXP-1 range does not include closeout")
    if qa.get("evidenceArtifact")!="exp-1-10-phase-closeout":
        errors.append("closeout evidence artifact contract drift")

    for text,name in [(indexer,"420Indexer"),(dedicated,"EXP-1.10 dedicated")]:
        if "verify-exp-1-10-phase-closeout.py" not in text:
            errors.append(f"{name}: EXP-1.10 verifier missing")
        if "cancel-in-progress: true" not in text:
            errors.append(f"{name}: concurrency cancellation missing")
        if "${{ github.event.pull_request.head.sha || github.sha }}" not in text:
            errors.append(f"{name}: exact-head checkout expression missing")

    acc=rec.get("acceptance",{})
    for key in [
        "milestones_1_1_through_1_9_evidence_reconciled",
        "exp_1_owned_repository_findings_remediated",
        "stale_authoritative_records_reconciled",
        "acceptance_contribution_handoffs_explicit",
        "phase_repository_scope_complete_candidate",
    ]:
        if acc.get(key) is not True: errors.append(f"closeout acceptance missing: {key}")
    if acc.get("live_network_complete") is not False or acc.get("genesis_complete") is not False:
        errors.append("closeout acceptance overpromoted")

    summary=rec.get("summary",{})
    if summary.get("remaining_exp_1_repository_blockers")!=0:
        errors.append("remaining EXP-1 repository blockers not zero")
    if summary.get("live_network_qualified") is not False or summary.get("genesis_ready") is not False:
        errors.append("phase summary live/Genesis overpromoted")
    if summary.get("next_phase")!="EXP-2":
        errors.append("next phase drift")

    EVIDENCE.mkdir(exist_ok=True)
    out={
        "schema":"420explorer-exp-1.10-evidence-v1",
        "milestone":"EXP-1.10",
        "phase":"EXP-1",
        "head_sha":git("rev-parse","HEAD"),
        "main_baseline_sha":base,
        "milestones_reconciled":ids,
        "exp_1_repository_blockers_remaining":0 if not errors else None,
        "live_network_qualified":False,
        "genesis_ready":False,
        "finding_dispositions":{fid:disposition.get(fid,{}).get("remaining") for fid in FINDINGS},
        "errors":errors,
        "pass":not errors,
    }
    (EVIDENCE/"summary.json").write_text(json.dumps(out,indent=2)+"\n")
    print(json.dumps(out,indent=2))
    if errors: raise SystemExit(1)

if __name__=="__main__":
    main()

#!/usr/bin/env python3
import csv
import json
import re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
MATRIX=ROOT/"docs/audit/EXP-0.3.3-mandatory-acceptance-tests.json"
REQS=ROOT/"docs/audit/EXP-0.3.1-authoritative-genesis-requirements.json"
CAPS=ROOT/"docs/audit/EXP-0.2.1-genesis-capability-matrix.json"
PATHS=ROOT/"docs/audit/EXP-0.3.2-mandatory-capability-paths.json"
GAPS=ROOT/"docs/audit/EXP-0.2.5-genesis-gap-register.json"
ACMAP=ROOT/"docs/audit/EXP-0.2.6-genesis-acceptance-criteria.json"
PROFILE=ROOT/"contracts/config/420explorer-genesis.json"
EVIDENCE=ROOT/"exp-0-3-3-evidence"

def load(p): return json.loads(p.read_text(encoding="utf-8"))

def main():
    errors=[]
    m=load(MATRIX); reqs=load(REQS); caps=load(CAPS); paths=load(PATHS); gaps=load(GAPS); acmap=load(ACMAP); profile=load(PROFILE)
    if m.get("schema")!="420explorer-exp-0.3.3-mandatory-acceptance-tests-v1": errors.append("unexpected schema")
    if m.get("milestone")!="EXP-0.3.3": errors.append("unexpected milestone")
    if m.get("baseline",{}).get("main_commit")!="c7cb5f4dac07eb9416cac4a11eeee31b6efb10f0": errors.append("baseline main drift")
    entries=m.get("entries",[])
    if len(entries)!=10: errors.append(f"expected 10 entries, found {len(entries)}")
    ids=[e.get("id") for e in entries]
    if len(ids)!=len(set(ids)): errors.append("duplicate test-map id")
    expected=profile.get("requiredViews",[])
    if [e.get("name") for e in entries]!=expected: errors.append("requiredView test-map order mismatch")

    req_by={r["id"]:r for r in reqs.get("requirements",[])}
    cap_by={c["id"]:c for c in caps.get("capabilities",[])}
    path_by={p["id"]:p for p in paths.get("paths",[])}
    gap_by={g["id"]:g for g in gaps.get("findings",[])}
    valid_ac={c["id"] for c in acmap.get("criteria",[])}

    for e in entries:
        eid=e.get("id","<missing>")
        if e.get("mapping_status")!="complete_acceptance_path": errors.append(f"{eid}: mapping_status is not complete_acceptance_path")
        r=req_by.get(e.get("requirement_id"))
        c=cap_by.get(e.get("capability_id"))
        p=path_by.get(e.get("path_id"))
        if not r or r.get("classification")!="mandatory_genesis" or r.get("category")!="required_view":
            errors.append(f"{eid}: invalid mandatory requirement mapping")
        elif r.get("name")!=e.get("name"):
            errors.append(f"{eid}: requirement/name mismatch")
        if not c or c.get("classification")!="mandatory_genesis":
            errors.append(f"{eid}: invalid mandatory capability mapping")
        elif c.get("name")!=e.get("name"):
            errors.append(f"{eid}: capability/name mismatch")
        if not p or p.get("source_path_status")!="complete_source_path":
            errors.append(f"{eid}: missing complete EXP-0.3.2 path")
        else:
            if p.get("name")!=e.get("name"): errors.append(f"{eid}: path/name mismatch")
            if p.get("capability_status")!=e.get("capability_status"):
                errors.append(f"{eid}: source status drift")
            if p.get("acceptance_criteria")!=e.get("acceptance_criteria"):
                errors.append(f"{eid}: acceptance criteria drift from EXP-0.3.2")

        tests=e.get("current_automated_tests")
        if not isinstance(tests,list) or not tests:
            errors.append(f"{eid}: no current automated test source")
        else:
            for t in tests:
                rel=t.get("path")
                if not rel or not (ROOT/rel).exists():
                    errors.append(f"{eid}: missing current test path {rel}")
                    continue
                if not str(t.get("coverage","")).strip():
                    errors.append(f"{eid}: empty coverage statement for {rel}")
                content=(ROOT/rel).read_text(encoding="utf-8")
                for test_name in t.get("tests",[]):
                    if not re.search(r"func\s+"+re.escape(test_name)+r"\s*\(",content):
                        errors.append(f"{eid}: named test not found in {rel}: {test_name}")

        future=e.get("later_qualification_tests")
        if not isinstance(future,list) or not future:
            errors.append(f"{eid}: later qualification procedure missing")
        else:
            owners=set(e.get("later_owners",[]))
            for f in future:
                owner=f.get("owner")
                if owner not in owners:
                    errors.append(f"{eid}: procedure owner {owner} not in later_owners")
                if not str(f.get("procedure","")).strip():
                    errors.append(f"{eid}: empty later qualification procedure")

        findings=e.get("gap_findings")
        if not isinstance(findings,list) or not findings:
            errors.append(f"{eid}: gap/findings trace missing")
        else:
            for fid in findings:
                if fid not in gap_by: errors.append(f"{eid}: unknown gap finding {fid}")

        acs=e.get("acceptance_criteria")
        if not isinstance(acs,list) or not acs:
            errors.append(f"{eid}: acceptance criteria missing")
        else:
            for ac in acs:
                if ac not in valid_ac: errors.append(f"{eid}: unknown acceptance criterion {ac}")

        if not e.get("later_owners"):
            errors.append(f"{eid}: later owners missing")

    by={e["name"]:e for e in entries}
    required_findings={
      "transaction":{"EXP-FIND-008"},
      "receipt/logs":{"EXP-FIND-010"},
      "validator":{"EXP-FIND-007","EXP-FIND-009"},
      "epoch/rotation":{"EXP-FIND-007"},
      "protocol service/version":{"EXP-FIND-005","EXP-FIND-006"},
      "network status":{"EXP-FIND-004"},
    }
    for name,needed in required_findings.items():
        mapped=set(by[name].get("gap_findings",[]))
        missing=needed-mapped
        if missing: errors.append(f"{name}: required findings missing: {sorted(missing)}")

    required_future_tokens={
      "transaction":["fee"],
      "receipt/logs":["topic","data"],
      "token/asset activity":["decoder","filter"],
      "validator":["provider","producer"],
      "epoch/rotation":["boundary","provider"],
      "protocol service/version":["protocolregistry","descriptor"],
      "network status":["wrong-chain","stale"],
    }
    for name,tokens in required_future_tokens.items():
        blob=" ".join(x.get("procedure","") for x in by[name].get("later_qualification_tests",[])).lower()
        for token in tokens:
            if token not in blob: errors.append(f"{name}: future procedure token missing: {token}")

    summary=m.get("summary",{})
    impl=sum(e.get("capability_status")=="implemented_source" for e in entries)
    partial=sum(e.get("capability_status")=="partial_source" for e in entries)
    complete=sum(e.get("mapping_status")=="complete_acceptance_path" for e in entries)
    if summary.get("mandatory_required_views")!=10: errors.append("summary mandatory count drift")
    if summary.get("complete_acceptance_paths")!=10 or complete!=10: errors.append("summary complete acceptance-path count drift")
    if summary.get("source_test_mapped")!=10: errors.append("summary source-test mapped count drift")
    if summary.get("implemented_source")!=6 or impl!=6: errors.append("summary implemented count drift")
    if summary.get("partial_source")!=4 or partial!=4: errors.append("summary partial count drift")
    if summary.get("orphaned_test_paths")!=0: errors.append("orphaned test paths must remain zero")
    if summary.get("fully_genesis_accepted")!=0: errors.append("EXP-0.3.3 must not mark any capability fully Genesis accepted")

    meaning=m.get("qualification_meaning","").lower()
    for token in ("does not mean","runtime","deployment","genesis acceptance"):
        if token not in meaning: errors.append(f"qualification boundary token missing: {token}")

    EVIDENCE.mkdir(exist_ok=True)
    out={
      "schema":"exp-0.3.3-evidence-v1",
      "milestone":"EXP-0.3.3",
      "entries":len(entries),
      "complete_acceptance_paths":complete,
      "source_test_mapped":sum(bool(e.get("current_automated_tests")) for e in entries),
      "implemented_source":impl,
      "partial_source":partial,
      "orphaned_test_paths":10-complete,
      "fully_genesis_accepted":summary.get("fully_genesis_accepted"),
      "errors":errors,
      "pass":not errors
    }
    (EVIDENCE/"summary.json").write_text(json.dumps(out,indent=2)+"\n",encoding="utf-8")
    with (EVIDENCE/"acceptance-tests.tsv").open("w",encoding="utf-8",newline="") as fh:
        w=csv.writer(fh,delimiter="\t")
        w.writerow(["id","name","requirement_id","capability_id","path_id","status","current_test_files","later_procedures","findings","acceptance_criteria","owners"])
        for e in entries:
            w.writerow([
              e["id"],e["name"],e["requirement_id"],e["capability_id"],e["path_id"],e["capability_status"],
              ",".join(t["path"] for t in e["current_automated_tests"]),
              str(len(e["later_qualification_tests"])),
              ",".join(e["gap_findings"]),
              ",".join(e["acceptance_criteria"]),
              ",".join(e["later_owners"])
            ])
    print(json.dumps(out,indent=2))
    if errors: raise SystemExit(1)

if __name__=="__main__": main()

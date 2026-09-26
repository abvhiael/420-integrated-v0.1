#!/usr/bin/env python3
import csv, json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
MAP=ROOT/"docs/audit/EXP-0.2.6-genesis-acceptance-criteria.json"
GAPS=ROOT/"docs/audit/EXP-0.2.5-genesis-gap-register.json"
EVIDENCE=ROOT/"exp-0-2-6-evidence"

QUESTIONS=[
"Can a user independently inspect and verify the supported blockchain transactions, blocks, and addresses?",
"Does the Explorer retrieve and display accurate information from the authoritative 420 Integrated network?",
"Are all required data-ingestion and indexing processes operational, consistent, and recoverable?",
"Are the required smart contract addresses, ABIs, registry references, and protocol integrations correct?",
"Are all Genesis-required user-facing workflows functional?",
"Are the backend APIs, frontend, indexing services, and supporting infrastructure integrated and tested?",
"Are relevant security, data integrity, and operational risks addressed?",
"Are the deployment procedures complete and reproducible?",
"Are all required test suites passing against the exact release candidate?",
"Is there sufficient recorded evidence to support the final Genesis qualification decision?",
]
VALID_OWNERS={"EXP-0","EXP-1","EXP-2","EXP-3","EXP-4","EXP-5","EXP-6","EXP-7","EXP-8"}

def load(p): return json.loads(p.read_text(encoding="utf-8"))

def main():
    errors=[]
    m=load(MAP); gaps=load(GAPS)
    criteria=m.get("criteria",[])
    expected_ids=[f"AC-{i}" for i in range(1,11)]
    ids=[c.get("id") for c in criteria]

    if m.get("schema")!="420explorer-exp-0.2.6-genesis-acceptance-criteria-v1": errors.append("unexpected schema")
    if m.get("milestone")!="EXP-0.2.6": errors.append("unexpected milestone")
    if ids!=expected_ids: errors.append(f"criterion ID/order mismatch: {ids}")
    if [c.get("question") for c in criteria]!=QUESTIONS: errors.append("Part 9 question text/order mismatch")
    if m.get("final_decision_authority")!="EXP-8": errors.append("final decision authority must remain EXP-8")

    gap_by={f["id"]:f for f in gaps.get("findings",[])}
    blocking={fid for fid,f in gap_by.items() if f.get("genesis_blocking")}
    post={fid for fid,f in gap_by.items() if f.get("classification")=="Post-Genesis enhancement"}

    for c in criteria:
        cid=c.get("id","<missing>")
        if c.get("current_status")!="unverified": errors.append(f"{cid}: EXP-0.2.6 may not mark criterion satisfied")
        if c.get("primary_owner") not in VALID_OWNERS: errors.append(f"{cid}: invalid primary owner")
        support=c.get("supporting_owners")
        if not isinstance(support,list) or not support: errors.append(f"{cid}: supporting owners required")
        elif any(x not in VALID_OWNERS for x in support): errors.append(f"{cid}: invalid supporting owner")
        for key in ("verification_method","required_evidence","source_anchors"):
            if not isinstance(c.get(key),list) or not c.get(key): errors.append(f"{cid}: missing {key}")
        blockers=c.get("blocking_findings")
        if not isinstance(blockers,list): errors.append(f"{cid}: blocking_findings must be list")
        else:
            for fid in blockers:
                if fid not in gap_by: errors.append(f"{cid}: unknown finding {fid}")
                elif fid not in blocking: errors.append(f"{cid}: mapped non-blocking finding {fid}")
                if fid in post: errors.append(f"{cid}: post-Genesis enhancement mapped as blocker {fid}")
        for rel in c.get("source_anchors",[]):
            if not (ROOT/rel).exists(): errors.append(f"{cid}: missing source anchor {rel}")

    # Every blocker that declares an AC must be reflected by that AC's blocker list.
    criteria_by={c["id"]:c for c in criteria}
    for fid,f in gap_by.items():
        if not f.get("genesis_blocking"): continue
        for ac in f.get("acceptance_criteria",[]):
            if ac not in criteria_by:
                errors.append(f"{fid}: unknown acceptance criterion {ac}")
            elif fid not in criteria_by[ac].get("blocking_findings",[]):
                errors.append(f"{fid}: missing reverse mapping in {ac}")

    inv=" ".join(m.get("invariants",[])).lower()
    rule=m.get("status_rule","").lower()
    if "exact release candidate" not in inv+rule: errors.append("exact-release-candidate rule missing")
    if "unverified" not in inv+rule or "satisfied" not in inv+rule: errors.append("status discipline missing")
    if "source-level ci" not in inv and "source-only ci" not in inv: errors.append("source-vs-runtime qualification rule missing")

    EVIDENCE.mkdir(exist_ok=True)
    summary={
      "schema":"exp-0.2.6-evidence-v1",
      "milestone":"EXP-0.2.6",
      "criteria":len(criteria),
      "unverified":sum(c.get("current_status")=="unverified" for c in criteria),
      "satisfied":sum(c.get("current_status")=="satisfied" for c in criteria),
      "mapped_blocking_findings":len(set(fid for c in criteria for fid in c.get("blocking_findings",[]))),
      "errors":errors,
      "pass":not errors
    }
    (EVIDENCE/"summary.json").write_text(json.dumps(summary,indent=2)+"\n",encoding="utf-8")
    with (EVIDENCE/"criteria.tsv").open("w",encoding="utf-8",newline="") as fh:
        w=csv.writer(fh,delimiter="\t")
        w.writerow(["id","status","primary_owner","supporting_owners","blocking_findings","question"])
        for c in criteria:
            w.writerow([c["id"],c["current_status"],c["primary_owner"],",".join(c["supporting_owners"]),",".join(c["blocking_findings"]),c["question"]])
    print(json.dumps(summary,indent=2))
    if errors: raise SystemExit(1)

if __name__=="__main__": main()

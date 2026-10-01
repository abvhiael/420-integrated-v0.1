#!/usr/bin/env python3
import json, pathlib, re, sys

R=pathlib.Path(__file__).resolve().parents[1]
M=R/"contracts/config/compute-market/cmp-1.4.10-cross-verifier-adversarial-qualification.json"
D=R/"docs/compute-market/CMP-1.4.10-CROSS-VERIFIER-ADVERSARIAL-QUALIFICATION.md"
RM=R/"docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md"

errors=[]
for p in [M,D,RM]:
    if not p.exists(): errors.append(f"missing {p.relative_to(R)}")
if errors:
    print("\n".join(errors)); sys.exit(1)

m=json.loads(M.read_text())
d=D.read_text()
r=RM.read_text()

definition="Cover forged/replayed verdicts, stale policy, wrong job/worker/attempt, verifier collusion, authority drift and failure atomicity."
if m.get("step")!="CMP-1.4.10": errors.append("wrong step")
if m.get("canonical_definition")!=definition: errors.append("definition drift")
if f"### CMP-1.4.10 — Cross-verifier adversarial qualification\n{definition}" not in r:
    errors.append("roadmap definition drift")

required_threats={
 "forged_or_false_verifier",
 "replayed_or_cross_domain_verdict",
 "wrong_job_result_assignment_or_altered_output",
 "wrong_worker_or_attempt",
 "stale_or_mutated_policy",
 "verifier_collusion_or_friendly_selection",
 "authority_or_identity_drift",
 "cross_method_substitution_or_replay",
 "dispute_or_appeal_authority_confusion",
 "failure_atomicity_and_economic_isolation",
}
matrix=m.get("threat_matrix",[])
by_threat={x.get("threat"):x for x in matrix}
if set(by_threat)!=required_threats:
    errors.append("threat matrix set drift")

for threat,row in by_threat.items():
    evidence=row.get("evidence",[])
    if not evidence:
        errors.append(f"{threat}: no executable evidence")
    for item in evidence:
        if "::" not in item:
            errors.append(f"{threat}: malformed evidence {item}")
            continue
        rel,test=item.split("::",1)
        p=R/rel
        if not p.exists():
            errors.append(f"{threat}: missing file {rel}")
            continue
        src=p.read_text()
        if f"function {test}(" not in src:
            errors.append(f"{threat}: missing test {item}")

policy=R/"contracts/test/ComputeVerificationPolicyBinding420.t.sol"
if policy.exists():
    s=policy.read_text()
    for token in [
        "testStaleRevisionAndDuplicateBindingFailClosed",
        "stale policy rejection mutated frozen job policy",
        "duplicate policy rejection mutated frozen job policy",
    ]:
        if token not in s: errors.append(f"stale-policy atomicity missing {token}")
else:
    errors.append("missing policy binding test")

required_invariants={
 "CMP-INV-005","CMP-INV-009","CMP-INV-010","CMP-INV-013","CMP-INV-014",
 "CMP-INV-016","CMP-INV-017","CMP-INV-018","CMP-INV-020","CMP-INV-022",
 "CMP-INV-023","CMP-INV-024","CMP-INV-025","CMP-INV-026","CMP-INV-027","CMP-INV-030"
}
if set(m.get("invariants",[])) != required_invariants:
    errors.append("invariant set drift")

mil=m.get("milestone_relationship",{})
if mil.get("level_2_required_now") is not True:
    errors.append("Level 2 milestone not required")
if mil.get("milestone")!="CMP-1.4 cross-verifier adversarial integration":
    errors.append("wrong Level 2 milestone")

dep=m.get("deployment_publication",{})
for key in ["fixed_genesis_predeploy_created","protocol_registry_publication_claimed","live_deployment_claimed"]:
    if dep.get(key) is not False:
        errors.append(f"unexpected deployment claim {key}")

if m.get("implementation",{}).get("production_contract_changes") is not False:
    errors.append("unexpected production-contract change claim")

for heading in [
    "## Canonical definition","## Repository baseline","## Gap analysis",
    "## Threat campaign","## Level 1 qualification","## Level 2 milestone",
    "## Invariant disposition","## Limitations","## Exit criteria","## Completion"
]:
    if heading not in d: errors.append(f"missing heading {heading}")

if errors:
    print("CMP-1.4.10 verification FAILED")
    for e in errors: print("-",e)
    sys.exit(1)

print("CMP-1.4.10 cross-verifier adversarial qualification: mechanically consistent")

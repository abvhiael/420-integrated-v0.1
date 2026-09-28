#!/usr/bin/env python3
import json
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
errors = []

BASELINE = "52a162612257122d4c6b6e2ab9e8bc163d1d5f6f"
PR_HEAD = "26a06117c7662c0f8986a2f7b505d5180d3121ea"

EXPECTED = [
    ".github/workflows/explorer-exp-2-1.yml",
    ".github/workflows/explorer-exp-2-2.yml",
    ".github/workflows/explorer-exp-2-3.yml",
    ".github/workflows/explorer-exp-2-4.yml",
    ".github/workflows/explorer-exp-2-5.yml",
    ".github/workflows/explorer-exp-2-6.yml",
    "scripts/verify-exp-2-1-transaction-fees.py",
    "scripts/verify-exp-2-2-http-routes.py",
    "scripts/verify-exp-2-3-data-services.py",
    "scripts/verify-exp-2-4-consensus.py",
    "scripts/verify-exp-2-5-raw-events.py",
    "scripts/verify-exp-2-6-diagnostics-registry.py",
    "docs/audit/EXP-2.1-transaction-fee-api-qualification.json",
    "docs/audit/EXP-2.2-http-route-contracts.json",
    "docs/audit/EXP-2.3-data-services.json",
    "docs/audit/EXP-2.4-consensus-producer.json",
    "docs/audit/EXP-2.5-raw-call-events.json",
    "docs/audit/EXP-2.6-diagnostics-registry.json",
    "docs/audit/EXP-0.2.2-user-workflow-matrix.json",
    "docs/audit/EXP-0.2.5-genesis-gap-register.json",
    "docs/audit/EXP-0.2.6-genesis-acceptance-criteria.json",
    "docs/audit/EXP-0.3.7-bidirectional-traceability.json",
    "docs/audit/EXP-0.4.7-canonical-qualification-ledger.json",
    "docs/audit/EXP-1.10-phase-closeout.json",
    "contracts/config/420explorer-genesis.json",
    "docs/audit/EXP-2R-post-merge-reconciliation.json",
    "docs/audit/EXP-2R.5-authoritative-next-phase-roadmap.json",
]

TESTS = [
    "explorer/api/exp_2_2_contract_test.go",
    "explorer/api/exp_2_3_data_routes_test.go",
    "explorer/api/exp_2_4_consensus_test.go",
    "explorer/api/exp_2_5_raw_events_test.go",
    "explorer/api/exp_2_6_diagnostics_registry_test.go",
    "explorer/indexerclient/exp_2_3_client_test.go",
    "explorer/indexerclient/exp_2_4_consensus_test.go",
    "explorer/indexerclient/exp_2_6_registry_client_test.go",
    "explorer/service/exp_2_3_data_contract_test.go",
    "explorer/service/exp_2_4_consensus_test.go",
    "explorer/service/exp_2_5_raw_events_test.go",
    "explorer/service/exp_2_6_diagnostics_registry_test.go",
]

def fail(msg):
    errors.append(msg)

def load(path):
    return json.loads((ROOT / path).read_text(encoding="utf-8"))

def main():
    for path in EXPECTED + TESTS:
        if not (ROOT / path).exists():
            fail(f"missing required reconciliation input: {path}")

    audit = load("docs/audit/EXP-2R-post-merge-reconciliation.json")
    if audit.get("milestone") != "EXP-2R":
        fail("EXP-2R milestone mismatch")
    if audit.get("baseline", {}).get("current_main") != BASELINE:
        fail("EXP-2R baseline current_main mismatch")
    if audit.get("baseline", {}).get("pr_381_final_head") != PR_HEAD:
        fail("EXP-2R PR head mismatch")
    if audit.get("original_roadmap_recovery", {}).get("not_recovered") is None:
        fail("missing explicit lost-roadmap recovery boundary")
    recovered = audit.get("original_roadmap_recovery", {}).get("recovered_with_confidence", {}).get("milestones", {})
    if set(recovered) != {"EXP-2.1", "EXP-2.2", "EXP-2.3"}:
        fail("recovered historical roadmap set must remain limited to EXP-2.1 through EXP-2.3")
    if audit.get("blocker_determination", {}).get("new_merged_code_defect_found") is not False:
        fail("reconciliation must not invent a merged-code defect")
    if audit.get("blocker_determination", {}).get("phase_2_repository_backend_service_api_blockers_remaining") != 0:
        fail("Phase-2 backend/service/API blocker determination drifted")

    scope = audit.get("final_scope", {})
    for key in ["deployed_ui_qualified", "live_target_network_qualified", "canonical_authority", "genesis_ready_claim"]:
        if scope.get(key) is not False:
            fail(f"EXP-2R must keep {key}=false")

    exp25 = load("docs/audit/EXP-2.5-raw-call-events.json")
    if exp25.get("status") != "COMPLETE":
        fail("EXP-2.5 stale status was not reconciled")
    final25 = exp25.get("final_qualification", {})
    if final25.get("evidence_recording_head") != PR_HEAD:
        fail("EXP-2.5 final evidence head mismatch")
    if final25.get("exact_head_requalification") != "success":
        fail("EXP-2.5 final exact-head status is not success")
    if final25.get("genesis_ready_claim") is not False:
        fail("EXP-2.5 must not claim Genesis readiness")
    chain = exp25.get("reconciliation", {}).get("evidence_chain", [])
    required_runs = {36384004251, 36384607389, 36454719177, 36455530414}
    if {x.get("run_id") for x in chain} != required_runs:
        fail("EXP-2.5 evidence-chain run IDs are incomplete or changed")
    if exp25.get("reconciliation", {}).get("merge_tree_equivalence", {}).get("compare_files_changed") != 0:
        fail("EXP-2.5 merge-tree equivalence is not recorded as zero changed files")

    roadmap = load("docs/audit/EXP-2R.5-authoritative-next-phase-roadmap.json")
    prov = roadmap.get("provenance", {})
    if prov.get("planning_baseline_sha") != BASELINE:
        fail("roadmap baseline mismatch")
    if prov.get("explicitly_new_numbering") is not True:
        fail("roadmap must explicitly use new numbering")
    if prov.get("historical_EXP_2_7_through_EXP_2_10_recovered") is not False:
        fail("roadmap must not claim lost EXP-2.7 through EXP-2.10 recovery")
    expected_ids = [f"EXP-NEXT.{i}" for i in range(1, 6)]
    actual_ids = [x.get("id") for x in roadmap.get("sequence", [])]
    if actual_ids != expected_ids:
        fail(f"roadmap sequence mismatch: {actual_ids}")
    mandatory_fields = [
        "id", "objective", "exact_baseline_sha", "dependencies",
        "concrete_implementation_tasks", "required_tests",
        "negative_fail_closed_cases", "exact_head_ci_requirements",
        "audit_evidence_artifacts", "explicit_scope_exclusions",
        "completion_conditions",
    ]
    for step in roadmap.get("sequence", []):
        for field in mandatory_fields:
            if field not in step or step[field] in (None, "", []):
                fail(f"{step.get('id')}: missing required roadmap field {field}")
        if step.get("exact_baseline_sha") != BASELINE:
            fail(f"{step.get('id')}: baseline SHA mismatch")

    head = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    out = ROOT / "exp-2r-evidence"
    out.mkdir(exist_ok=True)
    summary = {
        "schema": "420explorer-exp-2r-evidence-v1",
        "milestone": "EXP-2R",
        "head": head,
        "status": "qualified_reconciliation_candidate" if not errors else "failed",
        "errors": errors,
        "baseline_main": BASELINE,
        "pr_381_final_qualified_head": PR_HEAD,
        "scope": "repository_reconciliation_only",
        "genesis_ready_claim": False,
    }
    (out / "summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    if errors:
        for error in errors:
            print("ERROR:", error, file=sys.stderr)
        return 1
    print(json.dumps(summary, indent=2))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())

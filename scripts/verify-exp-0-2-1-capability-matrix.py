#!/usr/bin/env python3
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MATRIX_PATH = ROOT / "docs/audit/EXP-0.2.1-genesis-capability-matrix.json"
PROFILE_PATH = ROOT / "contracts/config/420explorer-genesis.json"
APPS_PATH = ROOT / "config/genesis-applications.json"
EVIDENCE = ROOT / "exp-0-2-1-evidence"

VALID_CLASSES = {
    "mandatory_genesis",
    "shared_supporting_dependency",
    "optional_display_enrichment",
    "post_genesis_enhancement",
    "explicitly_out_of_scope",
    "scope_decision_required",
}
VALID_IMPLEMENTATION = {"implemented_source", "partial_source", "not_observed", "not_applicable"}
VALID_RUNTIME = {"unverified", "pending_deployment", "not_applicable"}
VALID_QUALIFICATION = {"inventory_classified", "requires_later_qualification", "scope_decision_required"}

def load(path):
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)

def main():
    errors = []
    matrix = load(MATRIX_PATH)
    profile = load(PROFILE_PATH)
    apps = load(APPS_PATH)

    if matrix.get("schema") != "420explorer-exp-0.2.1-capability-matrix-v1":
        errors.append("unexpected matrix schema")
    if matrix.get("milestone") != "EXP-0.2.1":
        errors.append("unexpected milestone")

    caps = matrix.get("capabilities")
    if not isinstance(caps, list) or not caps:
        errors.append("capabilities must be a non-empty list")
        caps = []

    ids = [c.get("id") for c in caps]
    names = [c.get("name") for c in caps]
    if len(ids) != len(set(ids)):
        errors.append("duplicate capability id")
    if len(names) != len(set(names)):
        errors.append("duplicate capability name")

    for cap in caps:
        name = cap.get("name", "<unnamed>")
        if cap.get("classification") not in VALID_CLASSES:
            errors.append(f"{name}: invalid classification")
        if cap.get("implementation_status") not in VALID_IMPLEMENTATION:
            errors.append(f"{name}: invalid implementation status")
        if cap.get("runtime_status") not in VALID_RUNTIME:
            errors.append(f"{name}: invalid runtime status")
        if cap.get("qualification_status") not in VALID_QUALIFICATION:
            errors.append(f"{name}: invalid qualification status")
        evidence = cap.get("evidence")
        if not isinstance(evidence, list) or not evidence:
            errors.append(f"{name}: missing evidence paths")
        else:
            for rel in evidence:
                if not (ROOT / rel).exists():
                    errors.append(f"{name}: evidence path missing: {rel}")

    required_views = profile.get("requiredViews", [])
    mandatory = [c for c in caps if c.get("classification") == "mandatory_genesis"]
    mandatory_names = [c.get("name") for c in mandatory]
    if sorted(mandatory_names) != sorted(required_views):
        missing = sorted(set(required_views) - set(mandatory_names))
        extra = sorted(set(mandatory_names) - set(required_views))
        errors.append(f"mandatory Genesis view mismatch; missing={missing}, extra={extra}")

    for cap in mandatory:
        name = cap["name"]
        if cap.get("implementation_status") != "implemented_source":
            errors.append(f"{name}: mandatory capability is not source-implemented")
        if cap.get("runtime_status") != "unverified":
            errors.append(f"{name}: EXP-0.2.1 must not claim runtime qualification")
        if cap.get("qualification_status") != "requires_later_qualification":
            errors.append(f"{name}: mandatory capability must remain assigned to later qualification")
        if not cap.get("explorer_api") and not cap.get("indexer_dependencies"):
            errors.append(f"{name}: mandatory capability has no executable surface")

    dependency_routes = set()
    for cap in caps:
        dependency_routes.update(cap.get("indexer_dependencies", []))
    for route in profile.get("indexerConsumer", {}).get("requiredEndpoints", []):
        if route not in dependency_routes:
            errors.append(f"required Indexer endpoint absent from matrix: {route}")

    optional_names = {c.get("name"): c for c in caps if c.get("classification") == "optional_display_enrichment"}
    if optional_names.get("420 Names labels", {}).get("implementation_status") not in {"not_observed", "partial_source", "implemented_source"}:
        errors.append("420 Names optional enrichment missing or malformed")
    if optional_names.get("420 Identity public labels", {}).get("implementation_status") not in {"not_observed", "partial_source", "implemented_source"}:
        errors.append("420 Identity optional enrichment missing or malformed")

    if profile.get("contractsRequired") is not False:
        errors.append("Explorer profile no longer contract-free; matrix requires review")
    if profile.get("canonicalStateAuthority") is not False:
        errors.append("Explorer profile unexpectedly claims canonical authority")
    out_scope = {c.get("name") for c in caps if c.get("classification") == "explicitly_out_of_scope"}
    for required in {
        "Explorer-specific Genesis smart contract",
        "Explorer transaction signing or contract writes",
        "independent Explorer RPC ingestion/checkpoint/reorg/decoder pipeline",
    }:
        if required not in out_scope:
            errors.append(f"missing out-of-scope authority boundary: {required}")

    explorer_app = next((a for a in apps.get("apps", []) if a.get("name") == "420 Explorer"), None)
    if explorer_app is None:
        errors.append("420 Explorer missing from frozen Genesis application decision")
        explorer_purpose = ""
    else:
        if explorer_app.get("contracts_required") is not False:
            errors.append("frozen application decision no longer marks Explorer contract-free")
        explorer_purpose = str(explorer_app.get("purpose", ""))

    governance_required = "governance" in {str(v).lower() for v in required_views}
    governance_named = "governance" in explorer_purpose.lower()
    governance_caps = [c for c in caps if c.get("name") == "governance view"]
    if governance_named and not governance_required:
        if len(governance_caps) != 1 or governance_caps[0].get("classification") != "scope_decision_required":
            errors.append("governance scope conflict must be represented as scope_decision_required")
    elif governance_required:
        if len(governance_caps) != 1 or governance_caps[0].get("classification") != "mandatory_genesis":
            errors.append("governance became required but matrix was not reconciled")
    elif governance_caps:
        errors.append("governance scope-decision entry remains after authoritative wording was removed")

    EVIDENCE.mkdir(exist_ok=True)
    summary = {
        "schema": "exp-0.2.1-evidence-v1",
        "milestone": "EXP-0.2.1",
        "matrix_baseline": matrix.get("baseline", {}).get("main_merge_commit"),
        "required_views": len(required_views),
        "mandatory_capabilities": len(mandatory),
        "shared_supporting_dependencies": sum(c.get("classification") == "shared_supporting_dependency" for c in caps),
        "optional_display_enrichments": sum(c.get("classification") == "optional_display_enrichment" for c in caps),
        "explicitly_out_of_scope": sum(c.get("classification") == "explicitly_out_of_scope" for c in caps),
        "scope_decisions_required": sum(c.get("classification") == "scope_decision_required" for c in caps),
        "governance_scope_conflict_recorded": bool(governance_named and not governance_required and governance_caps),
        "errors": errors,
        "pass": not errors,
    }
    (EVIDENCE / "summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")

    with (EVIDENCE / "capabilities.tsv").open("w", encoding="utf-8", newline="") as fh:
        writer = csv.writer(fh, delimiter="\t")
        writer.writerow(["id", "name", "classification", "implementation_status", "runtime_status", "qualification_status"])
        for cap in caps:
            writer.writerow([
                cap.get("id", ""),
                cap.get("name", ""),
                cap.get("classification", ""),
                cap.get("implementation_status", ""),
                cap.get("runtime_status", ""),
                cap.get("qualification_status", ""),
            ])

    print(json.dumps(summary, indent=2))
    if errors:
        raise SystemExit(1)

if __name__ == "__main__":
    main()

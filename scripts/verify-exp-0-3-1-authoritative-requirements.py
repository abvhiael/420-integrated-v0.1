#!/usr/bin/env python3
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INV = ROOT / "docs/audit/EXP-0.3.1-authoritative-genesis-requirements.json"
PROFILE = ROOT / "contracts/config/420explorer-genesis.json"
APPS = ROOT / "config/genesis-applications.json"
ADDR_A = ROOT / "config/system-addresses.json"
ADDR_B = ROOT / "contracts/config/system-addresses.json"
CAPS = ROOT / "docs/audit/EXP-0.2.1-genesis-capability-matrix.json"
ACMAP = ROOT / "docs/audit/EXP-0.2.6-genesis-acceptance-criteria.json"
EVIDENCE = ROOT / "exp-0-3-1-evidence"

BASELINE = "c7cb5f4dac07eb9416cac4a11eeee31b6efb10f0"
VALID_CLASSES = {
    "mandatory_genesis",
    "optional_integration",
    "post_genesis_enhancement",
    "scope_decision_required",
}
VALID_STATUSES = {
    "implemented_source",
    "partial_source",
    "source_qualified",
    "deployment_pending",
    "runtime_unverified",
    "optional_unimplemented",
    "post_genesis",
    "scope_decision_required",
}

def load(path):
    return json.loads(path.read_text(encoding="utf-8"))

def main():
    errors = []
    inv = load(INV)
    profile = load(PROFILE)
    apps = load(APPS)
    addr_a = load(ADDR_A)
    addr_b = load(ADDR_B)
    caps = load(CAPS)
    acmap = load(ACMAP)

    if inv.get("schema") != "420explorer-exp-0.3.1-authoritative-genesis-requirements-v1":
        errors.append("unexpected inventory schema")
    if inv.get("milestone") != "EXP-0.3.1":
        errors.append("unexpected milestone")
    if inv.get("baseline_main_commit") != BASELINE:
        errors.append("baseline main commit drift")

    reqs = inv.get("requirements", [])
    ids = [r.get("id") for r in reqs]
    if len(reqs) != 64:
        errors.append(f"expected 64 active requirements after EXP-0.3.8 scope resolution, found {len(reqs)}")
    if len(ids) != len(set(ids)):
        errors.append("duplicate requirement id")

    counts = {c: sum(r.get("classification") == c for r in reqs) for c in VALID_CLASSES}
    expected_counts = {
        "mandatory_genesis": 60,
        "optional_integration": 2,
        "post_genesis_enhancement": 2,
        "scope_decision_required": 0,
    }
    if counts != expected_counts:
        errors.append(f"classification count drift: {counts}")

    valid_ac = {c.get("id") for c in acmap.get("criteria", [])}
    if valid_ac != {f"AC-{i}" for i in range(1, 11)}:
        errors.append("acceptance-map AC set drift")

    for r in reqs:
        rid = r.get("id", "<missing>")
        if r.get("classification") not in VALID_CLASSES:
            errors.append(f"{rid}: invalid classification")
        if r.get("current_status") not in VALID_STATUSES:
            errors.append(f"{rid}: invalid current_status")
        src = r.get("authoritative_source")
        if not isinstance(src, dict) or not src.get("path") or not src.get("selector"):
            errors.append(f"{rid}: authoritative source/selector missing")
        elif not (ROOT / src["path"]).exists():
            errors.append(f"{rid}: authoritative source path missing: {src['path']}")
        if not isinstance(r.get("statement"), str) or not r.get("statement").strip():
            errors.append(f"{rid}: statement missing")
        paths = r.get("implementation_paths")
        if not isinstance(paths, list) or not paths:
            errors.append(f"{rid}: implementation paths missing")
        else:
            for rel in paths:
                if not (ROOT / rel).exists():
                    errors.append(f"{rid}: implementation/evidence path missing: {rel}")
        owners = r.get("later_qualification_owners")
        if not isinstance(owners, list) or not owners:
            errors.append(f"{rid}: qualification owner missing")
        acs = r.get("acceptance_criteria")
        if not isinstance(acs, list):
            errors.append(f"{rid}: acceptance_criteria must be list")
        else:
            for ac in acs:
                if ac not in valid_ac:
                    errors.append(f"{rid}: unknown acceptance criterion {ac}")
        if r.get("classification") == "mandatory_genesis" and not acs:
            errors.append(f"{rid}: mandatory requirement has no acceptance criterion")
        if r.get("classification") in {"optional_integration", "post_genesis_enhancement"} and acs:
            errors.append(f"{rid}: non-blocking optional/post-Genesis requirement mapped to core acceptance criteria")

    by_id = {r["id"]: r for r in reqs}
    by_name = {r["name"]: r for r in reqs}

    # Dedicated requiredViews must map exactly and only to the 10 mandatory view records.
    required_views = profile.get("requiredViews", [])
    view_reqs = [r for r in reqs if r.get("category") == "required_view"]
    if [r.get("name") for r in view_reqs] != required_views:
        errors.append("requiredView inventory/order mismatch")
    if len(view_reqs) != 10 or any(r.get("classification") != "mandatory_genesis" for r in view_reqs):
        errors.append("required views are not exactly ten mandatory requirements")

    cap_by_name = {c.get("name"): c for c in caps.get("capabilities", [])}
    for r in view_reqs:
        cap = cap_by_name.get(r["name"])
        if not cap or cap.get("classification") != "mandatory_genesis":
            errors.append(f"{r['id']}: missing matching mandatory EXP-0.2 capability")
        if not any(str(n).startswith("EXP-0.2 capability: EXP-CAP-") for n in r.get("notes", [])):
            errors.append(f"{r['id']}: EXP-0.2 capability trace missing")

    # Frozen application decision must agree on class and contract-free status.
    explorer_app = next((a for a in apps.get("apps", []) if a.get("name") == "420 Explorer"), None)
    if explorer_app is None:
        errors.append("420 Explorer missing from frozen application decision")
        purpose = ""
    else:
        purpose = str(explorer_app.get("purpose", ""))
        if explorer_app.get("class") != "GENESIS_USER_APP":
            errors.append("frozen application decision class drift")
        if explorer_app.get("contracts_required") is not False:
            errors.append("frozen application decision no longer contract-free")
    if profile.get("class") != "GENESIS_USER_APP":
        errors.append("dedicated profile class drift")
    if profile.get("contractsRequired") is not False:
        errors.append("dedicated profile no longer contract-free")
    if profile.get("canonicalStateAuthority") is not False:
        errors.append("Explorer unexpectedly claims canonical authority")

    # Required source and indexer-consumer boundaries.
    expected_profile_values = {
        "EXP-REQ-SRC-001": profile.get("sources", {}).get("chainIndex") == "420Indexer /v1 read API",
        "EXP-REQ-SRC-002": profile.get("sources", {}).get("directExecutionRpcIngestion") is False,
        "EXP-REQ-IDX-001": profile.get("indexerConsumer", {}).get("service") == "420Indexer",
        "EXP-REQ-IDX-002": profile.get("indexerConsumer", {}).get("apiVersion") == "v1",
        "EXP-REQ-IDX-003": profile.get("indexerConsumer", {}).get("requiredChainId") == 420,
        "EXP-REQ-IDX-004": profile.get("indexerConsumer", {}).get("independentChainIngestion") is False,
        "EXP-REQ-IDX-005": profile.get("indexerConsumer", {}).get("independentCheckpointStore") is False,
        "EXP-REQ-IDX-006": profile.get("indexerConsumer", {}).get("independentReorgEngine") is False,
        "EXP-REQ-IDX-007": profile.get("indexerConsumer", {}).get("independentProtocolDecoderRegistry") is False,
        "EXP-REQ-IDX-008": profile.get("indexerConsumer", {}).get("failClosedOnCanonicalAuthorityClaim") is True,
    }
    for rid, ok in expected_profile_values.items():
        if rid not in by_id:
            errors.append(f"missing required boundary {rid}")
        if not ok:
            errors.append(f"authoritative profile changed for {rid}")

    expected_eps = profile.get("indexerConsumer", {}).get("requiredEndpoints", [])
    ep_reqs = [r for r in reqs if r.get("category") == "required_endpoint"]
    if [r.get("name") for r in ep_reqs] != expected_eps:
        errors.append("required Indexer endpoint inventory mismatch")

    # Indexing guarantees.
    expected_indexing = {
        "canonicalKey": "chainId:blockHash",
        "tracksHeadSafeFinalizedSeparately": True,
        "reorgsAllowedOnlyAboveFinality": True,
        "finalizedHistoryImmutable": True,
        "rebuildableFromChain": True,
        "databaseIsNonCanonical": True,
        "implementedBy": "420Indexer",
    }
    indexing_reqs = [r for r in reqs if r.get("category") == "indexing_rule"]
    if len(indexing_reqs) != len(expected_indexing):
        errors.append("indexing rule count mismatch")
    for key, value in expected_indexing.items():
        if profile.get("indexing", {}).get(key) != value:
            errors.append(f"authoritative indexing rule changed: {key}")
        if key not in by_name:
            errors.append(f"indexing requirement missing: {key}")

    # Contract verification boundaries.
    expected_verification = {
        "showRuntimeCodeHash": True,
        "showRegistryServiceAndVersion": True,
        "showManifestCommitmentWhenRegistered": True,
        "verifiedSourceIsPresentationMetadata": True,
        "sourceVerificationCannotOverrideRuntimeBytecode": True,
    }
    for key, value in expected_verification.items():
        if profile.get("contractVerification", {}).get(key) != value:
            errors.append(f"contract verification rule changed: {key}")
        if key not in by_name:
            errors.append(f"contract verification requirement missing: {key}")

    # Preserve all 13 invariant source statements exactly after the ID prefix.
    invariants = profile.get("invariants", [])
    if len(invariants) != 13:
        errors.append(f"expected 13 source invariants, found {len(invariants)}")
    for i, raw in enumerate(invariants, 1):
        iid = f"EXP-INV-{i:03d}"
        rid = f"EXP-REQ-INV-{i:03d}"
        req = by_id.get(rid)
        if not req:
            errors.append(f"missing invariant requirement {rid}")
            continue
        prefix = iid + ": "
        if not raw.startswith(prefix):
            errors.append(f"source invariant prefix drift: {iid}")
        elif req.get("statement") != raw[len(prefix):]:
            errors.append(f"invariant statement drift: {iid}")

    # Frozen address authority.
    if addr_a != addr_b:
        errors.append("frozen system-address maps diverge")
    assignments = {x.get("name"): x.get("address") for x in addr_a.get("assignments", [])}
    if assignments.get("ProtocolRegistry") != "0x0000000000000000000000000000000000000434":
        errors.append("ProtocolRegistry frozen address drift")
    if any("explorer" in str(name).lower() for name in assignments):
        errors.append("Explorer unexpectedly owns a frozen system address")
    for rid in ("EXP-REQ-ADDR-001", "EXP-REQ-ADDR-002", "EXP-REQ-ADDR-003"):
        if rid not in by_id:
            errors.append(f"missing address authority requirement {rid}")

    # Optional and post-Genesis discipline.
    for rid in ("EXP-REQ-SRC-005", "EXP-REQ-SRC-006"):
        if by_id.get(rid, {}).get("classification") != "optional_integration":
            errors.append(f"{rid}: optional integration classification drift")
    for rid in ("EXP-REQ-POST-001", "EXP-REQ-POST-002"):
        if by_id.get(rid, {}).get("classification") != "post_genesis_enhancement":
            errors.append(f"{rid}: post-Genesis classification drift")

    # EXP-0.3.8 resolved the governance ambiguity via Resolution B.
    governance_in_purpose = "governance" in purpose.lower()
    governance_required = "governance" in {str(v).lower() for v in required_views}
    scope = by_id.get("EXP-REQ-SCOPE-001")
    if governance_in_purpose or governance_required:
        errors.append("governance scope was reintroduced after EXP-0.3.8 Resolution B")
    if scope is not None:
        errors.append("retired governance scope requirement remains active")
    resolved = inv.get("resolved_scope_decisions", [])
    if len(resolved) != 1 or resolved[0].get("decision") != "EXP-SCOPE-RESOLUTION-B":
        errors.append("EXP-0.3.8 resolved scope decision record missing")

    EVIDENCE.mkdir(exist_ok=True)
    summary = {
        "schema": "exp-0.3.1-evidence-v1",
        "milestone": "EXP-0.3.1",
        "baseline_main_commit": BASELINE,
        "requirements": len(reqs),
        "classification_counts": counts,
        "required_views": len(view_reqs),
        "required_endpoints": len(ep_reqs),
        "source_invariants": len(invariants),
        "system_address_maps_match": addr_a == addr_b,
        "protocol_registry_address": assignments.get("ProtocolRegistry"),
        "governance_scope_conflict_recorded": bool(governance_in_purpose and not governance_required),
        "errors": errors,
        "pass": not errors,
    }
    (EVIDENCE / "summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")

    with (EVIDENCE / "requirements.tsv").open("w", encoding="utf-8", newline="") as fh:
        writer = csv.writer(fh, delimiter="\t")
        writer.writerow(["id", "category", "name", "classification", "current_status", "owners", "acceptance_criteria"])
        for r in reqs:
            writer.writerow([
                r.get("id", ""),
                r.get("category", ""),
                r.get("name", ""),
                r.get("classification", ""),
                r.get("current_status", ""),
                ",".join(r.get("later_qualification_owners", [])),
                ",".join(r.get("acceptance_criteria", [])),
            ])

    print(json.dumps(summary, indent=2))
    if errors:
        raise SystemExit(1)

if __name__ == "__main__":
    main()

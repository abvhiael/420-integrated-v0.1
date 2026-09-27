#!/usr/bin/env python3
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKFLOW_PATH = ROOT / "docs/audit/EXP-0.2.2-user-workflow-matrix.json"
CAPABILITY_PATH = ROOT / "docs/audit/EXP-0.2.1-genesis-capability-matrix.json"
EVIDENCE = ROOT / "exp-0-2-2-evidence"

EXPECTED = [
    "verify receipt of a native 420 transfer",
    "confirm success or failure of a transaction",
    "inspect transaction fees",
    "review wallet activity",
    "locate and examine a smart contract",
    "verify a contract deployment",
    "track token transfers",
    "inspect validator-produced blocks",
    "investigate a failed contract interaction",
    "confirm an ecosystem application transaction",
    "verify an on-chain payment",
    "review publicly available staking or reward activity",
    "examine contract events",
    "confirm an application's published contract address",
    "use Explorer data during troubleshooting or development",
]
VALID_SUPPORT = {"supported_source", "partial_source", "not_observed"}
VALID_ACCEPTANCE = {"mapped_to_later_gate", "gap_requires_implementation"}
VALID_OWNERS = {f"EXP-{i}" for i in range(1, 8)}

def load(path):
    return json.loads(path.read_text(encoding="utf-8"))

def main():
    errors = []
    matrix = load(WORKFLOW_PATH)
    caps = load(CAPABILITY_PATH)
    workflows = matrix.get("workflows", [])

    if matrix.get("schema") != "420explorer-exp-0.2.2-user-workflow-matrix-v1":
        errors.append("unexpected workflow matrix schema")
    if matrix.get("milestone") != "EXP-0.2.2":
        errors.append("unexpected milestone")

    names = [w.get("name") for w in workflows]
    ids = [w.get("id") for w in workflows]
    if names != EXPECTED:
        errors.append(f"workflow list/order mismatch: {names}")
    if len(ids) != len(set(ids)):
        errors.append("duplicate workflow id")
    if len(names) != len(set(names)):
        errors.append("duplicate workflow name")

    cap_ids = {c.get("id") for c in caps.get("capabilities", [])}
    for w in workflows:
        name = w.get("name", "<unnamed>")
        if w.get("source_support") not in VALID_SUPPORT:
            errors.append(f"{name}: invalid source_support")
        if w.get("runtime_status") != "unverified":
            errors.append(f"{name}: EXP-0.2.2 must not claim runtime qualification")
        if w.get("execution_claim") != "not_runtime_qualified":
            errors.append(f"{name}: executable runtime claim is premature")
        if w.get("acceptance_status") not in VALID_ACCEPTANCE:
            errors.append(f"{name}: invalid acceptance_status")
        for field in ("objective","expected_result"):
            if not isinstance(w.get(field), str) or not w.get(field).strip():
                errors.append(f"{name}: missing {field}")
        for field in ("prerequisites","user_path","limitations","capability_ids","evidence","later_owner","required_tests"):
            value = w.get(field)
            if not isinstance(value, list) or not value:
                errors.append(f"{name}: missing/non-empty-list required for {field}")
        for cid in w.get("capability_ids", []):
            if cid not in cap_ids:
                errors.append(f"{name}: unknown capability id {cid}")
        for rel in w.get("evidence", []):
            if not (ROOT / rel).exists():
                errors.append(f"{name}: evidence path missing: {rel}")
        for owner in w.get("later_owner", []):
            if owner not in VALID_OWNERS:
                errors.append(f"{name}: invalid later owner {owner}")
        if w.get("source_support") == "not_observed" and w.get("acceptance_status") != "gap_requires_implementation":
            errors.append(f"{name}: not_observed workflow must be an implementation gap")
        if w.get("source_support") != "not_observed" and not (w.get("explorer_routes") or w.get("explorer_api")):
            errors.append(f"{name}: supported/partial workflow lacks Explorer surface")

    by_name = {w.get("name"): w for w in workflows}
    fee = by_name.get("inspect transaction fees", {})
    if fee.get("source_support") != "partial_source" or not any("effective gas price" in x.lower() or "fee" in x.lower() for x in fee.get("limitations", [])):
        errors.append("transaction-fee limitation is not preserved")

    producer = by_name.get("inspect validator-produced blocks", {})
    if producer.get("source_support") != "not_observed" or producer.get("acceptance_status") != "gap_requires_implementation":
        errors.append("validator-produced-block gap is not preserved")

    staking = by_name.get("review publicly available staking or reward activity", {})
    if staking.get("source_support") != "not_observed" or staking.get("acceptance_status") != "gap_requires_implementation":
        errors.append("staking/reward workflow gap is not preserved")

    payment = by_name.get("verify an on-chain payment", {})
    if not any("does not infer" in x.lower() or "semantics" in x.lower() for x in payment.get("limitations", [])):
        errors.append("payment authority boundary missing")
    published = by_name.get("confirm an application's published contract address", {})
    if not any("not registry authority" in x.lower() or "projection is not registry authority" in x.lower() for x in published.get("limitations", [])):
        errors.append("Registry authority boundary missing")

    EVIDENCE.mkdir(exist_ok=True)
    summary = {
        "schema":"exp-0.2.2-evidence-v1",
        "milestone":"EXP-0.2.2",
        "workflow_count":len(workflows),
        "supported_source":sum(w.get("source_support")=="supported_source" for w in workflows),
        "partial_source":sum(w.get("source_support")=="partial_source" for w in workflows),
        "not_observed":sum(w.get("source_support")=="not_observed" for w in workflows),
        "runtime_qualified":sum(w.get("execution_claim")!="not_runtime_qualified" for w in workflows),
        "errors":errors,
        "pass":not errors,
    }
    (EVIDENCE/"summary.json").write_text(json.dumps(summary,indent=2)+"\n",encoding="utf-8")
    with (EVIDENCE/"workflows.tsv").open("w",encoding="utf-8",newline="") as fh:
        writer=csv.writer(fh,delimiter="\t")
        writer.writerow(["id","name","source_support","runtime_status","acceptance_status","later_owner"])
        for w in workflows:
            writer.writerow([w.get("id",""),w.get("name",""),w.get("source_support",""),w.get("runtime_status",""),w.get("acceptance_status",""),",".join(w.get("later_owner",[]))])
    print(json.dumps(summary,indent=2))
    if errors:
        raise SystemExit(1)

if __name__ == "__main__":
    main()

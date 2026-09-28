#!/usr/bin/env python3
import json
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
errors = []

def require(path, needle, label):
    text = (ROOT / path).read_text(encoding="utf-8")
    if needle not in text:
        errors.append(f"{label}: missing {needle!r} in {path}")

def main():
    server = (ROOT / "explorer/api/server.go").read_text(encoding="utf-8")
    test = (ROOT / "explorer/api/exp_2_2_contract_test.go").read_text(encoding="utf-8")
    audit = json.loads((ROOT / "docs/audit/EXP-2.2-http-route-contracts.json").read_text(encoding="utf-8"))

    required_routes = [
        "/v1/health","/v1/ready","/v1/status","/v1/blocks","/v1/blocks/{number}",
        "/v1/blocks/{number}/trace","/v1/transactions/{hash}","/v1/receipts/{hash}",
        "/v1/addresses/{address}","/v1/contracts/{address}","/v1/services",
        "/v1/services/{service}","/v1/services/{service}/versions/{version}",
        "/v1/assets/activity","/v1/consensus",
    ]
    for route in required_routes:
        if route not in server:
            errors.append(f"server route contract missing {route}")
        if route not in audit.get("route_contract", []):
            errors.append(f"audit route contract missing {route}")

    for token in [
        'limit>250',
        'HandleFunc("/v1/"',
        '"unknown API route"',
        '"X-420-Data-Source","420Indexer"',
        '"X-420-Canonical-Authority","false"',
    ]:
        if token not in server:
            errors.append(f"server contract token missing: {token}")

    for name in [
        "TestCapabilitiesAdvertisesCompleteExplorerAPIContract",
        "TestBlocksRejectLimitAboveContractMaximum",
        "TestUnknownAPIRouteFailsClosedAsJSON",
        "TestUnsupportedMethodDoesNotFallThroughToSPA",
    ]:
        if name not in test:
            errors.append(f"EXP-2.2 negative/contract test missing: {name}")

    if audit.get("milestone") != "EXP-2.2":
        errors.append("audit milestone is not EXP-2.2")
    scope = audit.get("scope_boundary", {})
    for key in ["deployed_ui_qualified","live_target_network_qualified","registry_runtime_qualified","canonical_authority","genesis_ready_claim"]:
        if scope.get(key) is not False:
            errors.append(f"scope boundary must keep {key}=false")

    head = subprocess.check_output(["git","rev-parse","HEAD"], cwd=ROOT, text=True).strip()
    out = ROOT / "exp-2-2-evidence"
    out.mkdir(exist_ok=True)
    summary = {
        "schema":"420explorer-exp-2.2-evidence-v1",
        "milestone":"EXP-2.2",
        "head":head,
        "status":"qualified_repository_scope" if not errors else "failed",
        "errors":errors,
        "scope_boundary":scope,
    }
    (out / "summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    if errors:
        for err in errors:
            print(f"ERROR: {err}", file=sys.stderr)
        return 1
    print(json.dumps(summary, indent=2))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())

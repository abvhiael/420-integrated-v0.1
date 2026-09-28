#!/usr/bin/env python3
import json, pathlib, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
errors = []

def contains(path, token, label):
    text = (ROOT / path).read_text(encoding="utf-8")
    if token not in text:
        errors.append(f"{label}: missing {token!r} in {path}")

def main():
    audit = json.loads((ROOT / "docs/audit/EXP-2.3-data-services.json").read_text(encoding="utf-8"))
    if audit.get("milestone") != "EXP-2.3":
        errors.append("audit milestone mismatch")
    if audit.get("baseline",{}).get("exp_2_2_qualified_head") != "23a1a8a28a53013ad0c7543ea9c27f71e1fd7ec7":
        errors.append("EXP-2.2 baseline head mismatch")

    checks = [
        ("explorer/service/addressviews.go", 'limit > 250', "address bound"),
        ("explorer/service/addressviews.go", 'page.CanonicalAuthority', "address authority rejection"),
        ("explorer/service/assetviews.go", 'strings.EqualFold(page.AssetKey, assetKey)', "asset-key filter echo"),
        ("explorer/service/assetviews.go", 'strings.EqualFold(page.Address, address)', "asset-address filter echo"),
        ("explorer/service/contractviews.go", 'DeploymentTxHash', "contract deployment provenance"),
        ("explorer/service/contractviews.go", 'hex.DecodeString(code)', "runtime code validation"),
        ("explorer/service/exp_2_3_data_contract_test.go", 'TestEXP23ContractDeploymentCrossViewProvenance', "deployment cross-view test"),
        ("explorer/service/exp_2_3_data_contract_test.go", 'TestEXP23AssetKindsPreserveTokenIdentity', "token projection test"),
        ("explorer/api/exp_2_3_data_routes_test.go", 'TestEXP23AddressContractAndAssetRoutes', "HTTP representative test"),
        ("explorer/indexerclient/exp_2_3_client_test.go", 'TestEXP23ClientRejectsAuthorityClaimsAcrossDataRoutes', "client authority test"),
    ]
    for path, token, label in checks:
        contains(path, token, label)

    scope = audit.get("scope_boundary", {})
    for key in ["deployed_ui_qualified","live_target_network_qualified","token_decoder_qualified","registry_runtime_qualified","canonical_authority","genesis_ready_claim"]:
        if scope.get(key) is not False:
            errors.append(f"scope boundary must keep {key}=false")

    head = subprocess.check_output(["git","rev-parse","HEAD"], cwd=ROOT, text=True).strip()
    out = ROOT / "exp-2-3-evidence"
    out.mkdir(exist_ok=True)
    summary = {
        "schema":"420explorer-exp-2.3-evidence-v1",
        "milestone":"EXP-2.3",
        "head":head,
        "status":"qualified_repository_scope" if not errors else "failed",
        "errors":errors,
        "scope_boundary":scope
    }
    (out/"summary.json").write_text(json.dumps(summary, indent=2)+"\n", encoding="utf-8")
    if errors:
        for e in errors: print("ERROR:", e, file=sys.stderr)
        return 1
    print(json.dumps(summary, indent=2))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""LAUNCHPAD-REC-6: deterministic pre-testnet artifact/readiness/build attestation.

Never uses local EVM addresses or template-bytecode hashes as live code hashes.
No network, RPC, signing key or external Python dependency is required.
"""
import argparse
import hashlib
import json
import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTRACTS = [
    ("LaunchpadAuthorization420", ["address"]),
    ("LaunchpadProjectRegistry420", ["address"]),
    ("LaunchpadSaleRegistry420", ["address", "address"]),
    ("LaunchpadAllocationRegistry420", ["address", "address"]),
    ("LaunchpadCrowdfundingIntegration420", ["address"] * 5),
    ("LaunchpadRouter420", ["address", "address"]),
]
CONTRACT_NAMES = [name for name, _ in CONTRACTS]
HEX = re.compile(r"^0x[0-9a-fA-F]*$")
EXPECTED_FLAGS = {"optimizer": {"enabled": True, "runs": 200}, "evmVersion": "cancun", "viaIR": True}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def canonical(obj):
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()


def data(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def bytecode(artifact, kind, name):
    entry = artifact.get(kind)
    require(isinstance(entry, dict) and isinstance(entry.get("object"), str), f"{name}: missing {kind}")
    value = entry["object"]
    require(len(value) > 2 and len(value) % 2 == 0 and HEX.fullmatch(value), f"{name}: unlinked or invalid {kind}")
    return bytes.fromhex(value[2:])


def verify_artifacts(out_dir, source_sha):
    root = Path(out_dir)
    require(re.fullmatch("[0-9a-fA-F]{40}", source_sha or "") is not None, "exact git SHA required")
    config = data(ROOT / "contracts/config/launchpad/launchpad-audit-4-release-materialization.json")
    expected_paths = [f"contracts/out/{name}.sol/{name}.json" for name in CONTRACT_NAMES]
    require(config["artifact_identity"]["artifact_paths"] == expected_paths, "Audit-4 compiled artifact inventory drift")
    for key, expected in (("compiler", "Solidity 0.8.24"), ("evm_version", "cancun"),
                          ("optimizer", True), ("optimizer_runs", 200), ("via_ir", True)):
        require(config["artifact_identity"].get(key) == expected, f"frozen compiler setting drift: {key}")
    manifest = {"schema": "420-launchpad-rec-6-artifact-attestation-v1",
                "source_sha": source_sha.lower(), "compiler": "0.8.24", "evm": "cancun",
                "optimizer_runs": 200, "via_ir": True,
                "runtime_hash_type": "SHA256_OF_UNLINKED_RUNTIME_TEMPLATE_NOT_DEPLOYED_EXTCODEHASH",
                "chain_evidence": None, "contracts": []}
    for name, inputs in CONTRACTS:
        path = root / f"{name}.sol" / f"{name}.json"
        require(path.is_file(), f"required compiled artifact missing: {name}")
        raw = path.read_bytes()
        artifact = json.loads(raw)
        abi = artifact.get("abi")
        require(isinstance(abi, list), f"{name}: ABI missing")
        constructors = [entry for entry in abi if entry.get("type") == "constructor"]
        require(len(constructors) == 1, f"{name}: wrong constructor ABI count")
        found = [i.get("type") for i in constructors[0].get("inputs", [])]
        require(found == inputs, f"{name}: constructor ABI does not match frozen dependency sequence")
        require(constructors[0].get("stateMutability") == "nonpayable",
                f"{name}: constructor unexpectedly payable")
        metadata = artifact.get("metadata")
        require(isinstance(metadata, (str, dict)) and metadata, f"{name}: compiler metadata missing")
        metadata = json.loads(metadata) if isinstance(metadata, str) else metadata
        compiler = metadata.get("compiler", {}).get("version", "")
        require(compiler.startswith("0.8.24"), f"{name}: compiler version drift")
        settings = metadata.get("settings", {})
        for key, expected in EXPECTED_FLAGS.items():
            require(settings.get(key) == expected, f"{name}: compiler metadata setting drift {key}")
        deployed = bytecode(artifact, "deployedBytecode", name)
        creation = bytecode(artifact, "bytecode", name)
        require(len(deployed) >= 20 and len(creation) >= len(deployed),
                f"{name}: unexpected empty or shortened code")
        require(not artifact.get("bytecode", {}).get("linkReferences"),
                f"{name}: unlinked library in constructor")
        require(not artifact.get("deployedBytecode", {}).get("linkReferences"),
                f"{name}: unlinked library in deployed runtime")
        manifest["contracts"].append({
            "name": name, "constructor": inputs, "artifact_sha256": sha(raw),
            "abi_sha256": sha(canonical(abi)), "creation_bytecode_sha256": sha(creation),
            "runtime_template_sha256": sha(deployed),
            "creation_bytes": len(creation), "runtime_template_bytes": len(deployed),
            "immutable_reference_slots": sum(len(v) for v in
                artifact.get("deployedBytecode", {}).get("immutableReferences", {}).values()),
        })
    require(len(manifest["contracts"]) == 6, "incomplete release artifact inventory")
    return manifest


def verify_readiness():
    materialization = data(ROOT / "contracts/config/launchpad/launchpad-audit-4-release-materialization.json")
    genesis = data(ROOT / "contracts/config/420launchpad-genesis.json")
    public = data(ROOT / "testnet/public-services/launchpad/readiness.json")
    require(materialization["status"] == "REPOSITORY_QUALIFIED_PRE_TESTNET", "deployment repository status drift")
    require(materialization["repository_ready"] is True and materialization["live_qualified"] is False,
            "deployment readiness misleading")
    require(genesis["status"] == "REPOSITORY_QUALIFIED_PRE_TESTNET", "Genesis configuration status drift")
    require(genesis["new_frozen_predeploy_required"] is False, "unexpected fixed Launchpad predeploy")
    require(public["schema"] == "420-launchpad-pretestnet-readiness-v1", "public readiness schema drift")
    require(public["service_id"] == "420/service/launchpad/v1", "canonical Launchpad service ID drift")
    require(public["repository_qualified"] is True and public["live_testnet_qualified"] is False
            and public["genesis_ready"] is False and public["production_ready"] is False,
            "live/genesis/production readiness incorrectly promoted")
    require(public["deployment_status"] == "NOT_DEPLOYED_PUBLIC_TESTNET", "false deployment claim")
    require(public["next_canonical_step"] == "LAUNCHPAD-AUDIT-6", "wrong testnet handoff")
    authority = materialization["address_policy"]
    require(authority["launchpad_router_status"] == "REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS",
            "Launchpad Router address policy drift")
    require(authority["create2_policy"] == "NOT_ADOPTED_DO_NOT_INVENT",
            "unapproved CREATE2 policy")
    live = materialization["live_testnet_evidence"]
    for item in ("chain_id", "genesis_hash", "evidence_block", "evidence_block_hash"):
        require(live[item] is None, f"forged live {item}")
    for item in ("deployed_addresses", "runtime_code_hashes"):
        require(live[item] == {}, f"forged live {item}")
    for item in ("deployment_transactions", "registry_transactions", "constructor_binding_receipts"):
        require(live[item] == [], f"forged live {item}")
    return {"schema": "420-launchpad-rec-6-readiness-check-v1", "repository_qualified": True,
            "live_qualified": False, "genesis_ready": False, "production_ready": False,
            "next_step": "LAUNCHPAD-AUDIT-6"}


def verify_web(dist, source_sha):
    web = ROOT / "launchpad/web"
    dist = Path(dist)
    require(re.fullmatch("[0-9a-fA-F]{40}", source_sha or "") is not None, "exact git SHA required")
    meta = data(dist / "build-meta.json")
    require(meta.get("schema") == "420-launchpad-web-build-v1" and
            meta.get("sourceSha") == source_sha and
            meta.get("execution") == "FAIL_CLOSED_UNTIL_RUNTIME_RESOLVED",
            "production build has incorrect provenance or execution policy")
    runtime = data(dist / "runtime-config.json")
    require(runtime.get("execution", {}).get("status") == "DISABLED_UNTIL_CANONICAL_RUNTIME_RESOLVED",
            "production runtime not fail closed")
    require(runtime.get("registry", {}).get("serviceId") == "420/service/launchpad/v1",
            "incorrect production service identity")
    require(runtime.get("network", {}).get("chainId") is None,
            "unqualified concrete chain injected into pre-testnet production build")
    checks = ["index.html", "app.js", "styles.css", "runtime-config.json"]
    sources = list((web / "core").rglob("*"))
    require(all(p.is_file() for p in sources), "unexpected core source entry")
    checks += [str(Path("core") / path.relative_to(web / "core")) for path in sources]
    checks = sorted(checks)
    for path in checks:
        require((web / path).read_bytes() == (dist / path).read_bytes(),
                f"production artifact source changed: {path}")
    require((dist / "404.html").read_bytes() == (dist / "index.html").read_bytes(),
            "404 fallback does not match application")
    security = (dist / "_headers").read_text()
    require("Content-Security-Policy:" in security and "frame-ancestors 'none'" in security
            and "X-Frame-Options: DENY" in security, "production headers missing security boundary")
    output = {"schema": "420-launchpad-rec-6-production-web-v1", "source_sha": source_sha,
              "files_verified": len(checks) + 3,
              "app_sha256": sha((dist / "app.js").read_bytes()),
              "html_sha256": sha((dist / "index.html").read_bytes()),
              "runtime_sha256": sha((dist / "runtime-config.json").read_bytes()),
              "execution": "DISABLED_UNTIL_CANONICAL_RUNTIME_RESOLVED"}
    return output


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("phase", choices=["artifacts", "readiness", "web"])
    parser.add_argument("--out-dir", default="contracts/out")
    parser.add_argument("--dist", default="launchpad/web/dist")
    parser.add_argument("--sha", default=os.environ.get("GITHUB_SHA", ""))
    parser.add_argument("--output")
    args = parser.parse_args()
    result = (verify_artifacts(ROOT / args.out_dir, args.sha) if args.phase == "artifacts"
              else verify_readiness() if args.phase == "readiness"
              else verify_web(ROOT / args.dist, args.sha))
    output = json.dumps(result, sort_keys=True, indent=2) + "\n"
    if args.output:
        Path(args.output).write_text(output)
    print(output, end="")


if __name__ == "__main__":
    main()

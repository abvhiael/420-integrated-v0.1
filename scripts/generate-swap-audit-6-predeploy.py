#!/usr/bin/env python3
"""SWAP-AUDIT-6 deterministic compiler artifacts and frozen predeploy-state materialization.

This step owns the four frozen Swap system predeploys:
- GenesisDEXFactory @ 0x042b
- PublicBatchAuction @ 0x042c
- TWAPOracle @ 0x042d
- ApprovedQuoteAssetRegistry @ 0x0439

It also retains compiler artifacts for the registry-resolved CanonicalSwapExecutor420
and CanonicalConstantProductPool420 deployment components.

The four frozen predeploys inherit GenesisResidentAccess420 and therefore embed the
GovernanceTimelock, ProtocolRegistry and genesisConfigHash as Solidity immutables.
The first two identities are frozen. The global genesisConfigHash is not currently
frozen anywhere in repository authority. This generator must never invent it.

When genesis_config_hash is unresolved, reproducible compiler artifacts and symbolic
predeploy-state records are emitted, but the predeploy plan remains
COMPILER_ARTIFACT_FROZEN rather than ARTIFACT_READY. Once global Genesis authority
provides a canonical bytes32 value, the same generator materializes every compiler-
reported immutable reference and produces final runtime hashes without changing
Swap semantics or frozen addresses.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
CONTRACTS = ROOT / "contracts"
OUT = CONTRACTS / "out"
ARTIFACT_DIR = CONTRACTS / "artifacts"
PREDEPLOY_DIR = CONTRACTS / "config/predeploy"
PLAN_PATH = PREDEPLOY_DIR / "predeploy-plan.json"
STORAGE_INIT_PATH = PREDEPLOY_DIR / "storage-init.json"
DEPLOYMENT_PATH = CONTRACTS / "config/deployment-manifest.json"
NAMESPACE_PATH = CONTRACTS / "config/genesis-address-namespace.json"
FOUNDRY_CONFIG = CONTRACTS / "foundry.toml"
TOOLCHAIN = CONTRACTS / "config/security/toolchain.json"

TIMELOCK = "0x0000000000000000000000000000000000000429"
REGISTRY = "0x0000000000000000000000000000000000000434"
EMPTY_STORAGE_ROOT = "0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421"

FROZEN = {
    "GenesisDEXFactory": ("swap/GenesisDEXFactory.sol", "0x000000000000000000000000000000000000042b"),
    "PublicBatchAuction": ("swap/PublicBatchAuction.sol", "0x000000000000000000000000000000000000042c"),
    "TWAPOracle": ("swap/TWAPOracle.sol", "0x000000000000000000000000000000000000042d"),
    "ApprovedQuoteAssetRegistry": ("swap/ApprovedQuoteAssetRegistry.sol", "0x0000000000000000000000000000000000000439"),
}
DEPLOYMENT_COMPONENTS = {
    **FROZEN,
    "CanonicalSwapExecutor420": ("swap/CanonicalSwapExecutor420.sol", None),
    "CanonicalConstantProductPool420": ("swap/CanonicalConstantProductPool420.sol", None),
}


def fail(message: str) -> None:
    raise ValueError(message)


def run(*args: str) -> str:
    return subprocess.check_output(args, cwd=ROOT, text=True).strip()


def git_blob_sha(path: pathlib.Path) -> str:
    return run("git", "hash-object", str(path.relative_to(ROOT)))


def cast_keccak(value: str) -> str:
    return run("cast", "keccak", value).lower()


def canonical_json(obj: object) -> str:
    return json.dumps(obj, indent=2, sort_keys=True) + "\n"


def manifest_json(obj: object) -> str:
    return json.dumps(obj, indent=2) + "\n"


def normalize_hex(value: object) -> str:
    if not isinstance(value, str) or not value.startswith("0x"):
        fail("expected 0x-prefixed hex")
    body = value[2:]
    if len(body) % 2 or any(c not in "0123456789abcdefABCDEF" for c in body):
        fail("invalid hex")
    return "0x" + body.lower()


def foundry_artifact(name: str) -> pathlib.Path:
    return OUT / f"{name}.sol" / f"{name}.json"


def source_path(rel: str) -> pathlib.Path:
    return CONTRACTS / "src" / rel


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def compiler_provenance() -> dict:
    cfg = FOUNDRY_CONFIG.read_text(encoding="utf-8")
    for token in [
        'solc_version = "0.8.24"',
        'evm_version = "cancun"',
        "optimizer = true",
        "optimizer_runs = 200",
        "via_ir = true",
    ]:
        if token not in cfg:
            fail("pinned Foundry setting missing: " + token)
    tc = json.loads(TOOLCHAIN.read_text(encoding="utf-8"))
    expected = {
        "solidity_version": "0.8.24",
        "evm_version": "cancun",
        "optimizer": True,
        "optimizer_runs": 200,
    }
    for key, value in expected.items():
        if tc.get(key) != value:
            fail("toolchain drift for " + key)
    return {
        "solidity": "0.8.24",
        "evmVersion": "cancun",
        "optimizer": True,
        "optimizerRuns": 200,
        "viaIR": True,
        "foundryConfigBlobSha1": git_blob_sha(FOUNDRY_CONFIG),
        "toolchainConfigBlobSha1": git_blob_sha(TOOLCHAIN),
    }


def load_raw(name: str) -> dict:
    path = foundry_artifact(name)
    if not path.is_file():
        fail(f"missing Foundry artifact for {name}; run forge build first")
    return json.loads(path.read_text(encoding="utf-8"))


def artifact_record(name: str, rel_source: str, address: str | None, compiler: dict) -> dict:
    raw = load_raw(name)
    deployed = raw.get("deployedBytecode")
    bytecode = raw.get("bytecode")
    if not isinstance(deployed, dict) or not isinstance(bytecode, dict):
        fail(f"{name} missing bytecode objects")
    runtime = normalize_hex(deployed.get("object"))
    creation = normalize_hex(bytecode.get("object"))
    refs = deployed.get("immutableReferences", {})
    layout = raw.get("storageLayout")
    if not isinstance(layout, dict) or not isinstance(layout.get("storage"), list):
        try:
            inspected = subprocess.check_output(
                ["forge", "inspect", f"src/{rel_source}:{name}", "storage-layout", "--json"],
                cwd=CONTRACTS,
                text=True,
            ).strip()
            layout = json.loads(inspected)
        except (subprocess.CalledProcessError, json.JSONDecodeError) as exc:
            fail(f"{name} compiler storage-layout inspection failed: {exc}")
    if not isinstance(layout, dict) or not isinstance(layout.get("storage"), list):
        fail(f"{name} missing compiler storageLayout")
    source = source_path(rel_source)
    record = {
        "schema": "420-swap-audit-6-compiler-artifact-v1",
        "status": "SWAP_AUDIT_6_COMPILER_ARTIFACT_FROZEN",
        "contractName": name,
        "source": str(source.relative_to(ROOT)).replace("\\", "/"),
        "sourceBlobSha1": git_blob_sha(source),
        "compiler": compiler,
        "creationBytecodeKeccak256": cast_keccak(creation),
        "deployedBytecodeTemplate": runtime,
        "deployedBytecodeTemplateKeccak256": cast_keccak(runtime),
        "runtimeTemplateBytes": (len(runtime) - 2) // 2,
        "immutableReferences": refs,
        "immutableReferenceCount": sum(len(v) for v in refs.values()) if isinstance(refs, dict) else 0,
        "abi": raw.get("abi", []),
        "abiSha256": sha256_text(json.dumps(raw.get("abi", []), sort_keys=True, separators=(",", ":"))),
        "storageLayout": layout,
    }
    if address:
        record["canonicalAddress"] = address
    return record


def immutable_name_map(refs: dict) -> dict[str, str]:
    # Solidity AST identifiers are allocation-order metadata and can change
    # when Forge compiles a different source graph even when the contract
    # semantics/runtime layout are unchanged. The inherited immutable
    # declaration order is stable and source-authoritative:
    # GenesisResidentAccess420.registry,
    # GenesisResidentAccess420.genesisConfigHash,
    # SystemAccess.governanceTimelock.
    #
    # Fail closed unless the compiler emits exactly three immutable IDs.
    if not isinstance(refs, dict) or len(refs) != 3:
        fail(f"expected exactly three Genesis-resident immutable identifiers, got {sorted(refs) if isinstance(refs, dict) else refs}")
    ids = sorted(refs.keys(), key=lambda value: int(value))
    return {
        ids[0]: "registry",
        ids[1]: "genesisConfigHash",
        ids[2]: "governanceTimelock",
    }

def encode_value(name: str, genesis_hash: str) -> bytes:
    if name == "governanceTimelock":
        return bytes.fromhex("00" * 12 + TIMELOCK[2:])
    if name == "registry":
        return bytes.fromhex("00" * 12 + REGISTRY[2:])
    if name == "genesisConfigHash":
        return bytes.fromhex(genesis_hash[2:])
    fail("unknown immutable variable " + name)


def is_resolved_hash(value: object) -> bool:
    return (
        isinstance(value, str)
        and value.startswith("0x")
        and len(value) == 66
        and all(c in "0123456789abcdefABCDEF" for c in value[2:])
    )


def materialize_runtime(artifact: dict, genesis_hash: str) -> tuple[str, list[dict]]:
    code = bytearray.fromhex(artifact["deployedBytecodeTemplate"][2:])
    refs = artifact.get("immutableReferences", {})
    names = immutable_name_map(refs)
    patched: list[dict] = []
    expected = {"governanceTimelock", "registry", "genesisConfigHash"}
    seen: set[str] = set()
    for immutable_id, locations in refs.items():
        var_name = names.get(str(immutable_id))
        if var_name not in expected:
            fail(f"{artifact['contractName']} unknown immutable id {immutable_id} ({var_name})")
        value = encode_value(var_name, genesis_hash)
        seen.add(var_name)
        for loc in locations:
            start = loc.get("start")
            length = loc.get("length")
            if not isinstance(start, int) or length != 32 or start < 0 or start + 32 > len(code):
                fail(f"{artifact['contractName']} malformed immutable reference")
            code[start:start + 32] = value
            patched.append({
                "immutableId": str(immutable_id),
                "variable": var_name,
                "start": start,
                "length": 32,
                "value": genesis_hash if var_name == "genesisConfigHash" else (TIMELOCK if var_name == "governanceTimelock" else REGISTRY),
            })
    if seen != expected:
        fail(f"{artifact['contractName']} immutable set mismatch: {sorted(seen)}")
    return "0x" + code.hex(), patched


def validate_storage_init(storage_init: dict) -> None:
    if storage_init.get("governance_timelock", "").lower() != TIMELOCK:
        fail("storage-init governance_timelock drift")
    if storage_init.get("protocol_registry", "").lower() != REGISTRY:
        fail("storage-init protocol_registry drift")
    expected = {"constructor": ["governance_timelock", "protocol_registry", "genesis_config_hash"]}
    for name in FROZEN:
        if storage_init.get("entries", {}).get(name) != expected:
            fail(f"storage-init {name} constructor declaration drift")


def build_state(name: str, artifact: dict, address: str, genesis_hash: object) -> dict:
    base = {
        "schema": "420-swap-audit-6-predeploy-state-v1",
        "contractName": name,
        "address": address,
        "source": artifact["source"],
        "sourceBlobSha1": artifact["sourceBlobSha1"],
        "buildArtifact": f"contracts/artifacts/{name}.json",
        "compiler": artifact["compiler"],
        "deployedBytecodeTemplateKeccak256": artifact["deployedBytecodeTemplateKeccak256"],
        "constructorMaterialization": {
            "strategy": "DIRECT_GENESIS_PREDEPLOY_IMMUTABLE_MATERIALIZATION",
            "governanceTimelock": TIMELOCK,
            "protocolRegistry": REGISTRY,
            "genesisConfigHash": genesis_hash,
            "immutableReferences": artifact["immutableReferences"],
        },
        "storage": {},
        "storageSlotCount": 0,
        "storageRoot": EMPTY_STORAGE_ROOT,
        "storageRootBasis": "Ethereum empty Merkle-Patricia storage trie root = keccak256(0x80)",
        "invariants": [
            "genesis alloc.code uses deployed runtime bytecode, never creation bytecode",
            "governanceTimelock, ProtocolRegistry and genesisConfigHash are compiler-declared immutables",
            "constructor performs no mutable storage writes in the qualified Swap predeploy design",
            "runtime code hash is final only after the shared global genesisConfigHash is frozen",
        ],
        "limitations": [
            "This record is offline deterministic predeploy evidence, not live-chain deployment evidence.",
            "SWAP-AUDIT-7/8 remain responsible for deployed code/Registry/binding and production-equivalent testnet evidence.",
        ],
    }
    if not is_resolved_hash(genesis_hash):
        base["status"] = "SWAP_AUDIT_6_BLOCKED_GLOBAL_GENESIS_CONFIG_HASH"
        base["runtimeMaterialized"] = False
        base["blocker"] = "global Genesis authority has not frozen genesis_config_hash; app audit must not invent it"
        return base

    runtime, patched = materialize_runtime(artifact, str(genesis_hash))
    base["status"] = "SWAP_AUDIT_6_FINAL_PREDEPLOY_STATE"
    base["runtimeMaterialized"] = True
    base["runtimeBytecode"] = runtime
    base["runtimeCodeHash"] = cast_keccak(runtime)
    base["runtimeCodeBytes"] = (len(runtime) - 2) // 2
    base["constructorMaterialization"]["materializedReferences"] = patched
    base["constructorMaterialization"]["immutableReferenceCount"] = len(patched)
    return base


def update_plan(plan: dict, states: dict[str, dict], artifacts: dict[str, dict]) -> dict:
    for name, (_, address) in FROZEN.items():
        entries = [x for x in plan.get("predeploys", []) if x.get("name") == name]
        if len(entries) != 1:
            fail(f"predeploy plan must contain exactly one {name}")
        entry = entries[0]
        if entry.get("address", "").lower() != address:
            fail(f"predeploy plan {name} address drift")
        state = states[name]
        artifact = artifacts[name]
        entry["source_blob_sha1"] = artifact["sourceBlobSha1"]
        entry["compiler_runtime_template_keccak256"] = artifact["deployedBytecodeTemplateKeccak256"]
        entry["predeploy_state"] = f"contracts/config/predeploy/{name}-predeploy-state.json"
        if state["runtimeMaterialized"]:
            entry["status"] = "ARTIFACT_READY"
            entry["constructor_strategy"] = "DIRECT_GENESIS_IMMUTABLE_MATERIALIZATION"
            entry["runtime_code_hash"] = state["runtimeCodeHash"]
            entry.pop("blocker", None)
            entry["notes"] = "SWAP-AUDIT-6: deterministic Solidity 0.8.24/Cancun runtime and empty mutable storage materialized from frozen GovernanceTimelock, ProtocolRegistry and canonical global genesisConfigHash. Live deployment verification remains SWAP-AUDIT-7/8."
        else:
            entry["status"] = "COMPILER_ARTIFACT_FROZEN"
            entry["constructor_strategy"] = "DIRECT_GENESIS_IMMUTABLE_MATERIALIZATION_PENDING_GLOBAL_CONFIG_HASH"
            entry.pop("runtime_code_hash", None)
            entry["blocker"] = state["blocker"]
            entry["notes"] = "SWAP-AUDIT-6: compiler artifact/storage layout/immutable references frozen; final runtime hash is intentionally blocked until global Genesis authority freezes genesisConfigHash."
    return plan


def update_deployment(manifest: dict, states: dict[str, dict], artifacts: dict[str, dict]) -> dict:
    for name, (_, address) in FROZEN.items():
        entries = [x for x in manifest.get("contracts", []) if x.get("name") == name]
        if len(entries) != 1:
            fail(f"deployment manifest must contain exactly one {name}")
        entry = entries[0]
        if entry.get("address", "").lower() != address:
            fail(f"deployment manifest {name} address drift")
        entry["runtime_artifact"] = f"contracts/artifacts/{name}.json"
        entry["predeploy_state"] = f"contracts/config/predeploy/{name}-predeploy-state.json"
        entry["source_blob_sha1"] = artifacts[name]["sourceBlobSha1"]
        if states[name]["runtimeMaterialized"]:
            entry["runtime_code_hash"] = states[name]["runtimeCodeHash"]
            entry["artifact_status"] = "SWAP_AUDIT_6_ARTIFACT_READY"
            entry.pop("artifact_blocker", None)
        else:
            entry.pop("runtime_code_hash", None)
            entry["artifact_status"] = "SWAP_AUDIT_6_COMPILER_ARTIFACT_FROZEN_GLOBAL_HASH_PENDING"
            entry["artifact_blocker"] = states[name]["blocker"]
    return manifest


def validate_namespace() -> None:
    ns = json.loads(NAMESPACE_PATH.read_text(encoding="utf-8"))
    fixed = ns.get("fixedAssignments", [])
    for name, (_, address) in FROZEN.items():
        owners = [x for x in fixed if str(x.get("address", "")).lower() == address]
        named = [x for x in fixed if x.get("name") == name]
        if len(owners) != 1 or owners[0].get("name") != name or len(named) != 1:
            fail(f"frozen namespace authority mismatch for {name}")
        if named[0].get("address", "").lower() != address:
            fail(f"frozen namespace address drift for {name}")


def main(argv=None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--print", action="store_true", dest="print_output")
    args = parser.parse_args(argv)
    try:
        compiler = compiler_provenance()
        validate_namespace()
        storage_init = json.loads(STORAGE_INIT_PATH.read_text(encoding="utf-8"))
        validate_storage_init(storage_init)
        genesis_hash = storage_init.get("genesis_config_hash")

        artifacts: dict[str, dict] = {}
        for name, (source, address) in DEPLOYMENT_COMPONENTS.items():
            artifacts[name] = artifact_record(name, source, address, compiler)

        states = {
            name: build_state(name, artifacts[name], address, genesis_hash)
            for name, (_, address) in FROZEN.items()
        }
        plan = update_plan(json.loads(PLAN_PATH.read_text(encoding="utf-8")), states, artifacts)
        deployment = update_deployment(json.loads(DEPLOYMENT_PATH.read_text(encoding="utf-8")), states, artifacts)

        outputs: dict[pathlib.Path, str] = {}
        for name, record in artifacts.items():
            outputs[ARTIFACT_DIR / f"{name}.json"] = canonical_json(record)
        for name, state in states.items():
            outputs[PREDEPLOY_DIR / f"{name}-predeploy-state.json"] = canonical_json(state)
        outputs[PLAN_PATH] = manifest_json(plan)
        outputs[DEPLOYMENT_PATH] = manifest_json(deployment)

        if args.write:
            for path, payload in outputs.items():
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(payload, encoding="utf-8")

        if args.check:
            for path, payload in outputs.items():
                if not path.is_file():
                    fail("missing retained output " + str(path.relative_to(ROOT)))
                if path.read_text(encoding="utf-8") != payload:
                    fail("non-reproducible retained output " + str(path.relative_to(ROOT)))

        if args.print_output:
            for name, state in states.items():
                print(name, state["status"], state.get("runtimeCodeHash", "GLOBAL_HASH_PENDING"))

        all_ready = all(state["runtimeMaterialized"] for state in states.values())
        print("SWAP_AUDIT_6_COMPILER_ARTIFACTS=PASS")
        print("SWAP_AUDIT_6_PREDEPLOY_MATERIALIZATION=" + ("PASS" if all_ready else "BLOCKED_GLOBAL_GENESIS_CONFIG_HASH"))
        return 0
    except (OSError, ValueError, KeyError, subprocess.CalledProcessError, json.JSONDecodeError) as exc:
        print("SWAP-AUDIT-6 generation failed: " + str(exc), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())

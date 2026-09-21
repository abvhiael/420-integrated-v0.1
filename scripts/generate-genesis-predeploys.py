#!/usr/bin/env python3
"""Generate a Genesis predeploy file only from qualified runtime artifacts and storage.

W14.7.2: no output is written until the namespace, EVERY planned artifact,
explicit storage for EVERY placement, and existing allocations have passed.
This cannot prove constructor simulation or on-chain deployment: those are
separate qualification steps. Do not use this script as a release attestation.
"""
import argparse
import hashlib
import importlib.util
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
ADDRESS = re.compile(r"0x[0-9a-fA-F]{40}\Z")
WORD = re.compile(r"0x[0-9a-fA-F]{64}\Z")
HEX = re.compile(r"0x(?:[0-9a-fA-F]{2})+\Z")


def load_namespace_validator():
    filename = ROOT / "scripts/verify-wallet-w14-7-1-namespace.py"
    spec = importlib.util.spec_from_file_location("wallet_namespace_validator", filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def qualify(plan, genesis, storage, artifacts, namespace_errors):
    """Return (genesis copy, manifest records, errors); never mutate inputs."""
    errors = list(namespace_errors)
    if plan.get("status") != "FROZEN_ADDRESS_MAP_ARTIFACTS_READY":
        errors.append("predeploy plan is not frozen with qualified artifacts")
    if not isinstance(genesis.get("alloc"), dict):
        errors.append("genesis.alloc must be an object")
    if not isinstance(storage, dict):
        errors.append("generated storage must be an object")
    if errors:
        return None, [], errors

    # Round-trip through JSON to avoid writing any partial account mutations.
    result = json.loads(json.dumps(genesis))
    alloc = result["alloc"]
    occupied = {key.lower() for key in alloc}
    if len(occupied) != len(alloc):
        errors.append("case-insensitive duplicate genesis allocation address")
    known = set()
    records = []
    entries = plan.get("predeploys", [])
    if not isinstance(entries, list) or not entries:
        errors.append("predeploy plan has no entries")
        return None, [], errors
    for entry in entries:
        name = entry.get("name")
        address = entry.get("address")
        if not isinstance(name, str) or not ADDRESS.fullmatch(str(address)):
            errors.append("invalid predeploy identity/address: %r %r" % (name, address))
            continue
        address = address.lower()
        if address in known:
            errors.append("duplicate predeploy placement: " + address)
        known.add(address)
        if address in occupied:
            errors.append("genesis allocation already occupies " + address)
        # The artifact must contain deployed runtime code, not constructor code.
        path = artifacts / (name + ".json")
        if not path.is_file():
            errors.append("missing compiled runtime artifact: " + name)
            continue
        try:
            artifact = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError) as exc:
            errors.append("invalid compiled artifact %s: %s" % (name, exc))
            continue
        code = artifact.get("deployedBytecode", artifact.get("deployed_bytecode"))
        if isinstance(code, dict):
            code = code.get("object")
        if not isinstance(code, str) or not HEX.fullmatch(code):
            errors.append("invalid/unlinked deployed runtime bytecode: " + name)
            continue
        slots = storage.get(name)
        if not isinstance(slots, dict):
            errors.append("missing explicit storage object: " + name)
            continue
        if not all(isinstance(key, str) and WORD.fullmatch(key) and
                   isinstance(value, str) and WORD.fullmatch(value)
                   for key, value in slots.items()):
            errors.append("invalid storage key/value (must be 32-byte hex): " + name)
            continue
        # An empty storage object is permitted only if an independently
        # qualified simulator explicitly supplied it; existence is not proof.
        if address not in occupied:
            alloc[address] = {"code": code.lower(), "storage": slots}
        records.append({"name": name, "address": address,
                        "runtime_code_sha256": hashlib.sha256(bytes.fromhex(code[2:])).hexdigest(),
                        "runtime_code_bytes": (len(code) - 2) // 2,
                        "storage_slots": len(slots)})
    if set(storage) != {item.get("name") for item in entries}:
        errors.append("storage map must cover exactly the planned contract identities")
    return (None if errors else result), records, errors


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("--genesis", default="execution/genesis/execution-genesis.json")
    parser.add_argument("--artifacts", default="contracts/artifacts")
    parser.add_argument("--storage", default="contracts/config/predeploy/generated-storage.json")
    parser.add_argument("--output", default="execution/genesis/execution-genesis-with-predeploys.json")
    args = parser.parse_args(argv)
    namespace = load_namespace_validator()
    try:
        namespace_errors = namespace.validate(namespace.load(ROOT))
        plan = json.loads((ROOT / "contracts/config/predeploy/predeploy-plan.json").read_text(encoding="utf-8"))
        genesis = json.loads((ROOT / args.genesis).read_text(encoding="utf-8"))
        storage = json.loads((ROOT / args.storage).read_text(encoding="utf-8"))
        output = ROOT / args.output
        artifact_dir = ROOT / args.artifacts
        if output.exists() or (ROOT / "contracts/config/predeploy/generated-manifest.json").exists():
            raise ValueError("output/manifest exists: remove only after reviewing the previous generation")
        candidate, records, errors = qualify(plan, genesis, storage, artifact_dir, namespace_errors)
        if errors:
            print(json.dumps({"pass": False, "phase": "W14.7.2", "errors": errors}, indent=2), file=sys.stderr)
            return 2
        # Only qualified candidates reach the write stage; the manifest hash
        # describes the exact bytes written to the output file.
        data = (json.dumps(candidate, indent=2) + "\n").encode("utf-8")
        manifest = {"schema": "420-genesis-predeploy-manifest-v2",
                    "status": "GENERATED_NOT_DEPLOYMENT_ATTESTED",
                    "genesis_file": str(output.relative_to(ROOT)),
                    "predeploy_count": len(records), "predeploys": records,
                    "genesis_sha256": hashlib.sha256(data).hexdigest(),
                    "storage_simulation_verified": False,
                    "on_chain_code_verified": False}
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(data)
        (ROOT / "contracts/config/predeploy/generated-manifest.json").write_text(
            json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(manifest, indent=2))
        return 0
    except (OSError, KeyError, ValueError, TypeError, json.JSONDecodeError) as exc:
        print("W14.7.2 blocked: %s" % exc, file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())

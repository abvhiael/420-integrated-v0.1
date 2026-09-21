#!/usr/bin/env python3
"""W14.7.3: verify an offline Genesis candidate, never attest deployment.

Synthetic tests exercise verify(); real verification stays blocked until the
W14.7.1 namespace and actual generated artifacts are independently qualified.
"""
import hashlib
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
ADDRESS = re.compile(r"0x[0-9a-fA-F]{40}\Z")
WORD = re.compile(r"0x[0-9a-fA-F]{64}\Z")
BYTECODE = re.compile(r"0x(?:[0-9a-fA-F]{2})+\Z")


def verify(plan, genesis, raw_genesis, manifest, storage):
    """Return errors for a candidate; never change files or report deployment."""
    errors = []
    entries = plan.get("predeploys")
    records = manifest.get("predeploys")
    alloc = genesis.get("alloc")
    if not isinstance(entries, list) or not entries or not isinstance(records, list):
        return ["predeploy plan/manifest records missing"]
    if not isinstance(alloc, dict) or not isinstance(storage, dict):
        return ["genesis allocation or explicit storage map missing"]
    if plan.get("status") != "FROZEN_ADDRESS_MAP_ARTIFACTS_READY":
        errors.append("plan has not qualified frozen addresses and runtime artifacts")
    if manifest.get("schema") != "420-genesis-predeploy-manifest-v2":
        errors.append("unexpected predeploy manifest schema")
    if manifest.get("status") != "GENERATED_NOT_DEPLOYMENT_ATTESTED":
        errors.append("manifest must remain explicitly not deployment-attested")
    if manifest.get("on_chain_code_verified") is not False or manifest.get("storage_simulation_verified") is not False:
        errors.append("generated manifest cannot claim on-chain/storage simulation attestation")
    if manifest.get("genesis_sha256") != hashlib.sha256(raw_genesis).hexdigest():
        errors.append("genesis file SHA-256 differs from manifest")
    if manifest.get("predeploy_count") != len(entries) or len(records) != len(entries):
        errors.append("predeploy manifest count differs from plan")
    planned = {}
    for entry in entries:
        name, address = entry.get("name"), entry.get("address")
        if not isinstance(name, str) or not isinstance(address, str) or not ADDRESS.fullmatch(address):
            errors.append("invalid planned predeploy name/address")
            continue
        if name in planned:
            errors.append("duplicate planned name: " + name)
        planned[name] = address.lower()
    if len(set(planned.values())) != len(planned):
        errors.append("duplicate planned predeploy address")
    if set(storage) != set(planned):
        errors.append("storage names do not exactly match predeploy plan")
    allocations = {}
    for key, value in alloc.items():
        if not isinstance(key, str) or not ADDRESS.fullmatch(key) or not isinstance(value, dict):
            errors.append("invalid genesis allocation address/account")
            continue
        lowered = key.lower()
        if lowered in allocations:
            errors.append("case-insensitive duplicate allocation: " + lowered)
        allocations[lowered] = value
    seen = set()
    for record in records:
        name, address = record.get("name"), record.get("address")
        if not isinstance(name, str) or name not in planned or name in seen:
            errors.append("unknown or duplicate manifest predeploy: %r" % name)
            continue
        seen.add(name)
        if address != planned[name]:
            errors.append("manifest address differs from plan: " + name)
            continue
        account = allocations.get(planned[name])
        if account is None:
            errors.append("genesis predeploy allocation missing: " + name)
            continue
        code, slots = account.get("code"), account.get("storage")
        if not isinstance(code, str) or not BYTECODE.fullmatch(code):
            errors.append("missing/invalid runtime code: " + name)
            continue
        code_bytes = bytes.fromhex(code[2:])
        if record.get("runtime_code_sha256") != hashlib.sha256(code_bytes).hexdigest() or record.get("runtime_code_bytes") != len(code_bytes):
            errors.append("runtime code hash/size mismatch: " + name)
        if not isinstance(slots, dict) or not all(isinstance(k, str) and WORD.fullmatch(k) and isinstance(v, str) and WORD.fullmatch(v) for k, v in slots.items()):
            errors.append("missing or malformed predeploy storage: " + name)
            continue
        if slots != storage.get(name) or record.get("storage_slots") != len(slots):
            errors.append("explicit storage or slot count mismatch: " + name)
    if seen != set(planned):
        errors.append("manifest does not cover every planned predeploy")
    return errors


def main():
    try:
        # The namespace validator must pass on the actual repository first.
        import importlib.util
        filename = ROOT / "scripts/verify-wallet-w14-7-1-namespace.py"
        spec = importlib.util.spec_from_file_location("wallet_namespace", filename)
        namespace = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(namespace)
        errors = namespace.validate(namespace.load(ROOT))
        if errors:
            raise ValueError("unreconciled Genesis namespace: " + "; ".join(errors))
        base = ROOT / "contracts/config/predeploy"
        manifest = json.loads((base / "generated-manifest.json").read_text(encoding="utf-8"))
        filename = manifest.get("genesis_file")
        if not isinstance(filename, str) or not filename:
            raise ValueError("manifest genesis_file missing")
        target = (ROOT / filename).resolve()
        if not target.is_relative_to(ROOT.resolve()) or target != (ROOT / "execution/genesis/execution-genesis-with-predeploys.json").resolve():
            raise ValueError("manifest genesis_file must be the qualified generated Genesis path")
        raw = target.read_bytes()
        errors = verify(
            json.loads((base / "predeploy-plan.json").read_text(encoding="utf-8")),
            json.loads(raw), raw, manifest,
            json.loads((base / "generated-storage.json").read_text(encoding="utf-8")),
        )
    except (OSError, ValueError, TypeError, KeyError, json.JSONDecodeError) as exc:
        errors = [str(exc)]
    print(json.dumps({"phase": "W14.7.3", "pass": not errors,
                      "deployment_attested": False, "errors": errors}, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())

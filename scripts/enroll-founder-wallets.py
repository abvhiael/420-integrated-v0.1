#!/usr/bin/env python3
"""Two-phase founder wallet enrollment; no secrets, minting or fabricated identities.

1. stage public addresses and their mirrored Genesis destinations BEFORE V4 freeze.
2. independently approve/freeze V4 with those exact source Git blobs.
3. attest with each founder's separately obtained signature; cryptographically verify
   before writing proof records or derived deployment bindings.
4. after REAL deployment/claims, record finalized receipts only if chain state proves them.

Usage: python3 scripts/enroll-founder-wallets.py --stage /secure/public-addresses.json
       python3 scripts/enroll-founder-wallets.py --attest /secure/owner-signatures.json
       python3 scripts/enroll-founder-wallets.py --record-claims /secure/claim-receipts.json --rpc-url https://...
All input contains only PUBLIC addresses / personal_sign proofs / public transaction hashes.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import os
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VERIFIER = ROOT / "scripts/verify-founder-wallet-reservations.py"
spec = importlib.util.spec_from_file_location("founder_proof_verifier", VERIFIER)
verify = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verify)

RESERVATIONS = "contracts/config/founder-wallet-reservations.json"
SYSTEM = "contracts/config/system-addresses.json"
MIRROR = "contracts/config/genesis-canonical-addresses.json"
LEDGER = "config/genesis-allocations.json"
INIT = "contracts/config/predeploy/storage-init.json"
POLICY = "contracts/config/treasury/founding-financial-policy-provisional.json"
INTEGRATION = "contracts/config/founding-genesis-integration-v1.json"
COMMIT = "contracts/config/genesis-config-commitment.json"
IDS = ("founder-admin-liquid", "founder-andrew-liquid", "founder-janet-liquid")


def require(ok, reason):
    if not ok:
        raise ValueError(reason)


def load(root, name):
    return verify.load(root, name)


def apply_files(root, changed):
    """Atomic per-file writes with rollback on failure; no signed-source regeneration."""
    originals = {name: (root / name).read_bytes() for name in changed}
    temporary = {}
    try:
        for name, object_data in changed.items():
            file = root / name
            temp = file.with_name(file.name + ".gov-pre-02-staging")
            require(not temp.exists(), "temporary transaction output already exists: " + name)
            temp.write_text(json.dumps(object_data, indent=2, ensure_ascii=False) + "\n",
                            encoding="utf-8")
            temporary[name] = temp
        for name, temp in temporary.items():
            os.replace(temp, root / name)
    except BaseException:
        for name, data in originals.items():
            (root / name).write_bytes(data)
        raise
    finally:
        for temp in temporary.values():
            if temp.exists():
                temp.unlink()


def unique_addresses(root, founders):
    require(isinstance(founders, list) and len(founders) == 3,
            "exactly three independently controlled founder public addresses required")
    names = verify.ROLES
    seen = set()
    assigned = {a["address"].lower() for a in load(root, SYSTEM)["assignments"]}
    result = []
    for index, person in enumerate(founders):
        require(isinstance(person, dict) and person.get("role") == names[index],
                "founder role order/identity mismatch")
        address = person.get("wallet_address")
        require(isinstance(address, str) and verify.ADDRESS.fullmatch(address),
                "invalid public wallet address for " + names[index])
        n = int(address, 16)
        require(n != 0 and n not in range(0x41f, 0x500)
                and n != (2**160 - 2) and address.lower() not in assigned,
                "personal wallet uses reserved system address")
        require(address.lower() not in seen, "duplicate founder wallet address")
        seen.add(address.lower())
        result.append(address)
    return result


def stage(root, proposal):
    """Only the user-supplied real public addresses. No ownership verification asserted."""
    network, chain_id = proposal.get("target_network"), proposal.get("chain_id")
    require(network in ("mainnet", "testnet"), "network must be mainnet or testnet")
    require(type(chain_id) is int and chain_id > 0, "positive chain ID required")
    require(load(root, COMMIT)["status"] != "FROZEN_V4",
            "cannot alter address/Genesis inputs after approved V4 freeze")
    addrs = unique_addresses(root, proposal.get("founders"))
    m, s, c, l = (load(root, p) for p in (RESERVATIONS, SYSTEM, MIRROR, LEDGER))
    require(len(m["founders"]) == 3, "previous founder roster incompatible")
    require(m.get("planned_genesis_hash") is None, "staged addresses already tied to a plan")
    require(m.get("target_network") in (None, network), "different network already staged")
    require(m.get("modeled_chain_id") in (None, chain_id, 420),
            "different chain already staged")
    require(all(x["ownership_status"] == "UNCLAIMED" and
                x["pre_genesis_proof"]["signature"] is None for x in m["founders"]),
            "verified founder identities cannot be overwritten")
    for index, role in enumerate(verify.ROLES):
        member = m["founders"][index]
        require(member["role"] == role, "founder role order changed")
        require(member["wallet_address"] in (None, addrs[index]),
                "changing an existing staged address is not implicit")
        member["wallet_address"] = addrs[index]
        member["ownership_status"] = "UNCLAIMED"
        member["claim_tx"] = member["claim_block_hash"] = None
        method = proposal["founders"][index].get("method", "EIP191_PERSONAL_SIGN")
        require(method in ("EIP191_PERSONAL_SIGN", "EIP1271_CODEBOUND"),
                "unsupported founder wallet signature method")
        member["pre_genesis_proof"]["method"] = method
        if method == "EIP1271_CODEBOUND":
            codehash = proposal["founders"][index].get("expected_runtime_code_hash")
            require(isinstance(codehash, str) and verify.HASH.fullmatch(codehash),
                    "Smart Account requires approved runtime codehash in staging")
            member["pre_genesis_proof"]["expected_runtime_code_hash"] = codehash
        else:
            member["pre_genesis_proof"].pop("expected_runtime_code_hash", None)
        member["pre_genesis_proof"]["signature"] = None
        member["pre_genesis_proof"]["genesis_plan_commitment"] = None
        member["pre_genesis_proof"]["verified_at"] = None
        for config in (s, c):
            slot = config["founder_wallet_slots"][index]
            require(slot["role"] == role and slot["address"] in (None, addrs[index]),
                    "authoritative role mirror unexpectedly differs")
            slot["address"] = addrs[index]
            slot["status"] = "UNCLAIMED"
        item = next(x for x in l["allocations"] if x["id"] == IDS[index])
        require(item["amount_420"] == verify.LIQUID[index] and
                item["destination"] in (None, addrs[index]),
                "founder liquid tranche or destination drift")
        item["destination"] = addrs[index]
        item["status"] = "AWAITING_ADDRESS_SIGNATURE"
    m["target_network"] = network
    m["modeled_chain_id"] = chain_id
    m["planned_genesis_hash"] = None
    m["status"] = "ADDRESSES_STAGED_AWAITING_APPROVED_V4_AND_THREE_SIGNATURES"
    return {RESERVATIONS: m, SYSTEM: s, MIRROR: c, LEDGER: l}


def print_approved_challenges(root):
    """Read-only three-role challenges AFTER V4 freeze and BEFORE any signatures."""
    m = load(root, RESERVATIONS)
    release = load(root, COMMIT)
    require(release.get("status") == "FROZEN_V4",
            "cannot sign or print challenges for unsigned V3/candidate Genesis")
    require(all(f["wallet_address"] for f in m["founders"]),
            "all three public founder wallets must be staged")
    require(m.get("planned_genesis_hash") is None,
            "stage/freeze challenge generation must precede signed enrollment")
    m["planned_genesis_hash"] = release.get("genesisConfigHash")
    verify.verify_v4(root, m)
    unique_addresses(root, [
        {"role": f["role"], "wallet_address": f["wallet_address"]}
        for f in m["founders"]])
    for founder in m["founders"]:
        require(founder["pre_genesis_proof"]["signature"] is None,
                "founding role already has a pre-Genesis signature")
        print("\n=== " + founder["role"] + " ===\n" + verify.challenge(m, founder))
    return len(m["founders"])


def attest(root, proofs, rpc_url=None):
    """Record genuine signatures only after V4 was approved against staged source bytes."""
    m, integration, init, policy = (load(root, p) for p in
                                    (RESERVATIONS, INTEGRATION, INIT, POLICY))
    release = load(root, COMMIT)
    require(release.get("status") == "FROZEN_V4", "approved V4 required before attest")
    proof_hash = release.get("genesisConfigHash")
    require(verify.HASH.fullmatch(str(proof_hash)), "missing approved V4 plan hash")
    require(proofs.get("target_network") == m["target_network"] and
            proofs.get("chain_id") == m["modeled_chain_id"] and
            proofs.get("genesis_plan_commitment", "").lower() == proof_hash.lower(),
            "signature envelope does not match target network/chain/Genesis")
    entries = proofs.get("founders")
    require(isinstance(entries, list) and len(entries) == 3, "three founder proofs required")
    unique_addresses(root, [{"role": x["role"], "wallet_address": x["wallet_address"]}
                            for x in entries])
    require(all(f["ownership_status"] == "UNCLAIMED" and
                f["pre_genesis_proof"]["signature"] is None for f in m["founders"]),
            "signed founder identities cannot be silently replaced or re-attested")
    m["planned_genesis_hash"] = proof_hash
    stamp = datetime.now(timezone.utc).isoformat()
    for index, entry in enumerate(entries):
        member = m["founders"][index]
        require(entry["role"] == member["role"] and
                entry["wallet_address"].lower() == member["wallet_address"].lower(),
                "signature belongs to a different founder/role")
        method = entry.get("method", "EIP191_PERSONAL_SIGN")
        require(method in ("EIP191_PERSONAL_SIGN", "EIP1271_CODEBOUND"),
                "unsupported signer type")
        proof = member["pre_genesis_proof"]
        require(proof["method"] == method, "method changed after founder challenge generation")
        proof["signature"] = entry.get("signature")
        proof["genesis_plan_commitment"] = proof_hash
        if method == "EIP1271_CODEBOUND":
            require(proof.get("expected_runtime_code_hash") ==
                    entry.get("expected_runtime_code_hash"),
                    "EIP-1271 runtime hash differs from signed challenge")
        else:
            require(entry.get("expected_runtime_code_hash") is None,
                    "EOA identity cannot inherit unrelated contract proof")
        proof["verified_at"] = stamp
        member["ownership_status"] = "PREGENESIS_SIGNATURE_VERIFIED"
    if any(e.get("method") == "EIP1271_CODEBOUND" for e in entries):
        confirmed_genesis = integration["genesis"].get("networkGenesisBlockHash")
        require(isinstance(confirmed_genesis, str) and verify.HASH.fullmatch(confirmed_genesis)
                and confirmed_genesis.lower() ==
                str(proofs.get("network_genesis_block_hash", "")).lower(),
                "EIP-1271 must use a separately approved chain block-zero hash")
        m["network_genesis_block_hash"] = confirmed_genesis
    m["status"] = "THREE_PREGENESIS_WALLET_PROOFS_VERIFIED_CLAIMS_PENDING"
    init["founder_beneficiaries"] = [f["wallet_address"] for f in m["founders"]]
    integration["genesis"]["network"] = m["target_network"]
    integration["genesis"]["chainId"] = m["modeled_chain_id"]
    integration["genesis"]["approvedGenesisHash"] = proof_hash
    integration["founderWallets"]["allThreeOwnershipProofsVerified"] = True
    integration["founderWallets"]["allThreeEip191ProofsVerified"] = all(
        f["pre_genesis_proof"]["method"] == "EIP191_PERSONAL_SIGN"
        for f in m["founders"])
    policy["founderWallets"] = {
        "administrator": m["founders"][0]["wallet_address"],
        "andrew": m["founders"][1]["wallet_address"],
        "janet": m["founders"][2]["wallet_address"],
    }
    changed = {RESERVATIONS: m, INTEGRATION: integration, INIT: init, POLICY: policy}
    # Perform complete cryptographic checks over a temporary projected tree before mutating
    # any canonical record. V4 authority inputs are intentionally NEVER written here.
    import tempfile
    import shutil
    with tempfile.TemporaryDirectory(prefix="founder-attest-") as directory:
        tmp = Path(directory)
        for filename in (RESERVATIONS, INTEGRATION, INIT, POLICY,
                         SYSTEM, MIRROR, LEDGER, COMMIT):
            target = tmp / filename
            target.parent.mkdir(parents=True, exist_ok=True)
            if filename in changed:
                target.write_text(json.dumps(changed[filename], indent=2) + "\n")
            else:
                shutil.copy2(root / filename, target)
        for item in release["commitmentPayload"]["authorityInputs"]:
            source = item["path"]
            target = tmp / source
            if not target.exists():
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(root / source, target)
        verify.validate(strict=True, root=tmp, rpc_url=rpc_url)
    return changed


def record_claims(root, receipt_records, rpc_url):
    """Never mark claimed on asserted transaction hashes alone: verify finalized contract state."""
    m = load(root, RESERVATIONS)
    integration = load(root, INTEGRATION)
    require(receipt_records.get("target_network") == m["target_network"] and
            receipt_records.get("chain_id") == m["modeled_chain_id"] and
            receipt_records.get("genesis_plan_commitment", "").lower() ==
            m["planned_genesis_hash"].lower(), "wrong network or plan for claims")
    independently_approved_genesis = integration["genesis"].get("networkGenesisBlockHash")
    require(isinstance(independently_approved_genesis, str) and
            verify.HASH.fullmatch(independently_approved_genesis) and
            independently_approved_genesis.lower() ==
            str(receipt_records.get("network_genesis_block_hash", "")).lower(),
            "claim receipts lack a separately approved canonical network genesis block")
    require(m.get("network_genesis_block_hash") in
            (None, independently_approved_genesis),
            "existing pre-Genesis account proof bound to another chain")
    m["network_genesis_block_hash"] = independently_approved_genesis
    contract = receipt_records.get("claim_contract", {})
    addr = contract.get("address")
    code_hash = contract.get("runtime_code_hash")
    require(isinstance(addr, str) and verify.ADDRESS.fullmatch(addr), "claim contract address needed")
    require(isinstance(code_hash, str) and verify.HASH.fullmatch(code_hash),
            "deployed claim runtime codehash needed")
    require(m["claim_contract"].get("address") in (None, addr),
            "cannot silently replace founder claim deployment")
    m["claim_contract"].update({"address": addr, "runtime_code_hash": code_hash,
                                "deployment": "DEPLOYED_RUNTIME_AND_RECEIPTS_VERIFIED_REGISTRY_PUBLICATION_PENDING"})
    founders = receipt_records.get("founders")
    require(isinstance(founders, list) and len(founders) == 3, "all three receipts needed")
    for i, item in enumerate(founders):
        member = m["founders"][i]
        require(member["role"] == item.get("role") and member["wallet_address"].lower() ==
                str(item.get("wallet_address", "")).lower(),
                "founder receipt role or address mismatch")
        require(member["ownership_status"] == "PREGENESIS_SIGNATURE_VERIFIED",
                "unverified or previously claimed founder")
        member["claim_tx"], member["claim_block_hash"] = item.get("claim_tx"), item.get("claim_block_hash")
        member["ownership_status"] = "CLAIMED_AND_VERIFIED"
    m["status"] = "THREE_FINALIZED_FOUNDING_WALLET_CLAIMS_VERIFIED"
    integration["founderWallets"]["claimRegistryAddress"] = addr
    integration["founderWallets"]["claimRuntimeCodeHash"] = code_hash
    integration["founderWallets"]["allThreeOnChainClaimsVerified"] = True
    import tempfile
    import shutil
    changed = {RESERVATIONS: m, INTEGRATION: integration}
    with tempfile.TemporaryDirectory(prefix="founder-claim-receipts-") as directory:
        tmp = Path(directory)
        for filename in (RESERVATIONS, INTEGRATION, INIT, POLICY,
                         SYSTEM, MIRROR, LEDGER, COMMIT):
            dest = tmp / filename
            dest.parent.mkdir(parents=True, exist_ok=True)
            if filename in changed:
                dest.write_text(json.dumps(changed[filename], indent=2) + "\n")
            else:
                shutil.copy2(root / filename, dest)
        approved = load(root, COMMIT)
        for source in approved["commitmentPayload"]["authorityInputs"]:
            dest = tmp / source["path"]
            if not dest.exists():
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(root / source["path"], dest)
        verify.validate(strict=True, root=tmp, rpc_url=rpc_url, require_claims=True)
    return changed


def main():
    arg = argparse.ArgumentParser()
    group = arg.add_mutually_exclusive_group(required=True)
    group.add_argument("--stage", type=Path, help="public founder addresses/chain proposal")
    group.add_argument("--attest", type=Path, help="three signed owner proofs against approved V4")
    group.add_argument("--record-claims", type=Path, help="finalized claim transactions and runtime")
    group.add_argument("--challenges", action="store_true", help="print approved-V4 challenges (read-only)")
    arg.add_argument("--root", type=Path, default=ROOT)
    arg.add_argument("--rpc-url", help="required for Smart Account EIP-1271 or live claims")
    arg.add_argument("--dry-run", action="store_true", help="validate proposal and print changed paths")
    opts = arg.parse_args()
    try:
        root = opts.root.resolve()
        if opts.challenges:
            print_approved_challenges(root)
            return
        if opts.stage:
            changed = stage(root, json.loads(opts.stage.read_text(encoding="utf-8")))
        elif opts.attest:
            changed = attest(root, json.loads(opts.attest.read_text(encoding="utf-8")), opts.rpc_url)
        else:
            changed = record_claims(
                root, json.loads(opts.record_claims.read_text(encoding="utf-8")), opts.rpc_url)
        if not opts.dry_run:
            apply_files(root, changed)
            verify.validate(strict=bool(opts.attest or opts.record_claims), root=root,
                            rpc_url=opts.rpc_url, require_claims=bool(opts.record_claims))
        else:
            print("DRY RUN — no files changed")
        print(json.dumps({"mode": "stage" if opts.stage else "attest" if opts.attest else "record-claims",
                          "changed_paths": sorted(changed), "committed": not opts.dry_run},
                         indent=2))
    except (KeyError, ValueError, TypeError, AssertionError, OSError) as exc:
        arg.exit(1, f"GOV-PRE-02 ENROLLMENT FAIL-CLOSED: {exc}\n")


if __name__ == "__main__":
    main()

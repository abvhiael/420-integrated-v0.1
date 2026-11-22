#!/usr/bin/env python3
"""Validate three founder wallets without inventing human identity or keys.

Structure mode: read-only, reject inconsistent reservations/mirrors, no claim of ownership.
--require-deployment: require approved V4, exact frozen input blobs and cryptographic
proofs (EOA EIP-191, or deployed code-bound EIP-1271 on the verified target chain).
--require-claims: additionally verify finalized on-chain claim events/state.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import pathlib
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime

ROOT = pathlib.Path(__file__).resolve().parents[1]
ROLES = ("FOUNDING_ADMINISTRATOR", "ANDREW", "JANET")
BPS = (5000, 2500, 2500)
LIQUID = (250000, 125000, 125000)
ADDRESS = re.compile(r"^0x[0-9a-fA-F]{40}$")
HASH = re.compile(r"^0x[0-9a-fA-F]{64}$")
SIG_EOA = re.compile(r"^0x[0-9a-fA-F]{130}$")
SIG_BYTES = re.compile(r"^0x(?:[0-9a-fA-F]{2})+$")
AUTHORITY_INPUTS = (
    "contracts/config/system-addresses.json",
    "config/genesis-allocations.json",
)


def need(condition, message):
    if not condition:
        raise ValueError(message)


def load(root, path):
    return json.loads((root / path).read_text(encoding="utf-8"))


def sha1_blob(content):
    return hashlib.sha1(b"blob " + str(len(content)).encode("ascii") + b"\0" + content).hexdigest()


def challenge(m, founder):
    """Canonical exact UTF-8 personal_sign message, not a spend authorization."""
    proof = founder["pre_genesis_proof"]
    words = [
        "420Integrated Founder Wallet Reservation v1",
        f"Network: {m['target_network']}",
        f"Chain ID: {m['modeled_chain_id']}",
        f"Genesis commitment: {m['planned_genesis_hash'].lower()}",
        f"Founder role: {founder['role']}",
        f"Wallet: {founder['wallet_address'].lower()}",
        "Purpose: prove personal control for a named founding role; not a transaction or token approval",
    ]
    if proof["method"] == "EIP1271_CODEBOUND":
        words.extend((
            "Wallet signature scheme: EIP1271_CODEBOUND",
            f"Expected runtime code hash: {proof['expected_runtime_code_hash'].lower()}",
        ))
    return "\n".join(words)


class RPC:
    """No key material enters RPC; calls are read-only and tied to a pinned genesis."""
    def __init__(self, url):
        need(isinstance(url, str) and url.startswith(("https://", "http://")),
             "EIP-1271/on-chain claims require an explicit HTTPS/HTTP RPC URL")
        self.url = url

    def call(self, method, params):
        data = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method,
                           "params": params}).encode("utf-8")
        request = urllib.request.Request(self.url, data=data, headers={
            "Content-Type": "application/json"}, method="POST")
        try:
            with urllib.request.urlopen(request, timeout=15) as reply:
                result = json.load(reply)
        except (OSError, ValueError) as exc:
            raise ValueError(f"RPC {method} unavailable: {exc}") from exc
        need(isinstance(result, dict) and "result" in result and "error" not in result,
             f"RPC {method} returned an error")
        return result["result"]


def verified_rpc(rpc, m):
    need(rpc is not None, "EIP-1271 and claims need an independent RPC source")
    need(HASH.fullmatch(str(m.get("network_genesis_block_hash"))),
         "approved target-network block-zero hash required for RPC verification")
    need(int(rpc.call("eth_chainId", []), 16) == m["modeled_chain_id"],
         "RPC chain ID mismatches signed network")
    origin = rpc.call("eth_getBlockByNumber", ["0x0", False])
    need(isinstance(origin, dict) and
         str(origin.get("hash", "")).lower() == m["network_genesis_block_hash"].lower(),
         "RPC genesis block is not the independently approved chain")
    return rpc


def eip191_digest(message):
    from eth_utils import keccak
    raw = message.encode("utf-8")
    return keccak(b"\x19Ethereum Signed Message:\n" + str(len(raw)).encode("ascii") + raw)


def encode_1271(digest, signature):
    """isValidSignature(bytes32,bytes) selector + standard Solidity ABI payload."""
    raw = bytes.fromhex(signature[2:])
    suffix = raw.hex() + "0" * ((64 - (len(raw.hex()) % 64)) % 64)
    return ("0x1626ba7e" + digest.hex() + (64).to_bytes(32, "big").hex()
            + len(raw).to_bytes(32, "big").hex() + suffix)


def verify_signature(m, founder, rpc=None):
    signature = founder["pre_genesis_proof"]["signature"]
    method = founder["pre_genesis_proof"]["method"]
    message = challenge(m, founder)
    if method == "EIP191_PERSONAL_SIGN":
        need(isinstance(signature, str) and SIG_EOA.fullmatch(signature),
             f"missing/malformed EIP-191 proof for {founder['role']}")
        from eth_account import Account
        from eth_account.messages import encode_defunct
        try:
            signer = Account.recover_message(
                encode_defunct(text=message), signature=signature)
        except (ValueError, TypeError, IndexError) as exc:
            raise ValueError(f"invalid EIP-191 signature for {founder['role']}") from exc
        need(signer.lower() == founder["wallet_address"].lower(),
             f"EIP-191 signer does not control {founder['role']} wallet")
    elif method == "EIP1271_CODEBOUND":
        need(isinstance(signature, str) and SIG_BYTES.fullmatch(signature),
             f"missing/malformed EIP-1271 proof for {founder['role']}")
        code_hash = founder["pre_genesis_proof"].get("expected_runtime_code_hash")
        need(isinstance(code_hash, str) and HASH.fullmatch(code_hash)
             and int(code_hash, 16) != 0,
             "EIP-1271 requires independently approved runtime code hash")
        verified_rpc(rpc, m)
        code = rpc.call("eth_getCode", [founder["wallet_address"], "finalized"])
        need(isinstance(code, str) and code.startswith("0x") and len(code) > 2,
             "EIP-1271 account has no finalized deployed code")
        from eth_utils import keccak
        actual_hash = "0x" + keccak(bytes.fromhex(code[2:])).hex()
        need(actual_hash.lower() == code_hash.lower(),
             "EIP-1271 account runtime differs from approved code hash")
        result = rpc.call("eth_call", [{"to": founder["wallet_address"],
                   "data": encode_1271(eip191_digest(message), signature)}, "finalized"])
        need(isinstance(result, str) and result.lower().startswith("0x1626ba7e"),
             "EIP-1271 contract rejected the founder proof")
    else:
        raise ValueError("unsupported founder signature method (no fabricated EOA fallback)")


def verify_v4(root, m):
    release = load(root, "contracts/config/genesis-config-commitment.json")
    need(release.get("status") == "FROZEN_V4", "founder enrollment requires an approved V4 Genesis commitment")
    h = release.get("genesisConfigHash")
    need(isinstance(h, str) and HASH.fullmatch(h) and int(h, 16) != 0,
         "invalid approved Genesis V4 plan hash")
    from eth_utils import keccak
    payload = release["commitmentPayload"]
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    need("0x" + keccak(text=canonical).hex() == h.lower(),
         "Genesis V4 configuration hash is not derived from canonical approved payload")
    need(m["planned_genesis_hash"].lower() == h.lower(),
         "founder proof does not bind the approved Genesis plan")
    inputs = release["commitmentPayload"]["authorityInputs"]
    matching = {x["path"]: x["gitBlobSha1"] for x in inputs}
    need(len(matching) == len(inputs), "duplicated signed Genesis authority-input path")
    for name in AUTHORITY_INPUTS:
        need(name in matching, "V4 commitment does not bind " + name)
    for name, value in matching.items():
        need(re.fullmatch(r"[0-9a-f]{40}", value) is not None, "invalid Git blob hash in V4")
        need(sha1_blob((root / name).read_bytes()) == value,
             "Genesis V4 authority-input bytes changed after founder approval: " + name)


def verify_claims(m, rpc):
    from eth_utils import keccak
    verified_rpc(rpc, m)
    record = m["claim_contract"]
    address = record.get("address")
    code_hash = record.get("runtime_code_hash")
    need(isinstance(address, str) and ADDRESS.fullmatch(address), "claim contract not deployed")
    need(isinstance(code_hash, str) and HASH.fullmatch(code_hash), "claim contract runtime not pinned")
    code = rpc.call("eth_getCode", [address, "finalized"])
    need(isinstance(code, str) and code.startswith("0x") and len(code) > 2,
         "claim contract not in finalized code state")
    need("0x" + keccak(bytes.fromhex(code[2:])).hex() == code_hash.lower(),
         "claim contract runtime code hash mismatch")
    def read(signature, param=""):
        selector = keccak(text=signature)[:4].hex()
        data = rpc.call("eth_call", [{"to": address, "data": "0x" + selector + param}, "finalized"])
        need(isinstance(data, str) and data.startswith("0x") and len(data) >= 66,
             "invalid claim state RPC response for " + signature)
        return int(data[2:66], 16)
    need(read("genesisPlanCommitment()") == int(m["planned_genesis_hash"], 16),
         "on-chain founder claim plan is different")
    need(read("deploymentChainId()") == m["modeled_chain_id"],
         "on-chain founder claim deployment chain differs")
    for index, field in enumerate(("administrator()", "andrew()", "janet()")):
        wallet = m["founders"][index]["wallet_address"]
        need(read(field) == int(wallet, 16), "on-chain immutable founder address mismatch")
        need(read("claimed(address)", wallet[2:].lower().rjust(64, "0")) == 1,
             "founder claim missing on chain: " + field)
    need(read("claimedCount()") == 3 and read("allFoundersClaimed()") == 1,
         "not all three founder claims finalized")
    final = rpc.call("eth_getBlockByNumber", ["finalized", False])
    need(isinstance(final, dict) and "number" in final,
         "RPC finalized block cannot be authenticated")
    topic = "0x" + keccak(text="FounderWalletClaimed(uint8,address,bytes32)").hex()
    for index, founder in enumerate(m["founders"]):
        tx = founder.get("claim_tx")
        bh = founder.get("claim_block_hash")
        need(isinstance(tx, str) and HASH.fullmatch(tx), "missing claim transaction hash")
        need(isinstance(bh, str) and HASH.fullmatch(bh), "missing claim block hash")
        receipt = rpc.call("eth_getTransactionReceipt", [tx])
        need(isinstance(receipt, dict) and receipt.get("status") == "0x1" and
             receipt.get("blockHash", "").lower() == bh.lower() and
             int(receipt["blockNumber"], 16) <= int(final["number"], 16),
             "claim transaction failed, was reorged or is not finalized")
        canonical = rpc.call("eth_getBlockByNumber", [receipt["blockNumber"], False])
        need(isinstance(canonical, dict) and canonical.get("hash", "").lower() == bh.lower(),
             "claim transaction is not on the canonical finalized chain")
        found = [event for event in receipt.get("logs", [])
                 if event.get("address", "").lower() == address.lower()
                 and len(event.get("topics", [])) == 4
                 and event["topics"][0].lower() == topic
                 and int(event["topics"][1], 16) == index + 1
                 and int(event["topics"][2], 16) == int(founder["wallet_address"], 16)
                 and event["topics"][3].lower() == m["planned_genesis_hash"].lower()]
        need(len(found) == 1, "missing or duplicated FounderWalletClaimed event")
        need(founder["ownership_status"] == "CLAIMED_AND_VERIFIED",
             "on-chain founder claim not confirmed in reservation record")


def validate(strict=False, print_challenges=False, root=ROOT, rpc_url=None, require_claims=False):
    root = pathlib.Path(root)
    m = load(root, "contracts/config/founder-wallet-reservations.json")
    a = load(root, "contracts/config/system-addresses.json")
    d = load(root, "contracts/config/genesis-canonical-addresses.json")
    ledger = load(root, "config/genesis-allocations.json")
    need(m.get("schema") == "420-founder-wallet-reservations-v1", "founder reservations schema drift")
    need(a.get("founder_wallet_reservations") == "contracts/config/founder-wallet-reservations.json"
         and d.get("founder_wallet_reservations") == "contracts/config/founder-wallet-reservations.json",
         "authority mirrors do not reference the same founder reservation file")
    need(len(m["founders"]) == 3, "exactly three founder identities are mandatory")
    need(len(a["founder_wallet_slots"]) == 3 and len(d["founder_wallet_slots"]) == 3,
         "three-slot founder address mirrors required")
    assigned = {x["address"].lower() for x in a["assignments"]}
    seen = set()
    rpc = RPC(rpc_url) if rpc_url else None
    if strict or require_claims:
        need(m.get("target_network") in ("testnet", "mainnet"), "target network not approved")
        need(type(m.get("modeled_chain_id")) is int and m["modeled_chain_id"] > 0,
             "invalid chain ID")
        need(isinstance(m.get("planned_genesis_hash"), str) and
             HASH.fullmatch(m["planned_genesis_hash"]),
             "approved chain/genesis commitment missing")
        verify_v4(root, m)
    for i, member in enumerate(m["founders"]):
        role = ROLES[i]
        need(member.get("role") == role, "founder role order changed")
        need(member.get("developer_compensation_bps") == BPS[i], "founder compensation drift")
        expected = ledger["allocations"]
        alloc = next(x for x in expected if x["id"] ==
                     ("founder-admin-liquid", "founder-andrew-liquid", "founder-janet-liquid")[i])
        need(alloc["amount_420"] == LIQUID[i] and alloc["founder_role"] == role,
             "founder liquid allocation drift")
        for catalog in (a, d):
            slot = catalog["founder_wallet_slots"][i]
            need(slot["role"] == role and slot["compensation_bps"] == BPS[i],
                 "founder authoritative slot roles/shares drift")
            need(slot["address"] == member["wallet_address"], "founder address mirror mismatch")
            need(slot["status"] == "UNCLAIMED",
                 "frozen address mirror cannot represent post-Genesis claims")
        wallet = member["wallet_address"]
        if wallet is None:
            need(member["ownership_status"] == "UNCLAIMED" and
                 member["claim_tx"] is None and member["claim_block_hash"] is None and
                 member["pre_genesis_proof"]["signature"] is None,
                 "empty wallet has forged ownership evidence")
            need(alloc["destination"] is None, "unverified wallet destination set in Genesis ledger")
            if strict or require_claims:
                raise ValueError(role + " founder wallet not supplied")
            continue
        need(isinstance(wallet, str) and ADDRESS.fullmatch(wallet), "malformed founder address")
        key = wallet.lower()
        need(int(key, 16) not in range(0x41f, 0x500) and
             key not in ("0x" + "0"*40, "0x" + "f"*38 + "fe"),
             "founder wallet occupies restricted system namespace")
        need(key not in assigned and key not in seen, "duplicate/system founder address")
        seen.add(key)
        need(alloc["destination"] == wallet, "Genesis liquid amount not assigned to same founder address")
        proof = member["pre_genesis_proof"]
        need(proof["method"] in ("EIP191_PERSONAL_SIGN", "EIP1271_CODEBOUND"),
             "unsupported wallet signature scheme")
        if strict or require_claims:
            need(proof["genesis_plan_commitment"] and
                 proof["genesis_plan_commitment"].lower() == m["planned_genesis_hash"].lower(),
                 "founder proof is not bound to exact approved plan")
            need(member["ownership_status"] in
                 ("PREGENESIS_SIGNATURE_VERIFIED", "CLAIMED_AND_VERIFIED"),
                 "founder has no independently verified proof")
            stamp = proof.get("verified_at")
            need(isinstance(stamp, str) and
                 datetime.fromisoformat(stamp.replace("Z", "+00:00")).utcoffset() is not None,
                 "missing timestamp of verified founder proof")
            verify_signature(m, member, rpc)
        elif member["ownership_status"] != "UNCLAIMED":
            # A verified label without verifying the signature is never a structure-only pass.
            need(proof.get("signature") is not None, "verified status without cryptographic evidence")
        if print_challenges:
            need(m.get("target_network") and m.get("planned_genesis_hash"),
                 "cannot print a binding challenge before approved plan is selected")
            print("\n=== " + role + " ===\n" + challenge(m, member))
    if strict or require_claims:
        need(len(seen) == 3, "all three independent founder wallets required")
        init = load(root, "contracts/config/predeploy/storage-init.json")
        need(init["founder_beneficiaries"] ==
             [f["wallet_address"] for f in m["founders"]],
             "founder vesting storage beneficiaries not bound to signed identities")
        integration = load(root, "contracts/config/founding-genesis-integration-v1.json")
        genesis = integration["genesis"]
        if m.get("network_genesis_block_hash") is not None:
            need(genesis.get("networkGenesisBlockHash") and
                 genesis["networkGenesisBlockHash"].lower() ==
                 m["network_genesis_block_hash"].lower(),
                 "founder proof does not match separately approved chain block-zero hash")
        binding = integration["founderWallets"]
        need(binding.get("claimRegistryAddress") == m["claim_contract"].get("address") and
             binding.get("claimRuntimeCodeHash") == m["claim_contract"].get("runtime_code_hash"),
             "founder claim contract address/runtime binding disagreement")
        genesis = integration["genesis"]
        need(genesis["network"] == m["target_network"] and
             genesis["chainId"] == m["modeled_chain_id"] and
             genesis["approvedGenesisHash"].lower() == m["planned_genesis_hash"].lower(),
             "signed founder wallets not bound to founding Genesis integration")
        need(integration["founderWallets"].get("allThreeOwnershipProofsVerified") is True,
             "founder release wiring does not record independently verified proofs")
    if require_claims:
        verify_claims(m, rpc)
    return len(seen)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=pathlib.Path, default=ROOT,
                        help="repository fixture root (for offline qualification)")
    parser.add_argument("--require-deployment", action="store_true")
    parser.add_argument("--require-claims", action="store_true")
    parser.add_argument("--print-challenges", action="store_true")
    parser.add_argument("--rpc-url", help="real target-chain RPC for EIP-1271 or finalized claims")
    opts = parser.parse_args()
    try:
        n = validate(opts.require_deployment, opts.print_challenges,
                     opts.root, opts.rpc_url, opts.require_claims)
    except (AssertionError, KeyError, ValueError, TypeError, ImportError,
            OSError, AttributeError) as exc:
        print("founder wallet reservation: FAIL-CLOSED: " + str(exc), file=sys.stderr)
        raise SystemExit(1)
    print(f"founder wallet reservation structure valid; {n}/3 public addresses; " +
          ("finalized on-chain claims verified" if opts.require_claims else
           "pre-Genesis signature proofs verified for approved V4" if opts.require_deployment else
           "unverified reservation structure ONLY"))

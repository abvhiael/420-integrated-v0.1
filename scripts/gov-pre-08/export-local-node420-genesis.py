#!/usr/bin/env python3
"""GOV-PRE-08: export the actual local funded Anvil account trie as a Geth Genesis candidate.

The Anvil dump is gzip-compressed JSON containing accounts, bytecode and all
nonzero storage. Preserve the real constructor state; never manufacture slots.
Input is a verified *unowned chain-31337 fixture*; output is an isolated
chain-420 test harness only, not a production V4 distribution or approval.
"""
from __future__ import annotations
import argparse
import gzip
import hashlib
import json
import re
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parents[2]
WEI = 10 ** 18
ADDRESS = re.compile(r"0x[0-9a-fA-F]{40}\Z")
# Fork system accounts belong to the target Genesis, never the staging chain.
STAGING_FORK_ACCOUNTS = {
    "0x0000f90827f1c53a10cb7a02335b175320002935",  # block history
    "0x000f3df6d732807ef1319fb7b8bb8522d0beac02",  # beacon roots
    "0x00000961ef480eb55e80d19ad83579a64c007002",  # withdrawal requests
    "0x0000bbddc7ce488642fb579f8b00f3a590007251",  # consolidation requests
}
HEX = re.compile(r"0x(?:[0-9a-fA-F]{2})*\Z")
REQUIRED_ANCHORS = {
    "ProtocolRegistry": "0x0000000000000000000000000000000000000434",
    "GovernanceTimelock": "0x0000000000000000000000000000000000000429",
    "ValidatorRegistry": "0x0000000000000000000000000000000000000423",
    "CommunityValidatorReserve": "0x0000000000000000000000000000000000000425",
}

def require(ok: bool, why: str) -> None:
    if not ok: raise ValueError("GOV-PRE-08 actual-trie Geth export: " + why)

def normalize_quantity(raw) -> str:
    require(isinstance(raw, (str, int)), "invalid account quantity")
    n = int(raw, 16) if isinstance(raw, str) and raw.startswith("0x") else int(raw)
    require(n >= 0, "negative account quantity")
    return hex(n)

def normalize_storage(raw) -> dict:
    require(isinstance(raw, dict), "storage is not a key/value map")
    slots = {}
    for key, value in raw.items():
        require(isinstance(key, str) and re.fullmatch(r"0x[0-9a-fA-F]{1,64}", key),
                "invalid state slot")
        require(isinstance(value, str) and re.fullmatch(r"0x[0-9a-fA-F]{1,64}", value),
                "invalid state word")
        k = "0x" + f"{int(key,16):064x}"
        v = "0x" + f"{int(value,16):064x}"
        require(k not in slots, "duplicate normalized slot " + k)
        if int(v, 16): slots[k] = v
    return dict(sorted(slots.items()))

def convert(snapshot: dict, graph: dict, base_genesis: dict, source_head: str):
    require(snapshot.get("schema") == "GOV_PRE_08_STEP3_ANVIL_LOCAL_RESTART_SNAPSHOT_V1"
            and snapshot.get("chainId") == 31337
            and snapshot.get("sourceGitHead") == source_head
            and snapshot.get("productionRelease") is False,
            "wrong snapshot source/network/release flag")
    compressed = bytes.fromhex(snapshot["snapshotHex"].removeprefix("0x"))
    require(hashlib.sha256(compressed).hexdigest() == snapshot["snapshotSha256"],
            "Anvil snapshot integrity mismatch")
    raw = gzip.decompress(compressed)
    require(len(raw) < 50_000_000, "unreasonable uncompressed local trie")
    state = json.loads(raw)
    require(isinstance(state.get("accounts"), dict) and state["accounts"],
            "missing actual Anvil account trie")
    require(graph.get("sourceGitHead") == source_head
            and graph.get("chainId") == 31337
            and graph.get("approvedV4") is False
            and graph.get("authenticFounderOwnersVerified") is False,
            "nonlocal/approved/fake founder graph cannot be exported")
    original = {addr.lower(): account for addr, account in base_genesis["alloc"].items()}
    alloc = {}
    for address, record in state["accounts"].items():
        require(isinstance(address, str) and ADDRESS.fullmatch(address),
                "invalid Anvil account address")
        addr = address.lower()
        require(addr not in alloc, "duplicate account on case normalization")
        require(isinstance(record, dict), "invalid Anvil account")
        code = record.get("code", "0x")
        require(isinstance(code, str) and HEX.fullmatch(code),
                "malformed account bytecode")
        balance = normalize_quantity(record.get("balance", "0x0"))
        nonce = normalize_quantity(record.get("nonce", "0x0"))
        if addr in STAGING_FORK_ACCOUNTS:
            require(int(balance, 16) == 0 and int(nonce, 16) <= 1,
                    "staging fork account unexpectedly holds funds or a transaction nonce")
            continue
        entry = {"balance": balance, "nonce": nonce}
        if code != "0x": entry["code"] = code.lower()
        storage = normalize_storage(record.get("storage", {}))
        if storage: entry["storage"] = storage
        if addr not in original and balance == nonce == "0x0" and code == "0x" and not storage:
            continue
        alloc[addr] = entry

    for name, addr in REQUIRED_ANCHORS.items():
        require(addr in alloc and len(alloc[addr].get("code", "")) > 4,
                "actual canonical anchor has no runtime: " + name)
    components = graph["actualProductionConstructorAddresses"]
    require(len(components) == 14 and len(set(map(str.lower, components.values()))) == 14,
            "missing unique 14 production constructor runtime addresses")
    for name, address in components.items():
        require(address.lower() in alloc and len(alloc[address.lower()].get("code", "")) > 4,
                "missing deployed constructor runtime: " + name)
    for name, address in graph["walletCivicModuleAddresses"].items():
        require(address.lower() in alloc and len(alloc[address.lower()].get("code", "")) > 4,
                "missing deployed Civic runtime: " + name)
    for address in STAGING_FORK_ACCOUNTS & original.keys():
        alloc[address] = original[address]
    # All original fixed native allocations must remain represented, even if
    # spent into on-chain Vault balances by the qualified native funding path.
    for name in original:
        require(name.lower() in alloc, "missing original account " + name)
    total = sum(int(v["balance"], 16) for v in alloc.values())
    require(total == 42_000_000 * WEI,
            "actual account trie is not the conserved 42m Genesis supply")
    require(base_genesis["config"]["chainId"] == 420, "not a canonical chain-420 base")
    genesis = json.loads(json.dumps(base_genesis))
    genesis["alloc"] = dict(sorted(alloc.items()))
    # All accounts are real local EVM state. Their block-31337 transaction
    # history is deliberately NOT copied; these constitute a new block zero.
    evidence = {
        "schema": "GOV_PRE_08_LOCAL_ONLY_ACTUAL_TRIE_NODE420_GENESIS_V1",
        "sourceGitHead": source_head, "sourceChainId": 31337,
        "targetLocalChainId": 420, "approvedV4": False,
        "authenticFounderOwnersVerified": False, "testnetLaunchAuthorized": False,
        "accountCount": len(alloc), "deployedProductionConstructors": len(components),
        "totalNativeWei": str(total),
        "sourceSnapshotSha256": snapshot["snapshotSha256"],
        "gethGenesisSha256": hashlib.sha256(
            json.dumps(genesis, sort_keys=True, separators=(",", ":")).encode()).hexdigest(),
        "warning": "Unowned 31337 fixture imported into disposable chain 420. No real owner proof or production network authority."
    }
    return genesis, evidence

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--snapshot", type=Path, required=True)
    p.add_argument("--graph", type=Path, required=True)
    p.add_argument("--genesis", type=Path, required=True)
    p.add_argument("--evidence", type=Path, required=True)
    a = p.parse_args()
    require(not a.genesis.exists() and not a.evidence.exists(), "refuse evidence overwrite")
    head = subprocess.check_output(["git", "rev-parse", "HEAD"],
                                   cwd=HERE, text=True).strip()
    genesis, evidence = convert(
        json.loads(a.snapshot.read_text()), json.loads(a.graph.read_text()),
        json.loads((HERE/"execution/genesis/execution-genesis.json").read_text()), head)
    a.genesis.write_text(json.dumps(genesis, sort_keys=True, indent=2)+"\n")
    a.evidence.write_text(json.dumps(evidence, sort_keys=True, indent=2)+"\n")
    print("GOV_PRE_08_ACTUAL_FUNDED_V4_LOCAL_TRIE_EXPORTED_TO_NODE420=PASS",
          evidence["accountCount"], evidence["gethGenesisSha256"])

if __name__ == "__main__":
    main()

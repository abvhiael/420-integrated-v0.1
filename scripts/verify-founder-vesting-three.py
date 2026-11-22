#!/usr/bin/env python3
"""Three-founder $420 Genesis allocation and exact funding consistency check.

Default: verify proposal structure and unchanged 42m supply.
--require-release: validate actual independently verified payee addresses and
a new frozen Genesis commitment, otherwise fail closed. Does not substitute
for a complete signed Genesis runtime/storage materialization or external audit.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import sys
import subprocess
import os
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
LEDGER = ROOT / "config/genesis-allocations.json"
WALLETS = ROOT / "contracts/config/founder-wallet-reservations.json"
INIT = ROOT / "contracts/config/predeploy/storage-init.json"
COMMITMENT = ROOT / "contracts/config/genesis-config-commitment.json"
SYSTEM = ROOT / "contracts/config/system-addresses.json"
VEST = ROOT / "contracts/src/system/FounderVestingRegistry.sol"
ROLES = ("FOUNDING_ADMINISTRATOR", "ANDREW", "JANET")
WEIGHTS = (5000, 2500, 2500)
LIQUID = (250000, 125000, 125000)
LOCKED = (250000, 125000, 125000)
PREDEPLOY = "0x0000000000000000000000000000000000000427"
ETH = 10**18
ADDR = re.compile(r"^0x[0-9a-fA-F]{40}$")
H256 = re.compile(r"^0x[0-9a-fA-F]{64}$")


def require(ok, why):
    if not ok:
        raise ValueError(why)



def require_live_genesis_balances(founders, integration):
    """Independently check the *actual block-zero native state*, not release flags.

    Frozen V4 alone is insufficient: an unfunded 0x0427 or missing liquid wallet
    allocations must fail even if a signed manifest claims successful funding.
    """
    uri=os.environ.get("FOUNDER_GENESIS_RPC_URL")
    require(bool(uri), "FOUNDER_GENESIS_RPC_URL required for real Genesis vesting/liquid funding evidence")
    ident=0
    def rpc(method, params):
        nonlocal ident
        ident += 1
        request=urllib.request.Request(uri,
            json.dumps({"jsonrpc":"2.0","id":ident,"method":method,"params":params}).encode(),
            {"Content-Type":"application/json"})
        with urllib.request.urlopen(request,timeout=15) as response:
            data=json.load(response)
        require(data.get("id")==ident and data.get("error") is None and "result" in data,
                "invalid authenticated Genesis RPC response: "+method)
        return data["result"]

    chain=int(rpc("eth_chainId",[]),16)
    require(chain==420 and integration["genesis"]["chainId"]==chain,
            "founder Genesis funding checked on wrong chain")
    genesis=rpc("eth_getBlockByNumber",["0x0",False])
    expected=integration["genesis"]["networkGenesisBlockHash"]
    require(expected is not None and H256.fullmatch(expected) and genesis
        and genesis.get("hash","").lower()==expected.lower(),
        "founder Genesis block hash not independently authenticated")
    block={"blockHash":expected,"requireCanonical":True}
    require(rpc("eth_getCode",[PREDEPLOY,block]) not in ("0x","0x0"),
            "founder vesting contract not materialized at 0x0427")
    require(int(rpc("eth_getBalance",[PREDEPLOY,block]),16)==500000*ETH,
            "actual locked FounderVestingRegistry block-zero native balance not 500k")
    for i, founder in enumerate(founders):
        bal=int(rpc("eth_getBalance",[founder["wallet_address"],block]),16)
        require(bal==LIQUID[i]*ETH,
            "founder wallet block-zero liquid balance disagrees with signed Genesis ledger: "+ROLES[i])
    return expected


def verify(release):
    subprocess.run([sys.executable, str(ROOT / "scripts/verify-genesis-supply-reconciliation.py")],
                   check=True, stdout=subprocess.DEVNULL)
    ledger = json.loads(LEDGER.read_text())
    wallets = json.loads(WALLETS.read_text())
    init = json.loads(INIT.read_text())
    committed = json.loads(COMMITMENT.read_text())
    system = json.loads(SYSTEM.read_text())
    source = VEST.read_text()

    require(ledger["schema"] == "420-integrated-genesis-allocations-v1", "ledger schema drift")
    require(ledger["genesis_supply_420"] == 42000000, "unexpected modeled genesis supply")
    require(sum(int(a["amount_420"]) for a in ledger["allocations"]) == 42000000,
            "Genesis token count is not conserved")
    require(sum(int(a["amount_kief"]) for a in ledger["allocations"]) == int(ledger["genesis_supply_kief"]),
            "Genesis wei total is not conserved")
    for alloc in ledger["allocations"]:
        require(int(alloc["amount_kief"]) == int(alloc["amount_420"]) * ETH,
                "token/wei mismatch in " + alloc["id"])

    entries = {x["id"]: x for x in ledger["allocations"]}
    vest = entries["founder-vesting"]
    require(vest["amount_420"] == 500000 and vest["destination"].lower() == PREDEPLOY,
            "existing fixed vesting predeploy must receive exactly 500k")
    require(vest["founder_roles"] == list(ROLES), "vesting order changed")
    require(len([x for x in ledger["allocations"] if x["id"] == "founder-vesting"]) == 1,
            "duplicate founder vesting source")
    founders = wallets["founders"]
    require(len(founders) == 3, "must contain exactly three founder payees")
    require(wallets["genesis_founder_allocation"]["total_420"] == 1000000,
            "Founders allocation changed")
    require(wallets["genesis_founder_allocation"]["liquid_420"] == 500000
            and wallets["genesis_founder_allocation"]["locked_420"] == 500000,
            "locked/liquid total changed")
    require(init["entries"]["FounderVestingRegistry"]["constructor"][1] == "founder_beneficiaries[3]",
            "ten-founder Genesis storage input still present")
    require(init["founder_beneficiary_roles"] == list(ROLES), "Genesis roles mismatched")
    require("FOUNDER_COUNT = 3" in source and "TOTAL_LOCKED_ALLOCATION = 500_000 ether" in source
            and "TOTAL_LIQUID_ALLOCATION = 500_000 ether" in source
            and "RELEASES = 13" in source and "INTERVAL = 14 days" in source,
            "vesting source invariant changed")
    require(sum(LIQUID) == sum(LOCKED) == 500000, "incorrect split")
    system_wallets = {x["address"].lower() for x in system["assignments"]}
    found = set()

    for i, role in enumerate(ROLES):
        x = founders[i]
        require(x["role"] == role and x["genesis_founder_allocation_bps"] == WEIGHTS[i],
                "founder role/weight drift")
        require(x["genesis_liquid_420"] == LIQUID[i]
                and x["genesis_locked_420"] == LOCKED[i]
                and x["genesis_total_420"] == LIQUID[i] + LOCKED[i],
                "founder tranche mismatch: " + role)
        suffix = ("admin", "andrew", "janet")[i]
        y = entries["founder-" + suffix + "-liquid"]
        require(y["founder_role"] == role and y["amount_420"] == LIQUID[i],
                "wrong Genesis liquid amount: " + role)
        require(y["lock_type"] == "founder-liquid-at-genesis",
                "liquid founder wallet is locked")
        address = x["wallet_address"]
        if address is None:
            require(y["destination"] is None, "unverified address hardcoded in Genesis")
            if release:
                raise ValueError(role + " founder address not supplied")
        else:
            require(bool(ADDR.fullmatch(address)), "invalid founder address: " + role)
            key = address.lower()
            require(key not in found and key not in system_wallets, "duplicate or system wallet")
            require(int(key[2:], 16) not in range(0x41f,0x500)
                    and int(key[2:],16) not in (0,2**160-2), "reserved founder wallet")
            found.add(key)
            require(y["destination"] == address, "Genesis liquid funds not routed to verified wallet: " + role)

    if release:
        require(committed["status"] != "FROZEN_V3",
                "frozen Genesis V3 commitment predates founder changes")
        require(committed["status"] == "FROZEN_V4",
                "new separately approved Genesis commitment required")
        fields = committed["commitmentPayload"]["authorityInputs"]
        record = next((z for z in fields if z["path"] == "config/genesis-allocations.json"), None)
        require(record is not None, "missing Genesis allocation binding")
        binary = LEDGER.read_bytes()
        digest = hashlib.sha1(b"blob " + str(len(binary)).encode() + b"\0" + binary).hexdigest()
        require(record["gitBlobSha1"] == digest, "Genesis signed ledger blob hash mismatch")
        require(H256.fullmatch(committed["genesisConfigHash"]),
                "missing valid Genesis hash")
        require(len(found) == 3, "missing or repeated personal founder wallets")
        require(wallets["planned_genesis_hash"].lower() == committed["genesisConfigHash"].lower(),
                "founder wallet signature plan does not match approved Genesis")
        require(init["founder_beneficiaries"] == [x["wallet_address"] for x in founders],
                "predeploy beneficiary storage has not been bound to verified wallets")
        require_live_genesis_balances(founders, json.loads((ROOT / "contracts/config/founding-genesis-integration-v1.json").read_text()))
    return len(found)


if __name__ == "__main__":
    cli = argparse.ArgumentParser()
    cli.add_argument("--require-release", action="store_true")
    args = cli.parse_args()
    try:
        n = verify(args.require_release)
    except (AssertionError, ValueError, KeyError, TypeError, AttributeError, subprocess.CalledProcessError, OSError, TimeoutError) as exc:
        print("FOUNDER GENESIS: FAIL-CLOSED: " + str(exc), file=sys.stderr)
        raise SystemExit(1)
    print(f"FOUNDER GENESIS: structure passes, {n}/3 founder addresses bound; "
          f"{'release bindings checked' if args.require_release else 'not qualified for live Genesis'}")

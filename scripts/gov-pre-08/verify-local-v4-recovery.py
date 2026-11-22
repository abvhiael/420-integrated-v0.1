#!/usr/bin/env python3
"""Read-only verified recovery of a Step 3 Anvil state after real process restart.

Reuses the exact source bundle and source-bound pre-restart RPC witness. This
verifies state survival, not historical tx/receipt retention or production EVM.
"""
import argparse
import importlib.util
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location(
    "govpre08_step3_recovery_source",
    Path(__file__).with_name("materialize-v4-source-and-audit-local.py"))
step3 = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(step3)

def recover(url, bundle, before):
    manifest = step3.verify_bundle(bundle)
    step3.need(before["schema"] == "GOV_PRE_08_STEP3_LOCAL_RPC_PROJECTION_V1"
               and before["sourceGitHead"] == step3.head()
               and before["chainId"] == 31337
               and before["liveGenesisQualified"] is False,
               "invalid/unapproved recovery baseline")
    step3.need(before["sourceManifestSha256"] == step3.sha256(step3.canonical(manifest)),
               "recovery baseline does not match source manifest")
    rpc = step3.funding.Rpc(url)
    step3.need(int(rpc.call("eth_chainId", []), 16) == 31337,
               "recovery connected to an unexpected chain")
    live = {}
    for name, record in before["constructorCode"].items():
        code = rpc.code(record["address"])
        step3.need(code != "0x", "lost executable contract on restart: " + name)
        ch = step3.funding.cast("keccak", code).lower()
        step3.need(ch == record["runtimeCodeHash"]
                   and (len(code)-2)//2 == record["codeBytes"],
                   "constructor runtime diverged on restart: " + name)
        live[name] = record["address"]
    for name, addr in before["vaults"].items():
        step3.need(rpc.code(addr) != "0x", "Vault runtime absent after restart " + name)
        step3.need(str(rpc.balance(addr)) == before["vaultBalancesWei"][name],
                   "Vault custody diverged on restart " + name)
        reg = live["VaultRegistry420"]
        res = rpc.read(reg, "getVault(bytes32)", before["vaultIds"][name])
        step3.need(int(res[2:66],16) == int(addr,16),
                   "Vault Registry pointer lost after restart " + name)
        if name in ("OPERATIONS", "CONTINGENCY"):
            accounting = live["VaultAccounting420"]
            free = rpc.read(accounting, "freeBalance(bytes32,address)",
                            before["vaultIds"][name], step3.ZERO)
            step3.need(int(free,16) == int(before["vaultBalancesWei"][name]),
                       "native accounting did not survive restart " + name)
    proto = step3.funding.PROTO
    step3.need(rpc.code(proto) != "0x"
               and rpc.balance(proto) == 3_560_000*step3.KIEF,
               "frozen ProtocolReserve runtime or unearmarked balance lost")
    step3.need(int(rpc.read(proto, "governanceTimelock()"),16) ==
               int(step3.funding.TIME,16),
               "fixed predeploy immutable authority changed after restart")
    founders = step3.funding.native_allocations(ROOT)
    original = {**{a: amount for a, amount in (
        ("0x0000000000000000000000000000000000000421",4_200_000),
        ("0x0000000000000000000000000000000000000422",4_200_000),
        ("0x0000000000000000000000000000000000000424",3_560_000),
        ("0x0000000000000000000000000000000000000425",6_300_000),
        ("0x0000000000000000000000000000000000000426",2_100_000),
        ("0x0000000000000000000000000000000000000427",500_000),
        ("0x000000000000000000000000000000000000042a",12_600_000),
        ("0x000000000000000000000000000000000000042e",3_000_000),
    )}, founders[0]:250_000,founders[1]:125_000,founders[2]:125_000}
    step3.need(all(rpc.balance(a) == n*step3.KIEF for a,n in original.items()),
               "native allocations altered after recovery")
    tracked = sum(rpc.balance(a) for a in original) + sum(
        rpc.balance(a) for a in before["vaults"].values())
    step3.need(tracked == 42_000_000*step3.KIEF,
               "Genesis 42m supply not conserved after real process restart")
    return {
        "schema": "GOV_PRE_08_STEP3_LOCAL_ANVIL_PROCESS_RECOVERY_V1",
        "sourceGitHead": step3.head(), "sourceManifestSha256": before["sourceManifestSha256"],
        "chainId": 31337, "foundingContractsWithRuntime": len(live),
        "registeredAndReconciledVaults": 3, "nativeGenesisSupplyWei": str(tracked),
        "sourceStateDigestSha256": before["stateDigestSha256"],
        "processRestartStateRecovered": True, "authorizedV4": False,
        "historicalReceiptContinuityProved": False, "testnetQualified": False,
    }

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--rpc", required=True)
    p.add_argument("--bundle", required=True, type=Path)
    p.add_argument("--baseline", required=True, type=Path)
    p.add_argument("--output", required=True, type=Path)
    args=p.parse_args()
    try:
        step3.need(not args.output.exists(), "refuse overwrite recovery evidence")
        result=recover(args.rpc,args.bundle,step3.read(args.baseline))
        step3.emit(args.output,result)
        print("GOV_PRE_08_STEP3_REAL_PROCESS_STATE_RECOVERY=PASS PRODUCTION=NO_GO")
    except (ValueError,KeyError,TypeError,OSError,subprocess.CalledProcessError) as exc:
        p.exit(1,str(exc)+"\n")

if __name__ == "__main__":
    main()

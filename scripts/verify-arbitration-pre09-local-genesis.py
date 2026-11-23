#!/usr/bin/env python3
"""ARB-PRE-09 exact local Genesis deployment receipt and determinism verifier."""
import json
import re
import sys
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HEX32 = re.compile(r"0x[0-9a-fA-F]{64}\Z")
ADDR = re.compile(r"0x[0-9a-fA-F]{40}\Z")
CHECKED = (
    "ArbitrationPolicyRegistry420", "ArbitrationCaseRegistry420",
    "ArbitrationRulingRegistry420", "ArbitrationRouter420",
)
PREDEPLOYS = {
    "GovernanceTimelock": "0x0000000000000000000000000000000000000429",
    "ProtocolRegistry": "0x0000000000000000000000000000000000000434",
}
ORDER = [
    "genesis:timelock-constructor", "genesis:registry-constructor",
    "deploy:policies", "deploy:cases", "deploy:rulings",
    "execute:one-time-ruling-binding", "deploy:router",
    "execute:register-component", "execute:publish-service-v1",
    "execute:activate-domain-policy", "user:open-case",
    "user:claimant-evidence", "user:respondent-evidence",
    "resolver:round-0", "user:appeal", "resolver:round-1",
    "user:finalize", "execute:deprecate-service", "execute:recover-service-v2",
]


def require(condition, explanation):
    if not condition:
        raise AssertionError(explanation)


def read_manifest(filename):
    d = json.loads(Path(filename).read_text())
    require(d["schema"] == "arb-pre-09-local-genesis-evidence-v1", "manifest schema")
    require(d["production"] is False and d["chainId"] == 31337, "not local-only")
    require(d["approvedAddressModel"] == "REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS",
            "fixed Arbitration address introduced")
    require(HEX32.fullmatch(d["genesisHash"]), "missing real genesis hash")
    require(d["caseFinalized"] is True and d["appealRound"] == 1, "incomplete case lifecycle")
    whole = d.get("scenarioCoverage", {})
    require(whole == {
        "standardFinalized": True,
        "appealedFinalized": True,
        "maximumAppeals": 2,
        "maximumAppealsFinalized": True,
        "policySnapshotFrozen": True,
        "unauthorizedRejected": True,
        "deprecationAndGovernedRecovery": True,
        "realChainReorganization": True,
    }, "full local standard/appeal/cap/policy/recovery scenario matrix incomplete")
    require(d["canonicalPredeploys"] == {
        "governanceTimelock": PREDEPLOYS["GovernanceTimelock"],
        "protocolRegistry": PREDEPLOYS["ProtocolRegistry"],
    }, "frozen local predeploy assignments changed")
    require(d["compiler"] == {
        "version": "0.8.24", "evm": "cancun", "optimizer": True,
        "runs": 200, "viaIR": True,
    }, "compiler drift")
    settings = tomllib.loads((ROOT / "contracts/foundry.toml").read_text())["profile"]["default"]
    require(settings["solc_version"] == d["compiler"]["version"], "actual solc config drift")
    require(settings["evm_version"] == d["compiler"]["evm"], "actual EVM config drift")
    require(settings["optimizer"] == d["compiler"]["optimizer"], "optimizer drift")
    require(settings["optimizer_runs"] == d["compiler"]["runs"], "optimizer run drift")
    require(settings["via_ir"] == d["compiler"]["viaIR"], "via IR drift")
    release = json.loads((ROOT / "contracts/config/arbitration/"
                          "arbitration-audit-4-release-materialization.json").read_text())
    require(release["address_policy"]["arbitration_router_status"] ==
            d["approvedAddressModel"], "release address model drift")
    require(release["live_qualified"] is False, "fabricated testnet evidence")
    addresses = d["addresses"]
    require({k: addresses[k] for k in PREDEPLOYS} == PREDEPLOYS,
            "actual local address authority drift")
    require(all(ADDR.fullmatch(addresses[k]) for k in CHECKED), "invalid deployed address")
    require(len({addresses[k].lower() for k in CHECKED}) == 4, "alias in deployed graph")
    require(all(addresses[k].lower() not in
                {x.lower() for x in PREDEPLOYS.values()} for k in CHECKED),
            "fabricated fixed Arbitration contract address")
    hashes = d["runtimeCodeHashes"]
    require(all(HEX32.fullmatch(hashes[k]) and int(hashes[k], 16) > 0
                for k in (*CHECKED, *PREDEPLOYS)), "missing runtime bytecode evidence")
    registration = d["registration"]
    require(registration["publishedVersions"] == [1, 2] and
            registration["activeVersion"] == 2, "governed recovery not recorded")
    require(all(HEX32.fullmatch(registration[k]) and
                int(registration[k], 16) > 0 for k in (
                    "serviceId", "componentId", "metadataHash", "manifestHash",
                    "interfaceHash", "dependencyRoot")), "missing registration commitment")
    require(registration["serviceId"] != registration["componentId"],
            "service and component namespaces aliased")
    transactions = d["transactions"]
    require(len(transactions) >= len(ORDER), "missing Genesis transactions")
    require(all(t["order"] == index for index, t in enumerate(transactions, 1)),
            "receipt order diverges from transaction sequence")
    require(all(HEX32.fullmatch(t["txHash"]) and HEX32.fullmatch(t["blockHash"])
                for t in transactions), "unverifiable transaction or block hashes")
    require(len({t["txHash"] for t in transactions}) == len(transactions),
            "duplicate transaction hash")
    require(all(t["blockNumber"] > 0 and t["transactionIndex"] >= 0
                for t in transactions), "bad receipt position")
    require(all(transactions[i]["blockNumber"] < transactions[i + 1]["blockNumber"]
                for i in range(len(transactions) - 1)), "receipts out of chain order")
    positions = [next((i for i, t in enumerate(transactions) if t["step"] == step), -1)
                 for step in ORDER]
    require(all(i >= 0 for i in positions) and positions == sorted(positions),
            "canonical deployment/consumer/recovery order violated")
    steps = {t["step"] for t in transactions}
    require("schedule-negative:invalid-binding" in steps and
            "schedule-negative:duplicate-binding" in steps and
            "schedule-negative:incorrect-recovery-revision" in steps,
            "negative governance binding cases not executed")
    expected = [
        "unauthorized ruling binding", "invalid-binding", "duplicate-binding",
        "unauthorized component registration", "unauthorized service publication",
        "deprecated service resolution", "incorrect-recovery-revision",
        "observer submits evidence", "wrong resolver initial ruling",
        "initial resolver cannot rule on appeal", "ruling finalization before deadline",
        "finalization replay", "observer cannot appeal",
        "policy deactivation blocks new case", "finalized case cannot accept evidence",
        "appeal cap reached", "appeal finalized maximum case",
        "orphaned case inaccessible after reorg",
    ]
    require(set(expected).issubset(d["negativeTests"]), "negative-case security coverage missing")
    reproducible = Path(filename).with_name(Path(filename).stem + ".reproducible.json")
    require(reproducible.exists(), "reproducibility companion missing")
    normalized = json.loads(reproducible.read_text())
    require(normalized["addresses"] == addresses and normalized["runtimeCodeHashes"] == hashes,
            "reproducible bytecode identity drift")
    require(normalized["registration"] == registration, "reproducible commitment drift")
    require(normalized.get("scenarioCoverage") == whole, "reproducible scenario matrix drift")
    return d, normalized


def main():
    require(len(sys.argv) == 3, "pass two independent Anvil manifests")
    first, normalized_first = read_manifest(sys.argv[1])
    second, normalized_second = read_manifest(sys.argv[2])
    require(normalized_first == normalized_second, "two clean Genesis runs diverged")
    print(json.dumps({
        "result": "PASS", "step": "ARB-PRE-09",
        "localOnly": True, "realTimelock": True,
        "deployments": len(CHECKED),
        "transactionsPerRun": len(first["transactions"]),
        "runtimeHashes": len(first["runtimeCodeHashes"]),
        "negativeSecurityCases": len(first["negativeTests"]),
        "genesisRunRepeatable": True,
        "serviceRecovery": "ACTIVE_VERSION_2",
        "userResolverLifecycle": "FINALIZED_APPEAL_ROUND_1",
    }, indent=2))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""ARB-PRE-11: fail-closed repository operations and live-evidence handoff verification.

Does not make network calls, deploy contracts, claim finality, authorize signers,
or set any testnet-only value. --candidate verifies structural completeness ONLY.
"""
import argparse
import copy
import json
import re
import sys
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = ROOT / "contracts/config/arbitration/arb-pre-11-testnet-handoff-template.json"
RUNBOOK = ROOT / "docs/audit/420ARBITRATION-ARB-PRE-11-OPERATIONS-TESTNET-HANDOFF.md"
RELEASE = ROOT / "contracts/config/arbitration/arbitration-audit-4-release-materialization.json"
GENESIS = ROOT / "contracts/config/420arbitration-genesis.json"
COMPONENTS = (
    "ArbitrationPolicyRegistry420", "ArbitrationCaseRegistry420",
    "ArbitrationRulingRegistry420", "ArbitrationRouter420",
)
SCENARIOS = (
    "standardDispute", "appealedDispute", "maximumAppeals", "unauthorizedActions",
    "governancePolicySnapshot", "registryDeprecationRecovery",
    "rpcWalletApiIndexerInterruption", "reorganizationRebuild",
    "originRemedyAccounting", "privateStorageAuthorization",
)
HEX32 = re.compile(r"0x[a-fA-F0-9]{64}\Z")
ADDR = re.compile(r"0x[a-fA-F0-9]{40}\Z")
COMMIT = re.compile(r"[a-fA-F0-9]{40}\Z")


def require(ok, message):
    if not ok:
        raise AssertionError(message)


def json_file(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def source_ownership(manifest):
    release = json_file(RELEASE)
    genesis = json_file(GENESIS)
    conf = tomllib.loads((ROOT / "contracts/foundry.toml").read_text(encoding="utf-8"))["profile"]["default"]
    authority = manifest["sourceAuthority"]
    require(manifest["addressModel"] == "REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS",
            "fixed Arbitration address model introduced")
    require(release["address_policy"]["arbitration_router_status"] == manifest["addressModel"],
            "frozen source release address policy mismatch")
    require(genesis["deployment"]["addressModel"] == manifest["addressModel"],
            "Genesis service address policy mismatch")
    require(genesis["serviceId"] == authority["serviceIdPreimage"],
            "canonical service preimage mismatch")
    require(genesis["deployment"]["componentId"] == authority["componentIdPreimage"],
            "canonical component preimage mismatch")
    require(authority["serviceIdPreimage"] != authority["componentIdPreimage"],
            "aliased component/service namespaces")
    require(authority["releaseMaterialization"] == str(RELEASE.relative_to(ROOT)),
            "release source path mismatch")
    require(authority["genesisConfig"] == str(GENESIS.relative_to(ROOT)),
            "Genesis source path mismatch")
    require(authority["frozenAddressNamespace"] ==
            release["address_policy"]["namespace_authority"], "namespace source mismatch")
    require(conf["solc_version"] == authority["compiler"] == "0.8.24", "compiler drift")
    require(conf["evm_version"] == authority["evmVersion"] == "cancun", "EVM settings drift")
    require(conf["optimizer"] is authority["optimizer"] is True, "optimizer disabled")
    require(conf["optimizer_runs"] == authority["optimizerRuns"] == 200, "optimizer runs drift")
    require(conf["via_ir"] is authority["viaIR"] is True, "via-IR disabled")
    order = release["deployment_order"]
    require(len(order) == 7 and [x["order"] for x in order] == list(range(1, 8)),
            "canonical deployment order changed")
    require([x["contract"] for x in order[:3]] == list(COMPONENTS[:3]),
            "constructor deployment graph changed")
    require(order[3]["action"] == "bindRulingRegistry" and
            order[3]["one_time"] is True, "one-time ruling binding changed")
    require(order[4]["contract"] == COMPONENTS[-1], "router deployment order changed")
    require(order[5]["action"] == "registerComponent" and
            order[6]["action"] == "publishRegisteredService", "registry ordering changed")
    require(release["live_qualified"] is False,
            "unqualified release file claims live testnet qualification")
    require(manifest["localQualification"]["status"] == "REPOSITORY_ONLY",
            "local evidence misclassified as live")
    for field in ("pre09", "pre10"):
        require(COMMIT.fullmatch(manifest["localQualification"][field]["commit"]),
                "missing qualified local implementation SHA")
    require(COMMIT.fullmatch(manifest["localQualification"]["mergedBaselineCommit"]),
            "missing merged source baseline")
    return True


def check_shape(manifest):
    template = json_file(TEMPLATE)
    require(manifest["schema"] == "420-arbitration-audit-5-testnet-evidence-v1",
            "unknown evidence schema")
    require(manifest["phase"] == "ARBITRATION-AUDIT-5", "unapproved evidence phase")
    require(set(manifest.keys()) == set(template.keys()), "top-level evidence fields changed")
    require(set(manifest["live"].keys()) == set(template["live"].keys()),
            "missing or unexpected live evidence field")
    require(set(manifest["live"]["deployedContracts"].keys()) == set(COMPONENTS),
            "incomplete canonical Arbitration contract inventory")
    require(set(manifest["live"]["testScenarios"].keys()) == set(SCENARIOS),
            "incomplete live integration scenario matrix")
    for contract in COMPONENTS:
        require(set(manifest["live"]["deployedContracts"][contract].keys()) ==
                set(template["live"]["deployedContracts"][contract].keys()),
                "missing constructor or runtime evidence field " + contract)
    for scenario in SCENARIOS:
        require(set(manifest["live"]["testScenarios"][scenario].keys()) ==
                {"passed", "transactions", "evidenceBlockHashes"},
                "missing test receipts for scenario " + scenario)
    require(set(manifest["live"]["governanceVerification"].keys()) ==
            set(template["live"]["governanceVerification"].keys()), "missing Timelock readbacks")
    require(set(manifest["live"]["registryPublication"].keys()) ==
            set(template["live"]["registryPublication"].keys()), "missing Registry publication proof")
    require(set(manifest["live"]["oneTimeBinding"].keys()) ==
            set(template["live"]["oneTimeBinding"].keys()), "missing one-time binding proof")
    source_ownership(manifest)


def require_empty(value, label):
    if isinstance(value, dict):
        for key, child in value.items():
            require_empty(child, label + "." + key)
    elif isinstance(value, list):
        require(not value, "Live field unexpectedly populated: " + label)
    else:
        require(value is None or value is False, "Live field unexpectedly populated: " + label)


def validate_template(manifest=None):
    manifest = manifest if manifest is not None else json_file(TEMPLATE)
    check_shape(manifest)
    require(manifest["status"] == "PREPARED_NOT_DEPLOYED_NOT_QUALIFIED",
            "testnet template status claims deployment")
    require(manifest["liveQualified"] is False, "testnet template claims qualification")
    require_empty(manifest["live"], "live")
    return {"result": "PASS", "mode": "empty-template", "liveQualified": False,
            "liveNetworkEvidenceFieldsPopulated": 0, "scenarios": len(SCENARIOS),
            "contracts": len(COMPONENTS)}


def hex_value(value, pattern, label):
    require(isinstance(value, str) and pattern.fullmatch(value), "missing/invalid " + label)
    require(int(value[2:], 16) != 0, "zero " + label)


def validate_candidate(manifest):
    """Structural check only; independently verify every claim with live RPC and signed records."""
    check_shape(manifest)
    require(manifest["status"] == "CAPTURED_PENDING_INDEPENDENT_ONCHAIN_VERIFICATION",
            "candidate must remain pending independent verification")
    require(manifest["liveQualified"] is False,
            "offline structural verifier cannot declare live qualification")
    live = manifest["live"]
    require(type(live["chainId"]) is int and live["chainId"] > 0 and
            live["chainId"] != 31337, "invalid or local-fixture network chain ID")
    for key in ("genesisHash", "evidenceBlockHash"):
        hex_value(live[key], HEX32, key)
    require(type(live["evidenceBlockNumber"]) is int and live["evidenceBlockNumber"] >= 0,
            "no real evidence block number")
    require(type(live["finalizedBlockNumber"]) is int and
            0 <= live["finalizedBlockNumber"] <= live["evidenceBlockNumber"],
            "invalid consensus-finalized block")
    require(COMMIT.fullmatch(live["releaseCommit"] or ""), "missing exact release SHA")
    require(COMMIT.fullmatch(live["deploymentCommit"] or ""), "missing deployment commit SHA")
    require(live["releaseCommit"] == live["deploymentCommit"], "release/deployment SHA divergence")
    for key in ("governanceTimelockAddress", "protocolRegistryAddress"):
        hex_value(live[key], ADDR, key)
    require(live["governanceVerification"]["g1DelaySeconds"] == 604800,
            "frozen G1 delay mismatch")
    require(type(live["governanceVerification"]["civicAuthorityActivated"]) is bool,
            "missing actual Civic activation state")
    for key in ("scheduler", "bootstrapGovernor"):
        hex_value(live["governanceVerification"][key], ADDR, key)
    hex_value(live["governanceVerification"]["transactionHash"], HEX32, "Timelock receipt")
    require(isinstance(live["networkName"], str) and live["networkName"].strip(),
            "missing observed network name")
    require(isinstance(live["rpcEndpointRedacted"], str) and
            live["rpcEndpointRedacted"].startswith("https://"), "missing public redacted RPC origin")
    require(isinstance(live["observedAtUtc"], str) and live["observedAtUtc"].endswith("Z"),
            "missing observed UTC time")
    deployment_addresses = []
    for contract in COMPONENTS:
        ref = live["deployedContracts"][contract]
        for key, pattern in (("address", ADDR), ("deploymentTransaction", HEX32),
                             ("deploymentBlockHash", HEX32), ("runtimeCodeHash", HEX32)):
            hex_value(ref[key], pattern, contract + "." + key)
        require(isinstance(ref["constructorArguments"], list) and ref["constructorArguments"],
                "missing constructor argument record for " + contract)
        deployment_addresses.append(ref["address"].lower())
    require(len(set(deployment_addresses)) == 4, "aliased contract deployment")
    require(live["oneTimeBinding"]["verified"] is True, "unverified one-time binding")
    for key in ("transactionHash", "blockHash"):
        hex_value(live["oneTimeBinding"][key], HEX32, "binding " + key)
    require(live["oneTimeBinding"]["caseRegistry"].lower() ==
            deployment_addresses[1], "incorrect Case binding")
    require(live["oneTimeBinding"]["rulingRegistry"].lower() ==
            deployment_addresses[2], "incorrect Ruling binding")
    r = live["registryPublication"]
    require(r["immutableGraphVerified"] is True and r["serviceActive"] is True,
            "Registry inactive or immutable graph unverified")
    require(type(r["serviceVersion"]) is int and r["serviceVersion"] > 0,
            "missing real Registry revision")
    require(r["resolvedImplementation"].lower() == deployment_addresses[-1],
            "wrong active Registry implementation")
    for key in ("componentId", "serviceId", "componentRuntimeCodeHash",
                "metadataHash", "manifestHash", "dependencyRoot", "interfaceHash",
                "componentRegistrationTransaction", "servicePublicationTransaction"):
        hex_value(r[key], HEX32, "registry." + key)
    require(r["componentId"] != r["serviceId"], "aliased Registry identities")
    require(r["componentRuntimeCodeHash"] == live["deployedContracts"][COMPONENTS[-1]]["runtimeCodeHash"],
            "Registry code identity mismatch")
    require(isinstance(live["deploymentTransactionOrder"], list) and
            len(live["deploymentTransactionOrder"]) >= 7,
            "missing transaction-ordered deployment receipts")
    require(all(type(x) is dict and
                isinstance(x.get("order"), int) and
                HEX32.fullmatch(x.get("transactionHash", "")) and
                HEX32.fullmatch(x.get("blockHash", "")) for x in live["deploymentTransactionOrder"]),
            "malformed transaction order or block provenance")
    require([x["order"] for x in live["deploymentTransactionOrder"]] ==
            list(range(1, len(live["deploymentTransactionOrder"]) + 1)),
            "deployment transaction order not sequential")
    for name, scenario in live["testScenarios"].items():
        require(scenario["passed"] is True, "unqualified live scenario " + name)
        require(scenario["transactions"] and scenario["evidenceBlockHashes"],
                "missing live scenario receipts " + name)
        for h in scenario["transactions"] + scenario["evidenceBlockHashes"]:
            hex_value(h, HEX32, "scenario receipt/block " + name)
    require(live["storageGatewayAndIssuerVerified"] is True,
            "private Storage access not independently qualified")
    require(live["nodeAndIndexerReconciliation"] is True,
            "canonical node/Indexer reconciliation absent")
    require(isinstance(live["workflowEvidence"], list) and live["workflowEvidence"],
            "missing exact-head workflow record")
    for row in live["workflowEvidence"]:
        require(row.get("commit") == live["releaseCommit"] and
                type(row.get("runId")) is int and row["runId"] > 0 and
                row.get("conclusion") == "success" and row.get("artifactUrl"),
                "workflow evidence not tied to exact release")
    require(live["evidenceArtifacts"] and live["operatorSignoff"] and
            live["independentSecurityReview"] and live["verifiedAtUtc"],
            "incomplete independent evidence and operator signoff")
    return {"result": "PASS", "mode": "candidate-structure-only",
            "liveQualified": False, "independentOnchainVerificationStillRequired": True}


REQUIRED_SECTIONS = (
    "Shift start", "Deterministic deployment", "Domain policy", "Evidence privacy",
    "Infrastructure and Indexer recovery", "Service deprecation",
    "Origin-protocol remedy", "Application configuration", "Local drill",
)
REQUIRED_OPERATIONS = (
    "GovernanceTimelock", "registerComponent", "publishRegisteredService",
    "bindRulingRegistry", "setPolicy", "resolver", "rotation", "appeal",
    "finalization", "Indexer", "RPC interruption", "Wallet interruption",
    "reorganization", "deprecation", "recovery", "Incident triggers",
    "Rollback", "runtime", "release", "420Storage", "receipt",
)


def validate_runbook():
    doc = RUNBOOK.read_text(encoding="utf-8")
    require(len(doc) > 9000, "operations document incomplete")
    for heading in REQUIRED_SECTIONS:
        require(heading.lower() in doc.lower(), "missing runbook section " + heading)
    for token in REQUIRED_OPERATIONS:
        require(token.lower() in doc.lower(), "missing operational procedure " + token)
    for required in (
        "scripts/qualify-arbitration-pre09-local-genesis.mjs",
        "scripts/verify-arbitration-pre09-local-genesis.py",
        "420-indexer/test/arbitration-recovery-postgres.test.ts",
        "contracts/config/arbitration/arb-pre-11-testnet-handoff-template.json",
        "ARBITRATION-AUDIT-5",
    ):
        require(required in doc, "missing executable/evidence source " + required)
        if required.startswith(("scripts/", "contracts/", "420-indexer/")):
            require((ROOT / required).exists(), "referenced source missing: " + required)
    require((ROOT / ".github/workflows/420arbitration-pre11-operations.yml").exists(),
            "no exact-head operator qualification workflow")
    return {"result": "PASS", "mode": "runbook-and-source-ownership",
            "requiredSections": len(REQUIRED_SECTIONS),
            "operationalTopics": len(REQUIRED_OPERATIONS)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--template", action="store_true")
    group.add_argument("--runbook", action="store_true")
    group.add_argument("--candidate", type=Path)
    args = parser.parse_args()
    if args.template:
        result = validate_template()
    elif args.runbook:
        result = validate_runbook()
    else:
        require(args.candidate.resolve() != TEMPLATE.resolve(),
                "the empty template cannot be a testnet evidence candidate")
        result = validate_candidate(json_file(args.candidate))
    print(json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    try:
        main()
    except (AssertionError, ValueError, KeyError, TypeError, FileNotFoundError) as exc:
        print("ARB-PRE-11 FAIL: " + str(exc), file=sys.stderr)
        sys.exit(1)

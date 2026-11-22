#!/usr/bin/env python3
"""GOV-REC-6: independent, read-only retained-artifact / Genesis release-boundary verification.

This check never edits deployment state or authorizes a Genesis electorate. An empty
seven-field Genesis commitment is a valid *offline* fail-closed candidate, not a
live activation approval. Compilation and byte-for-byte generation are separate
mandatory checks in the qualification workflow.
"""
import argparse
import json
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
CFG = ROOT / "contracts/config/governance-deployment-v1.json"
PRE = ROOT / "contracts/config/predeploy"
PLAN = PRE / "predeploy-plan.json"
DEPLOY = ROOT / "contracts/config/deployment-manifest.json"
MANIFEST = ROOT / "420-indexer/descriptors/governance-civic-v1.json"
REGISTRY = "0x0000000000000000000000000000000000000434"
TIMELOCK = "0x0000000000000000000000000000000000000429"
COMPAT = "0x0000000000000000000000000000000000000437"
CORE = (
    "CivicConstitution420", "CivicProposalRegistry420",
    "CivicElectorateRegistry420", "CivicVoting420", "CivicGovernor420",
)
ALL = ("GovernanceTimelock", "Governance420") + CORE + ("CivicMerkleElectorateSource420",)
APPROVAL_FIELDS = (
    ("approvedPlanHash", "approvedBootstrapPlanHash"),
    ("communityRoot", "initialCommunityRoot"),
    ("communityTotalWeight", "initialCommunityTotalWeight"),
    ("validatorRoot", "initialValidatorRoot"),
    ("validatorTotalWeight", "initialValidatorTotalWeight"),
    ("enrollmentContract", "approvedInitialEnrollment"),
    ("electorateAuthority", "approvedInitialElectorateAuthority"),
)
EXPECTED_IDS = {
    "CivicConstitution420": "420/component/governance/civic-constitution/v1",
    "CivicProposalRegistry420": "420/component/governance/civic-proposal-registry/v1",
    "CivicElectorateRegistry420": "420/component/governance/civic-electorate-registry/v1",
    "CivicVoting420": "420/component/governance/civic-voting/v1",
    "CivicGovernor420": "420/component/governance/civic-governor/v1",
}
ZERO = "0x" + "00" * 32


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def require(condition, message):
    if not condition:
        raise ValueError(message)


def address(value):
    return isinstance(value, str) and re.fullmatch(r"0x[0-9a-fA-F]{40}", value) is not None


def bytes32(value):
    return isinstance(value, str) and re.fullmatch(r"0x[0-9a-fA-F]{64}", value) is not None


def approval_values(config):
    """Reject mixed, partial or fabricated Genesis electorate approval modes."""
    items = []
    for key, _ in APPROVAL_FIELDS:
        value = config.get(key)
        if key.endswith("Weight"):
            require(type(value) is int and 0 <= value < 2**256, "invalid approved " + key)
            items.append(value)
        elif key in ("enrollmentContract", "electorateAuthority"):
            require(address(value), "invalid approved " + key)
            items.append(int(value, 16))
        else:
            require(bytes32(value), "invalid approved " + key)
            items.append(int(value, 16))
    legacy = all(items[:5]) and not any(items[5:])
    deferred = items[0] != 0 and not any(items[1:5]) and all(items[5:])
    require(not any(items) or legacy or deferred, "partial Genesis bootstrap approval must fail closed")
    return dict(zip((key for key, _ in APPROVAL_FIELDS), items)), bool(legacy or deferred)


def storage_word(layout, label):
    matches = [x for x in layout["storage"] if x.get("label") == label]
    require(len(matches) == 1, "storage layout missing/duplicate: " + label)
    entry = matches[0]
    require(int(entry["offset"]) == 0, "unexpected Genesis slot packing: " + label)
    return "0x" + int(entry["slot"]).to_bytes(32, "big").hex()


def keccak_runtime(code):
    require(isinstance(code, str) and re.fullmatch(r"0x(?:[0-9a-fA-F]{2})+", code) is not None, "malformed runtime bytes")
    result = subprocess.run(["cast", "keccak", code], cwd=ROOT, text=True, capture_output=True, check=True)
    value = result.stdout.strip().lower()
    require(bytes32(value), "cast did not produce a keccak256 runtime hash")
    return value


def git_blob(path):
    result = subprocess.run(["git", "hash-object", str(path.relative_to(ROOT))], cwd=ROOT, capture_output=True, text=True, check=True)
    return result.stdout.strip()


def verify(root=ROOT):
    require(root == ROOT, "verification must run against the authoritative checkout")
    cfg, plan, deployed = load(CFG), load(PLAN), load(DEPLOY)
    reg = cfg["registry"]
    require(reg["address"].lower() == REGISTRY, "frozen Registry address changed")
    require(reg["serviceId"] == {"algorithm": "keccak256(utf8)", "preimage": "420/service/governance/v1"}, "Governance service ID drift")
    service = reg["servicePublication"]
    require(service["implementation"] == "CivicGovernor420" and service["version"] == 1 and service["active"] is True, "Governance service publication identity drift")
    require([x["name"] for x in cfg["registryResolvedComponents"]] == list(CORE), "Civic component order changed")
    for item in cfg["registryResolvedComponents"]:
        cid = item["componentId"]
        require(cid["algorithm"] == "keccak256(utf8)" and cid["preimage"] == EXPECTED_IDS[item["name"]], "Civic component identity mismatch: " + item["name"])
        require(item["fixedAddress"] is None, "invented fixed Civic component address")

    artifacts = {}
    plan_fixed = {x["name"]: x for x in plan["predeploys"] if x["name"] in ("GovernanceTimelock", "Governance420")}
    deployment_fixed = {x["name"]: x for x in deployed["contracts"] if x["name"] in ("GovernanceTimelock", "Governance420")}
    for name in ALL:
        item = cfg["runtimeArtifacts"][name]
        path = ROOT / item["path"]
        artifact = load(path)
        artifacts[name] = artifact
        require(artifact["contractName"] == name, "artifact identity drift: " + name)
        require(artifact["schema"] == "420-governance-runtime-artifact-v1", "artifact schema drift: " + name)
        require(artifact["compiler"]["solidity"] == cfg["compiler"]["solidity"] == "0.8.24", "compiler drift: " + name)
        require(artifact["compiler"]["evmVersion"] == cfg["compiler"]["evmVersion"] == "cancun", "EVM target drift: " + name)
        require(artifact["compiler"]["optimizer"] is True and artifact["compiler"]["optimizerRuns"] == 200 and artifact["compiler"]["viaIR"] is True, "compiler optimizer drift: " + name)
        require(isinstance(artifact["storageLayout"].get("storage"), list), "storage layout missing: " + name)
        require(isinstance(artifact["abi"], list) and artifact["abi"], "ABI missing: " + name)
        require(artifact["sourceBlobSha1"] == item["sourceBlobSha1"] == git_blob(ROOT / artifact["source"]), "source/blob mismatch: " + name)
        computed = keccak_runtime(artifact["deployedBytecode"])
        require(computed == item["runtimeCodeHash"].lower() == artifact["runtimeCodeHash"].lower(), "runtime code hash mismatch: " + name)
        require(len(artifact["deployedBytecode"][2:]) // 2 == artifact["runtimeCodeBytes"], "runtime length mismatch: " + name)
        refs = artifact["immutableReferences"]
        patched = artifact["materializedImmutableReferences"]
        require(len(patched) == sum(len(v) for v in refs.values()), "incomplete immutable materialization: " + name)
        for slot in patched:
            require(slot["length"] == 32 and slot["start"] >= 0, "invalid immutable slot: " + name)
            offset = slot["start"] * 2 + 2
            value = artifact["deployedBytecode"][offset:offset + 64]
            require(value.lower() == ("00" * 12 + slot["value"][2:]).lower(), "unmaterialized constructor reference: " + name)

    for name, fixed_addr in (("GovernanceTimelock", TIMELOCK), ("Governance420", COMPAT)):
        state = load(PRE / (name + "-predeploy-state.json"))
        artifact = artifacts[name]
        require(state["address"].lower() == fixed_addr, "fixed predeploy address mismatch: " + name)
        require(state["runtimeCodeHash"] == artifact["runtimeCodeHash"], "predeploy/runtime mismatch: " + name)
        require(state["runtimeArtifact"] == cfg["runtimeArtifacts"][name]["path"], "predeploy artifact path mismatch: " + name)
        for record in (plan_fixed[name], deployment_fixed[name]):
            require(record["runtime_code_hash"] == artifact["runtimeCodeHash"], "Genesis plan/manifest hash mismatch: " + name)
            require(record["predeploy_state"] == cfg["fixedPredeployState"][name], "Genesis plan/manifest predeploy path mismatch: " + name)

    approval, ready = approval_values(cfg["genesisBootstrapCommitment"])
    state = load(PRE / "Governance420-predeploy-state.json")
    layout = artifacts["Governance420"]["storageLayout"]
    require(state["genesisBootstrapApprovalReady"] is ready, "Genesis approval readiness misreported")
    require(len(state["storage"]) == len(APPROVAL_FIELDS) == 7, "noncanonical Genesis materialization slot count")
    for key, name in APPROVAL_FIELDS:
        slot = storage_word(layout, name)
        expected = "0x" + approval[key].to_bytes(32, "big").hex()
        require(state["storage"].get(slot) == expected, "Genesis materialized field mismatch: " + key)
    if not ready:
        require(cfg["genesisBootstrapCommitment"]["status"] == "GENESIS_RELEASE_INPUTS_PENDING_FAIL_CLOSED", "unapproved release status incorrectly activated")
        require(all(x == 0 for x in approval.values()), "unapproved Genesis state not zero")
    else:
        require(cfg["genesisBootstrapCommitment"]["status"] != "GENESIS_RELEASE_INPUTS_PENDING_FAIL_CLOSED", "unverified approval status with materialized commitment")

    timelock = load(PRE / "GovernanceTimelock-predeploy-state.json")
    t_layout = artifacts["GovernanceTimelock"]["storageLayout"]["storage"]
    scheduler = next(x for x in t_layout if x["label"] == "scheduler")
    active = next(x for x in t_layout if x["label"] == "civicAuthorityActivated")
    require(scheduler["slot"] == active["slot"], "Timelock storage packing changed")
    scheduler_word = int(COMPAT, 16) << (int(scheduler["offset"]) * 8)
    scheduler_slot = "0x" + int(scheduler["slot"]).to_bytes(32, "big").hex()
    require(timelock["storage"] == {scheduler_slot: "0x" + scheduler_word.to_bytes(32, "big").hex()}, "incorrect initial Timelock scheduler storage")
    require(timelock["constructorMaterialization"]["civicAuthorityActivated"] is False, "Timelock incorrectly activated in Genesis")

    declared = load(MANIFEST)
    require(declared["protocol"] == "420Governance" and declared["authority"] == "artifact_events_only_addresses_resolved_by_deployment", "Indexer acquired authority")
    require({x["contractName"] for x in declared["contracts"]} == set(CORE), "Civic descriptor component drift")
    for entry in declared["contracts"]:
        actual = {}
        for ev in artifacts[entry["contractName"]]["abi"]:
            if ev.get("type") == "event":
                signature = ev["name"] + "(" + ",".join(i["type"] for i in ev["inputs"]) + ")"
                actual[signature] = ev
        require(len(actual) == len(entry["events"]), "Indexer event count mismatch: " + entry["contractName"])
        for event in entry["events"]:
            compiled = actual.get(event["signature"])
            require(compiled is not None and compiled["name"] == event["name"], "Indexer event signature mismatch: " + event["signature"])
            require(event["inputs"] == [
                {"name": x["name"], "type": x["type"], "indexed": bool(x.get("indexed", False))}
                for x in compiled["inputs"]
            ], "Indexer event ABI field drift: " + event["signature"])
    return {"pass": True, "step": "GOV-REC-6", "runtimeArtifacts": len(ALL),
            "registryResolved": len(CORE), "genesisActivationReady": ready,
            "genesisBootstrapApproval": "APPROVED_COMMITMENT_MATERIALIZED" if ready else "PENDING_FAIL_CLOSED",
            "trackedCivicEvents": sum(len(x["events"]) for x in declared["contracts"])}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--require-activation-ready", action="store_true")
    args = parser.parse_args()
    try:
        result = verify()
        if args.require_activation_ready and not result["genesisActivationReady"]:
            raise ValueError("authentic chain-specific Genesis bootstrap approval and both electorates are missing; cannot activate")
        print(json.dumps(result, sort_keys=True, indent=2))
        return 0
    except (ValueError, OSError, KeyError, subprocess.CalledProcessError, StopIteration) as exc:
        print(json.dumps({"pass": False, "step": "GOV-REC-6", "error": str(exc)}, indent=2))
        return 2


if __name__ == "__main__":
    sys.exit(main())

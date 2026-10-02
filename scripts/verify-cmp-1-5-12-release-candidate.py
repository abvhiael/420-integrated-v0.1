#!/usr/bin/env python3
import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CFG = ROOT / "contracts/config/compute-market/cmp-1.5.12-release-candidate.json"
DOC = ROOT / "docs/compute-market/CMP-1.5.12-RELEASE-CANDIDATE.md"
WIRING = ROOT / "contracts/src/compute/ComputeStakeReleaseCandidateWiring420.sol"
TEST = ROOT / "contracts/test/ComputeStakeReleaseCandidateWiring420.t.sol"
ROADMAP = ROOT / "docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md"

EXPECTED_ROLES = [
    "ComputeWorkerRegistry420",
    "ComputeVerifierRegistry420",
    "ComputeDisputeResolution420",
    "ComputeVerifiedEntitlement420",
    "WorkerCollateralAssetVault420",
    "VerifierCollateralAssetVault420",
    "RewardAssetVault420",
    "ComputeStakeExitPolicy420",
    "ComputeStakeSlashPolicy420",
    "ComputeStakeWorkerCollateral420",
    "ComputeStakeVerifierCollateral420",
    "ComputeStakeSlashAuthorization420",
    "ComputeStakeSlashDistributionPolicy420",
    "ComputeStakeSlashDistribution420",
    "ComputeStakeRewardPolicy420",
    "ComputeStakeRewardAccounting420",
    "ComputeVerifierDisputeStakeEvidence420",
    "ComputeVerifierDisputeStakeIntegration420",
    "ComputeWorkerStake420",
    "ComputeVerifierDisputeSlashRecipientResolver420",
    "ComputeStakeReleaseCandidateWiring420",
]

EXPECTED_GATES = [
    "cmp_1_5_0_architecture",
    "cmp_1_5_1_worker_collateral",
    "cmp_1_5_2_verifier_collateral",
    "cmp_1_5_3_policy_minimums",
    "cmp_1_5_4_exit_queue",
    "cmp_1_5_5_objective_slash_authorization",
    "cmp_1_5_6_slash_distribution",
    "cmp_1_5_7_reward_accounting",
    "cmp_1_5_8_dispute_stake_integration",
    "cmp_1_5_9_worker_registry_stake_source",
    "cmp_1_5_10_compute_escrow_slash_redistribution",
    "cmp_1_5_11_hostile_economic_qualification",
]

def fail(msg):
    print("CMP-1.5.12 release-candidate verification failed: " + msg, file=sys.stderr)
    raise SystemExit(1)

def is_hex(value, nbytes):
    return isinstance(value, str) and re.fullmatch(r"0x[0-9a-fA-F]{%d}" % (2*nbytes), value) is not None

def load():
    return json.loads(CFG.read_text(encoding="utf-8"))

def repository_ready(d, allow_live=False):
    if d.get("step") != "CMP-1.5.12" or d.get("canonical_definition") != "Release candidate":
        fail("step/definition drift")
    if d.get("repository_ready") is not True:
        fail("repository_ready must be true")
    if not allow_live and d.get("live_qualified") is not False:
        fail("repository mode must remain live-blocked")

    rc = d.get("release_candidate", {})
    if rc.get("wiring_contract") != "contracts/src/compute/ComputeStakeReleaseCandidateWiring420.sol":
        fail("wiring contract drift")
    components = rc.get("components", [])
    if [x.get("role") for x in components] != EXPECTED_ROLES:
        fail("release component inventory/order drift")
    for x in components:
        source = ROOT / x.get("source", "")
        if not source.is_file():
            fail(f"missing source for {x.get('role')}")
        if not allow_live:
            for k in ("address","deployment_tx","deployment_block","runtime_code_hash"):
                if x.get(k) is not None:
                    fail(f"{x.get('role')}: fabricated live field {k}")
    if not allow_live and rc.get("graph_hash") is not None:
        fail("repository mode must not fabricate graph hash")

    reg = d.get("protocol_registry", {})
    if reg.get("address") != "0x0000000000000000000000000000000000000434":
        fail("ProtocolRegistry address drift")
    if reg.get("publication_api") != "publishRegisteredService":
        fail("ProtocolRegistry publication API drift")
    if not allow_live:
        if reg.get("publication_complete") is not False:
            fail("repository mode must remain unpublished")
        if reg.get("service_entries"):
            fail("repository mode must not fabricate service entries")

    deps = d.get("dependency_reconciliation", {})
    for k in (
        "canonical_compute_collateral_required",
        "validator_stake_is_not_compute_collateral",
        "wallet_balance_is_not_compute_collateral",
        "payer_escrow_is_not_compute_collateral",
        "reward_backing_is_separate_from_collateral",
        "no_fixed_genesis_predeploy_allocated",
        "cmp_1_5_repository_complete_through_1_5_11",
    ):
        if deps.get(k) is not True:
            fail(f"dependency gate {k} must be true")
    if deps.get("discovery_path") != "ProtocolRegistry":
        fail("discovery path drift")

    gates = d.get("release_gates", {})
    for k in EXPECTED_GATES:
        if gates.get(k) is not True:
            fail(f"repository gate {k} must be true")
    if not allow_live:
        for k in ("public_testnet_live","live_deployment","protocol_registry_publication"):
            if gates.get(k) is not False:
                fail(f"live gate {k} must remain false")
        for k in ("public_testnet_available","live_compute_stake_deployment_qualified","protocol_registry_publication_complete"):
            if deps.get(k) is not False:
                fail(f"live dependency {k} must remain false")

    milestone = d.get("milestone_relationship", {})
    if milestone.get("preceding_level_2_step") != "CMP-1.5.11":
        fail("preceding Level 2 step drift")
    if milestone.get("level_2_required_now") is not False:
        fail("unexpected additional Level 2 requirement")

    wiring = WIRING.read_text(encoding="utf-8")
    for needle in (
        "contract ComputeStakeReleaseCandidateWiring420",
        "releaseGraphHash",
        "sourceBinding.sourceCodeHash != g.workerCollateral.runtimeCodeHash",
        "resolver.canonicalEntitlementsCodeHash() != g.canonicalEntitlements.runtimeCodeHash",
        "auth.distributionExecutor() != g.distribution.implementation",
        "wc.workerRegistry() != g.workerRegistry.implementation",
        "vc.verifiers() != g.verifierRegistry.implementation",
        "rewards.rewardVault() != g.rewardVault.implementation",
        "g.rewardVault.implementation == g.workerCollateralVault.implementation",
    ):
        if needle not in wiring:
            fail(f"wiring missing {needle}")

    tests = TEST.read_text(encoding="utf-8")
    for needle in (
        "testExactReleaseGraphIsAccepted",
        "testWrongRuntimeCodeHashFailsClosed",
        "testMismatchedDistributionExecutorFailsClosed",
        "testWorkerStakeCrossRegistryBindingFailsClosed",
        "testRewardVaultCannotAliasCollateralVault",
    ):
        if needle not in tests:
            fail(f"release test missing {needle}")

    doc = DOC.read_text(encoding="utf-8")
    for needle in (
        "REPOSITORY-READINESS QUALIFICATION PENDING",
        "LIVE DEPLOYMENT BLOCKED",
        "publishRegisteredService",
        "CMP-1.5.13 — Phase closeout",
    ):
        if needle not in doc:
            fail(f"release doc missing {needle}")

    roadmap = ROADMAP.read_text(encoding="utf-8")
    if "### CMP-1.5.12 — Release candidate" not in roadmap:
        fail("roadmap missing CMP-1.5.12")

    print("CMP-1.5.12 ComputeStake release package: READY / LIVE BLOCKED")

def live_ready(d):
    repository_ready(d, allow_live=True)
    if d.get("live_qualified") is not True or d.get("status") != "LIVE_QUALIFIED":
        fail("live qualification not asserted")
    deps = d["dependency_reconciliation"]
    gates = d["release_gates"]
    if deps.get("public_testnet_available") is not True:
        fail("public testnet unavailable")
    if deps.get("live_compute_stake_deployment_qualified") is not True:
        fail("live ComputeStake deployment unqualified")
    if deps.get("protocol_registry_publication_complete") is not True:
        fail("ProtocolRegistry publication incomplete")
    for k in ("public_testnet_live","live_deployment","protocol_registry_publication"):
        if gates.get(k) is not True:
            fail(f"live gate {k} not open")

    net = d["network"]
    if not isinstance(net.get("chain_id"), int) or net["chain_id"] <= 0:
        fail("missing chain id")
    if not net.get("network_name"):
        fail("missing network name")
    if not isinstance(net.get("rpc_evidence_block"), int):
        fail("missing evidence block")
    if not is_hex(net.get("rpc_evidence_block_hash"), 32):
        fail("invalid evidence block hash")

    for x in d["release_candidate"]["components"]:
        if not is_hex(x.get("address"), 20):
            fail(f"{x['role']}: invalid address")
        if not is_hex(x.get("deployment_tx"), 32):
            fail(f"{x['role']}: invalid deployment tx")
        if not isinstance(x.get("deployment_block"), int):
            fail(f"{x['role']}: missing deployment block")
        if not is_hex(x.get("runtime_code_hash"), 32):
            fail(f"{x['role']}: invalid runtime hash")
    if not is_hex(d["release_candidate"].get("graph_hash"), 32):
        fail("missing release graph hash")
    for k, v in d["bindings"].items():
        if not is_hex(v, 20):
            fail(f"invalid live binding {k}")
    if not d["protocol_registry"].get("service_entries"):
        fail("missing ProtocolRegistry service entries")
    print("CMP-1.5.12 live ComputeStake release readiness: PASS")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repository-ready", action="store_true")
    args = ap.parse_args()
    d = load()
    repository_ready(d) if args.repository_ready else live_ready(d)

if __name__ == "__main__":
    main()

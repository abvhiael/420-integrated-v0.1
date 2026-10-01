#!/usr/bin/env python3
from pathlib import Path
import json, sys

root = Path(__file__).resolve().parents[1]
errors = []

matrix = json.loads((root/"contracts/config/interfaces/dependency-matrix.json").read_text())
model = json.loads((root/"contracts/config/interfaces/stake-dependency-model.json").read_text())
safety_semantics = json.loads((root/"contracts/config/interfaces/system-safety-semantics.json").read_text())
source = (root/"contracts/src/system/ValidatorRegistry.sol").read_text()
access = (root/"contracts/src/system/StakeDependencyAccess420.sol").read_text()
ids = (root/"contracts/src/libraries/StakeIds420.sol").read_text()
storage_init = json.loads((root/"contracts/config/predeploy/storage-init.json").read_text())
stake_genesis_config = json.loads((root/"contracts/config/predeploy/stake-genesis-config-v1.json").read_text())
validator_predeploy_state = json.loads((root/"contracts/config/predeploy/ValidatorRegistry-predeploy-state.json").read_text())
adr = (root/"docs/architecture/decisions/STAKE-AUDIT-1-INTERFACE-LAYER.md").read_text()

expected_runtime = ["ProtocolRegistry","GovernanceAuthority","SystemSafety","GenesisInitialization"]
if matrix.get("dependencies", {}).get("420Stake") != expected_runtime:
    errors.append("420Stake runtime dependency matrix does not match STAKE-AUDIT-1 decision")
if model.get("normative_runtime_dependencies") != expected_runtime:
    errors.append("stake dependency model runtime set does not match matrix")

legacy = {
    "ProtocolRegistry","GovernanceAuthority","PauseRegistry","HealthRegistry",
    "IdentityCredentials","CapabilityRegistry","SystemSafety","GenesisInitialization",
    "Migration","SignedEnvelope","ReplayProtection","ChainContext","MetadataCommitment"
}
decisions = model.get("decisions", [])
seen = {d.get("dependency") for d in decisions}
if seen != legacy:
    errors.append(f"dependency classification mismatch: expected {sorted(legacy)}, got {sorted(seen)}")

by_name = {d["dependency"]: d for d in decisions if "dependency" in d}
for dep in ("ProtocolRegistry","SystemSafety"):
    if by_name.get(dep, {}).get("classification") != "REQUIRED_DIRECT":
        errors.append(f"{dep} must be REQUIRED_DIRECT")
if by_name.get("GovernanceAuthority", {}).get("classification") != "REQUIRED_DIRECT_EXISTING_AUTHORITY":
    errors.append("GovernanceAuthority classification mismatch")
if by_name.get("GenesisInitialization", {}).get("classification") != "REQUIRED_DIRECT_INTROSPECTION":
    errors.append("GenesisInitialization classification mismatch")

stake_examples = safety_semantics.get("examples", {}).get("420Stake", {})
if stake_examples != {"new_activation":"NORMAL_ONLY","mature_withdrawal":"WITHDRAWAL_ONLY"}:
    errors.append("frozen 420Stake SystemSafety semantics changed")

for token in [
    'import "./StakeDependencyAccess420.sol";',
    "StakeDependencyAccess420",
    "_requireStakeActivationAllowed();",
    "_requireStakeWithdrawalAllowed();",
    "constructor(address timelock_, address registry_, bytes32 genesisConfigHash_)",
]:
    if token not in source:
        errors.append(f"ValidatorRegistry missing interface-layer token: {token}")

for token in [
    "IProtocolRegistry420","ISystemSafety420","IGenesisInitializable420",
    "ref.lifecycle != Types420.Lifecycle.ACTIVE",
    "ref.implementation.codehash != ref.runtimeCodeHash",
    "ActionClass.NORMAL_ONLY","ActionClass.WITHDRAWAL_ONLY",
]:
    if token not in access:
        errors.append(f"StakeDependencyAccess420 missing guard token: {token}")

for token in ("VALIDATOR_REGISTRY","ACTION_ACTIVATE","ACTION_WITHDRAW"):
    if token not in ids:
        errors.append(f"StakeIds420 missing {token}")

entry = storage_init.get("entries", {}).get("ValidatorRegistry", {})
if entry.get("constructor", []) != ["governance_timelock","ProtocolRegistry@0x0434","stake_genesis_config_hash"]:
    errors.append("ValidatorRegistry predeploy constructor or materialization inputs are stale")
stake_hash = storage_init.get("stake_genesis_config_hash")
state_hash = validator_predeploy_state.get("genesisConfigHash")
constructor_hash = validator_predeploy_state.get("constructorArguments", {}).get("genesisConfigHash")
if stake_genesis_config.get("schema") != "420-stake-genesis-config-v1":
    errors.append("stake genesis config provenance schema missing")
if stake_genesis_config.get("authority") != "offline_genesis_configuration_not_live_deployment_evidence":
    errors.append("stake genesis config provenance authority mismatch")
if not isinstance(stake_hash, str) or not stake_hash.startswith("0x") or len(stake_hash) != 66:
    errors.append("stake genesis config hash is not materialized")
elif stake_hash != state_hash or stake_hash != constructor_hash:
    errors.append("stake genesis config hash provenance mismatch across storage-init and ValidatorRegistry predeploy state")

if "SystemSafety" not in adr or "WITHDRAWAL_ONLY" not in adr or "CONSENSUS_OWNED" not in adr:
    errors.append("STAKE-AUDIT-1 ADR missing canonical decisions")

out = {
    "pass": not errors,
    "errors": errors,
    "runtime_dependencies": matrix.get("dependencies", {}).get("420Stake"),
    "classified_dependencies": len(decisions),
    "system_safety": stake_examples,
}
print(json.dumps(out, indent=2))
sys.exit(0 if not errors else 2)

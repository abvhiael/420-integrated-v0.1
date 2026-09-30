#!/usr/bin/env python3
from pathlib import Path
import json, sys

root = Path(__file__).resolve().parents[1]
errors = []

matrix = json.loads((root/"contracts/config/interfaces/dependency-matrix.json").read_text())
model = json.loads((root/"contracts/config/interfaces/names-dependency-model.json").read_text())
source = (root/"contracts/src/apps/Names420.sol").read_text()
adr = (root/"docs/architecture/decisions/NAMES-AUDIT-2-DEPENDENCY-MODEL.md").read_text()

expected_direct = ["GovernanceAuthority"]
if matrix.get("dependencies", {}).get("420Names") != expected_direct:
    errors.append("420Names runtime dependency matrix must be exactly GovernanceAuthority")

legacy = {
    "ProtocolRegistry","GovernanceAuthority","PauseRegistry","CapabilityRegistry",
    "SystemSafety","GenesisInitialization","Migration","SignedEnvelope",
    "ReplayProtection","ChainContext","MetadataCommitment"
}
decisions = model.get("decisions", [])
seen = {d.get("dependency") for d in decisions}
if seen != legacy:
    errors.append(f"dependency classification mismatch: expected {sorted(legacy)}, got {sorted(seen)}")

if model.get("normative_runtime_dependencies") != expected_direct:
    errors.append("names dependency model runtime set does not match matrix")

by_name = {d["dependency"]: d for d in decisions if "dependency" in d}
if by_name.get("GovernanceAuthority", {}).get("classification") != "REQUIRED_DIRECT":
    errors.append("GovernanceAuthority must be REQUIRED_DIRECT")
if by_name.get("GenesisInitialization", {}).get("classification") != "REQUIRED_INDIRECT":
    errors.append("GenesisInitialization must remain REQUIRED_INDIRECT")
if by_name.get("ProtocolRegistry", {}).get("classification") != "OPTIONAL_INTEGRATION":
    errors.append("ProtocolRegistry must be OPTIONAL_INTEGRATION")
if by_name.get("ReplayProtection", {}).get("classification") != "LOCAL_MECHANISM":
    errors.append("ReplayProtection must be LOCAL_MECHANISM")

if 'import "../system/SystemAccess.sol";' not in source:
    errors.append("Names420 must retain SystemAccess")
if "constructor(address timelock_) SystemAccess(timelock_)" not in source:
    errors.append("Names420 constructor must bind governance timelock")

for forbidden in [
    "IProtocolRegistry420","IPauseRegistry420","ICapabilityRegistry420",
    "ISystemSafety420","IGenesisInitializable420","IMigration420",
    "ISignedEnvelope420","IReplayProtection420","IChainContext420",
    "IMetadataCommitment420"
]:
    if forbidden in source:
        errors.append(f"unexpected removed runtime dependency in Names420: {forbidden}")

if "GovernanceAuthority" not in adr or "REQUIRED_INDIRECT" not in adr:
    errors.append("dependency ADR missing canonical classifications")

out = {
    "pass": not errors,
    "errors": errors,
    "runtime_dependencies": matrix.get("dependencies", {}).get("420Names"),
    "classified_dependencies": len(decisions),
}
print(json.dumps(out, indent=2))
sys.exit(0 if not errors else 2)

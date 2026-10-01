#!/usr/bin/env python3
from pathlib import Path
import json
import sys

root = Path(__file__).resolve().parents[1]
errors = []

matrix_path = root / "contracts/config/interfaces/dependency-matrix.json"
recon_path = root / "contracts/config/interfaces/identity-dependency-reconciliation.json"
identity_path = root / "contracts/src/apps/Identity420.sol"
system_access_path = root / "contracts/src/system/SystemAccess.sol"
layer_path = root / "contracts/config/interfaces/genesis-interface-layer.json"
predeploy_path = root / "contracts/config/predeploy/predeploy-plan.json"

for path in [matrix_path, recon_path, identity_path, system_access_path, layer_path, predeploy_path]:
    if not path.exists():
        errors.append(f"missing {path.relative_to(root)}")

if errors:
    print(json.dumps({"pass": False, "errors": errors}, indent=2))
    sys.exit(2)

matrix = json.loads(matrix_path.read_text())
recon = json.loads(recon_path.read_text())
layer = json.loads(layer_path.read_text())
predeploy = json.loads(predeploy_path.read_text())
identity = identity_path.read_text()
system_access = system_access_path.read_text()

if recon.get("schema") != "420-identity-dependency-reconciliation-v1":
    errors.append("identity dependency reconciliation schema drift")
if recon.get("component") != "420Identity":
    errors.append("identity dependency reconciliation component drift")

entries = recon.get("classifications", [])
by_name = {entry.get("dependency"): entry for entry in entries}
expected_names = {
    "ProtocolRegistry",
    "GovernanceAuthority",
    "PauseRegistry",
    "CapabilityRegistry",
    "SystemSafety",
    "GenesisInitialization",
    "Migration",
    "SignedEnvelope",
    "ReplayProtection",
    "ChainContext",
    "MetadataCommitment",
}
if set(by_name) != expected_names:
    errors.append("classification set does not exactly cover original 420Identity dependency claims")

allowed = {"REQUIRED", "OPTIONAL", "NOT_APPLICABLE"}
for name, entry in by_name.items():
    if entry.get("classification") not in allowed:
        errors.append(f"{name}: invalid classification")
    if not entry.get("rationale"):
        errors.append(f"{name}: missing rationale")
    if not entry.get("disposition"):
        errors.append(f"{name}: missing disposition")

required = sorted(
    name for name, entry in by_name.items()
    if entry.get("classification") == "REQUIRED"
)
matrix_required = sorted(matrix.get("dependencies", {}).get("420Identity", []))
if required != ["GovernanceAuthority"]:
    errors.append(f"unexpected required Identity dependencies: {required}")
if matrix_required != required:
    errors.append(
        f"dependency-matrix 420Identity row {matrix_required} does not match classified required set {required}"
    )

if "SystemAccess" not in identity:
    errors.append("Identity420 no longer uses SystemAccess")
if "onlyGovernance" not in identity:
    errors.append("Identity420 missing governance-only issuer mutation guard")
if "governanceTimelock" not in system_access or "msg.sender != governanceTimelock" not in system_access:
    errors.append("SystemAccess governance timelock binding missing")

for forbidden in [
    "IProtocolRegistry420",
    "IPauseRegistry420",
    "ICapabilityRegistry420",
    "ISystemSafety420",
    "IGenesisInitializable420",
    "IMigration420",
    "ISignedEnvelope420",
    "IReplayProtection420",
    "IChainContext420",
    "IMetadataCommitment420",
]:
    if forbidden in identity:
        errors.append(f"Identity420 unexpectedly imports/uses optional or N/A runtime dependency {forbidden}")

if "IIdentityCredential420" not in identity:
    errors.append("Identity420 frozen credential interface compatibility missing")
if "CredentialIssued" not in identity or "CredentialRevoked" not in identity or "CredentialRejected" not in identity:
    errors.append("Identity credential lifecycle events missing")

if layer.get("status") != "FROZEN_V1_0" or layer.get("version") != "1.0.0":
    errors.append("frozen Genesis interface layer status/version drift")
for interface_name in [
    "IProtocolRegistry420",
    "IGovernanceAuthority420",
    "IPauseRegistry420",
    "ICapabilityRegistry420",
    "IGenesisInitializable420",
    "IMigration420",
    "ISystemSafety420",
    "ISignedEnvelope420",
    "IReplayProtection420",
    "IMetadataCommitment420",
    "IChainContext420",
]:
    if interface_name not in layer.get("shared_interfaces", []):
        errors.append(f"frozen shared interface removed: {interface_name}")

identity_predeploy = None
for item in predeploy.get("predeploys", []):
    if item.get("name") == "Identity420":
        identity_predeploy = item
        break
if identity_predeploy is None:
    errors.append("Identity420 predeploy entry missing")
else:
    if identity_predeploy.get("address", "").lower() != "0x0000000000000000000000000000000000000436":
        errors.append("Identity420 frozen address drift")
    if identity_predeploy.get("source") != "apps/Identity420.sol":
        errors.append("Identity420 predeploy source drift")

out = {
    "pass": not errors,
    "errors": errors,
    "component": "420Identity",
    "required_dependencies": required,
    "optional_dependencies": sorted(
        name for name, entry in by_name.items()
        if entry.get("classification") == "OPTIONAL"
    ),
    "not_applicable_dependencies": sorted(
        name for name, entry in by_name.items()
        if entry.get("classification") == "NOT_APPLICABLE"
    ),
    "frozen_interface_layer": layer.get("status"),
    "identity_address": identity_predeploy.get("address") if identity_predeploy else None,
}
print(json.dumps(out, indent=2))
sys.exit(0 if not errors else 2)

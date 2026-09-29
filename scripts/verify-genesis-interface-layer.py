#!/usr/bin/env python3
from pathlib import Path
import hashlib,json,sys

root=Path(__file__).resolve().parents[1]
errors=[]

base=root/"contracts/src/interfaces/genesis"
layer_path=root/"contracts/config/interfaces/genesis-interface-layer.json"
freeze_path=root/"contracts/config/interfaces/interface-layer-v1-freeze.json"
matrix_path=root/"contracts/config/interfaces/dependency-matrix.json"

for p in [layer_path,freeze_path,matrix_path]:
    if not p.exists(): errors.append("missing "+str(p.relative_to(root)))

if errors:
    print(json.dumps({"pass":False,"errors":errors},indent=2)); sys.exit(2)

layer=json.loads(layer_path.read_text())
freeze=json.loads(freeze_path.read_text())
matrix=json.loads(matrix_path.read_text())

if layer.get("status")!="FROZEN_V1_0": errors.append("layer status must be FROZEN_V1_0")
if layer.get("version")!="1.0.0": errors.append("layer version must be 1.0.0")
if freeze.get("status")!="FROZEN": errors.append("freeze status must be FROZEN")
if freeze.get("version")!="1.0.0": errors.append("freeze version must be 1.0.0")

layer_interfaces=layer.get("shared_interfaces",[])
freeze_interfaces=freeze.get("shared_interfaces",[])
if layer_interfaces!=freeze_interfaces: errors.append("layer/freeze shared interface lists differ")
if len(layer_interfaces)!=25: errors.append(f"expected 25 frozen shared interfaces, got {len(layer_interfaces)}")

for name in layer_interfaces:
    p=base/(name+".sol")
    if not p.exists(): errors.append("missing interface "+name)

required=[
    "IGenesisResident420","IProtocolRegistry420","ICanonicalAssetRegistry420",
    "IGovernanceAuthority420","IPauseRegistry420","IHealthRegistry420",
    "IOracle420","IIdentityCredential420","INames420","ISettlementHealth420",
    "IFeeQuote420","ISigningDomain420","IAccounting420","ICapabilityRegistry420",
    "ICustodyVault420","IGenesisInitializable420","IMigration420","ISystemSafety420",
    "ISignedEnvelope420","IReplayProtection420","IExternalDependencyRegistry420",
    "IRiskLimits420","IAssetCapabilities420","IMetadataCommitment420","IChainContext420"
]
if layer_interfaces!=required:
    errors.append("frozen shared interface order/content differs from v1.0 manifest")

for suite in ["420Pay","420Swap","420Bridge","420Stake","420Governance","420AI"]:
    if suite not in matrix.get("dependencies",{}): errors.append("missing dependency matrix suite "+suite)
    elif "ProtocolRegistry" not in matrix["dependencies"][suite]:
        errors.append(suite+" does not depend on ProtocolRegistry")

iface=base/"IProtocolRegistry420.sol"
iface_sha=hashlib.sha256(iface.read_bytes()).hexdigest() if iface.exists() else None
expected_iface_sha="ba08070073f1237ebae0daf7a22dafcd0b9b9f2da68e63bb52cb58301f564224"
if iface_sha!=expected_iface_sha:
    errors.append("IProtocolRegistry420 frozen v1 hash mismatch")

out={
    "pass":not errors,
    "errors":errors,
    "status":layer.get("status"),
    "version":layer.get("version"),
    "interfaces":len(layer_interfaces),
    "dependency_suites":len(matrix.get("dependencies",{})),
    "protocol_registry_interface_sha256":iface_sha
}
(root/"contracts/config/interfaces/verification.json").write_text(json.dumps(out,indent=2)+"\n")
print(json.dumps(out,indent=2))
sys.exit(0 if not errors else 2)

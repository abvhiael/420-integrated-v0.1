#!/usr/bin/env python3
from pathlib import Path
import json,sys

root=Path(__file__).resolve().parents[1]
errors=[]

required=[
"ISignedEnvelope420.sol","IReplayProtection420.sol","IExternalDependencyRegistry420.sol",
"IRiskLimits420.sol","IAssetCapabilities420.sol","IMetadataCommitment420.sol","IChainContext420.sol"
]
base=root/"contracts/src/interfaces/genesis"
for f in required:
    if not (base/f).exists(): errors.append("missing "+f)

layer=json.loads((root/"contracts/config/interfaces/genesis-interface-layer.json").read_text())
if layer.get("status")!="FROZEN_V1_0": errors.append("layer not frozen")
if layer.get("version")!="1.0.0": errors.append("version")
for i in required:
    n=i.removesuffix(".sol")
    if n not in layer["shared_interfaces"]: errors.append("interface registry "+n)

freeze=json.loads((root/"contracts/config/interfaces/interface-layer-v1-freeze.json").read_text())
if freeze["status"]!="FROZEN": errors.append("freeze manifest")

asset=json.loads((root/"contracts/config/interfaces/asset-semantics.json").read_text())
if asset["native_420"]["decimals"]!=18: errors.append("native decimals")
if asset["native_420"]["token_address"]!="0x0000000000000000000000000000000000000000":
    errors.append("native token representation")

out={
    "pass":not errors,
    "errors":errors,
    "version":"1.0.0",
    "shared_interfaces":len(layer["shared_interfaces"]),
    "frozen_policies":len(layer["frozen_policies"])
}
(root/"contracts/config/interfaces/v1-freeze-verification.json").write_text(json.dumps(out,indent=2)+"\n")
print(json.dumps(out,indent=2))
sys.exit(0 if not errors else 2)

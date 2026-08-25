#!/usr/bin/env python3
from pathlib import Path
import json, hashlib, datetime

root=Path(__file__).resolve().parents[1]
outdir=root/"contracts/out"
artifact_dir=root/"artifacts/contracts"
artifact_dir.mkdir(parents=True,exist_ok=True)

contracts=[]
if outdir.exists():
    for p in sorted(outdir.rglob("*.json")):
        try:
            obj=json.loads(p.read_text())
        except Exception:
            continue
        deployed=(obj.get("deployedBytecode") or {}).get("object")
        creation=(obj.get("bytecode") or {}).get("object")
        abi=obj.get("abi")
        if not deployed or not isinstance(deployed,str) or deployed in ("0x",""):
            continue
        raw=bytes.fromhex(deployed.removeprefix("0x"))
        contracts.append({
            "artifact":str(p.relative_to(root)),
            "contractName":obj.get("contractName") or p.stem,
            "runtimeBytecodeSha256":hashlib.sha256(raw).hexdigest(),
            "runtimeBytecodeBytes":len(raw),
            "creationBytecodeBytes":len(bytes.fromhex(creation.removeprefix("0x"))) if isinstance(creation,str) and creation not in ("","0x") else 0,
            "abiPresent":abi is not None
        })

manifest={
    "schema":"420-contract-build-manifest-v1",
    "generatedAtUTC":datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "contracts":contracts
}
(artifact_dir/"contract-build-manifest.json").write_text(json.dumps(manifest,indent=2)+"\n")
print(json.dumps({"contracts":len(contracts),"manifest":str(artifact_dir/"contract-build-manifest.json")},indent=2))

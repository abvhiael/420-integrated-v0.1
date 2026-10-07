#!/usr/bin/env python3
import pathlib,re,sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from puffbuddies.integrations.ecosystem import SERVICE_IDS,CONTRACTS

source=(ROOT/"contracts/src/libraries/ServiceIds420.sol").read_text()
pairs=dict(re.findall(r'bytes32 internal constant ([A-Z0-9_]+) = keccak256\("([^"]+)"\);',source))
expected={
 "420Wallet":pairs.get("WALLET"),"420Identity":pairs.get("IDENTITY"),"420Names":pairs.get("NAMES"),
 "420Messenger":pairs.get("MESSENGER"),"420Notifications":pairs.get("NOTIFICATIONS"),"420Pay":pairs.get("PAY"),
 "420Registry":pairs.get("PROTOCOL_REGISTRY"),"420AppStore":pairs.get("APPSTORE"),"420Analytics":pairs.get("ANALYTICS"),
 "420Explorer":pairs.get("EXPLORER"),"420Search":pairs.get("SEARCH"),"420Verify":pairs.get("VERIFY"),
}
errors=[]
for name,value in expected.items():
    if not value: errors.append(f"ServiceIds420 missing {name}")
    elif SERVICE_IDS.get(name)!=value: errors.append(f"{name} service id drift: {SERVICE_IDS.get(name)} != {value}")
if CONTRACTS["420Indexer"].service_id is not None:
    errors.append("420Indexer must not be assigned a fabricated Registry service id")
if any("puff" in str(v).lower() for v in SERVICE_IDS.values()):
    errors.append("PB-13 must not invent a PuffBuddies service id")
if errors:
    print("\n".join(errors),file=sys.stderr);raise SystemExit(1)
print("PB-13 canonical service identity verification: PASS")

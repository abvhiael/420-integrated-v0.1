#!/usr/bin/env python3
import json, pathlib, sys
root=pathlib.Path(__file__).resolve().parents[1]
errors=[]
decision=json.loads((root/"config/genesis-applications.json").read_text())
mapping=json.loads((root/"contracts/config/genesis-dapp-contract-map.json").read_text())
if decision.get("status")!="FROZEN": errors.append("genesis application decision not frozen")
if len(decision.get("apps",[]))!=13: errors.append("expected 13 entries including testnet faucet")
mapped={x["dapp"]:x for x in mapping["apps"]}
for app in decision["apps"]:
    n=app["name"]
    if n not in mapped: errors.append("missing dapp map: "+n)
    elif app.get("contracts_required") and not mapped[n].get("contracts"):
        errors.append("missing contracts for "+n)

files=[
 "contracts/src/apps/ProtocolRegistry.sol",
 "contracts/src/apps/Names420.sol",
 "contracts/src/apps/Identity420.sol",
 "contracts/src/apps/Stake420.sol",
 "contracts/src/governance/GovernanceTimelock.sol",
 "contracts/src/governance/Governance420.sol",
 "contracts/src/bridge/VerifiedGateway420.sol",
 "contracts/src/swap/ApprovedQuoteAssetRegistry.sol",
 "contracts/src/swap/GenesisDEXFactory.sol",
 "contracts/src/swap/TWAPOracle.sol",
 "contracts/src/swap/PublicBatchAuction.sol",
 "contracts/src/testnet/TestnetFaucet420.sol",
]
for f in files:
    if not (root/f).exists(): errors.append("missing "+f)

# Wallet/explorer/status must remain contract-free in map.
for n in ["420 Wallet","420 Explorer","420 Status"]:
    if mapped[n].get("contracts"): errors.append(n+" should not have required protocol state contract")

stake=(root/"contracts/src/apps/Stake420.sol").read_text()
if "delegationEnabled() external pure returns (bool) { return false; }" not in stake:
    errors.append("stake delegation invariant missing")

faucet=(root/"contracts/src/testnet/TestnetFaucet420.sol").read_text()
if "TESTNET ONLY" not in faucet or "42 ether" not in faucet:
    errors.append("testnet faucet invariant missing")

bridge=(root/"contracts/src/bridge/VerifiedGateway420.sol").read_text()
if "consumedDeposits" not in bridge or "_requireOperational" not in bridge or "IVerifiedGatewayVerifier420" not in bridge or "IReplayProtection420" not in bridge:
    errors.append("bridge verification/replay/shared-safety invariant missing")

reg=(root/"contracts/src/apps/ProtocolRegistry.sol").read_text()
if "codeHash" not in reg or "metadataHash" not in reg or "version" not in reg:
    errors.append("protocol registry canonical metadata fields missing")

out={"pass":not errors,"errors":errors,"genesis_apps":12,"testnet_only_apps":1}
(root/"contracts/config/genesis-dapp-verification.json").write_text(json.dumps(out,indent=2)+"\n")
print(json.dumps(out,indent=2))
sys.exit(0 if not errors else 2)

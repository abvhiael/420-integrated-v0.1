#!/usr/bin/env python3
import json, pathlib, sys
root=pathlib.Path(__file__).resolve().parents[1]
errors=[]
decision=json.loads((root/"config/genesis-applications.json").read_text())
mapping=json.loads((root/"contracts/config/genesis-dapp-contract-map.json").read_text())
if decision.get("status")!="FROZEN": errors.append("genesis application decision not frozen")
if len(decision.get("apps",[]))!=14: errors.append("expected 14 entries including testnet faucet")
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
 "contracts/config/420explorer-genesis.json",
 "docs/420EXPLORER.md",
 "contracts/config/420search-genesis.json",
 "docs/420SEARCH.md",
 "testnet/public-services/search/readiness.json",
]
for f in files:
    if not (root/f).exists(): errors.append("missing "+f)

# Client/indexer surfaces must remain contract-free in map.
for n in ["420 Wallet","420 Explorer","420 Search","420 Status"]:
    if mapped[n].get("contracts"): errors.append(n+" should not have required protocol state contract")

explorer_path=root/"contracts/config/420explorer-genesis.json"
if explorer_path.exists():
    explorer=json.loads(explorer_path.read_text())
    if explorer.get("contractsRequired") is not False: errors.append("explorer must remain contract-free")
    if explorer.get("canonicalStateAuthority") is not False: errors.append("explorer must remain non-canonical")
    indexing=explorer.get("indexing",{})
    if not indexing.get("tracksHeadSafeFinalizedSeparately"): errors.append("explorer finality distinction missing")
    if not indexing.get("rebuildableFromChain"): errors.append("explorer rebuildability invariant missing")
    if not indexing.get("databaseIsNonCanonical"): errors.append("explorer database authority invariant missing")
    sources=explorer.get("sources",{})
    if sources.get("protocolDiscovery")!="420Registry / ProtocolRegistry": errors.append("explorer registry discovery binding missing")
    inv="\n".join(explorer.get("invariants",[]))
    for required in ["EXP-INV-001", "EXP-INV-004", "EXP-INV-005", "EXP-INV-008", "EXP-INV-009"]:
        if required not in inv: errors.append("missing explorer invariant "+required)

search_path=root/"contracts/config/420search-genesis.json"
if search_path.exists():
    search=json.loads(search_path.read_text())
    if search.get("contractsRequired") is not False: errors.append("search must remain contract-free")
    if search.get("canonicalStateAuthority") is not False: errors.append("search must remain non-canonical")
    if search.get("serviceId")!="420/service/search/v1": errors.append("search canonical service id missing")
    indexing=search.get("indexing",{})
    if not indexing.get("databaseIsNonCanonical"): errors.append("search database authority invariant missing")
    if not indexing.get("rebuildableFromCanonicalSources"): errors.append("search rebuildability invariant missing")
    if not indexing.get("recordsCarrySourceAuthority"): errors.append("search source provenance invariant missing")
    if not indexing.get("deterministicPagination"): errors.append("search deterministic pagination invariant missing")
    ranking=search.get("ranking",{})
    if not ranking.get("rankingIsNonCanonical"): errors.append("search ranking authority invariant missing")
    if not ranking.get("sponsoredResultsMustBeExplicitlyLabeled"): errors.append("search sponsored labeling invariant missing")
    privacy=search.get("privacy",{})
    for key in ["privateMessengerContentIndexed","privateCommonsContentIndexed","rawAttentionTelemetryIndexed","encryptedResourcePayloadsIndexed","privateIdentityDataIndexed"]:
        if privacy.get(key) is not False: errors.append("search privacy exclusion missing: "+key)
    inv="\n".join(search.get("invariants",[]))
    for required in ["SRCH-INV-001", "SRCH-INV-002", "SRCH-INV-004", "SRCH-INV-006", "SRCH-INV-007", "SRCH-INV-009", "SRCH-INV-010"]:
        if required not in inv: errors.append("missing search invariant "+required)

service_ids=(root/"contracts/src/libraries/ServiceIds420.sol").read_text()
if 'SEARCH = keccak256("420/service/search/v1")' not in service_ids:
    errors.append("search canonical ServiceIds420 entry missing")

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

out={"pass":not errors,"errors":errors,"genesis_apps":13,"testnet_only_apps":1,"explorer_profile":"420-explorer-genesis-v1","search_profile":"420-search-genesis-v1"}
(root/"contracts/config/genesis-dapp-verification.json").write_text(json.dumps(out,indent=2)+"\n")
print(json.dumps(out,indent=2))
sys.exit(0 if not errors else 2)

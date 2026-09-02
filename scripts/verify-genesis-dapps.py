#!/usr/bin/env python3
import json, pathlib, sys
root=pathlib.Path(__file__).resolve().parents[1]
errors=[]
decision=json.loads((root/"config/genesis-applications.json").read_text())
mapping=json.loads((root/"contracts/config/genesis-dapp-contract-map.json").read_text())
if decision.get("status")!="FROZEN": errors.append("genesis application decision not frozen")
if len(decision.get("apps",[]))!=16: errors.append("expected 16 entries including testnet faucet")
mapped={x["dapp"]:x for x in mapping["apps"]}
for app in decision["apps"]:
    n=app["name"]
    if n not in mapped: errors.append("missing dapp map: "+n)
    elif app.get("contracts_required") and not mapped[n].get("contracts"): errors.append("missing contracts for "+n)
files=["contracts/src/apps/ProtocolRegistry.sol","contracts/src/apps/Names420.sol","contracts/src/apps/Identity420.sol","contracts/src/apps/Stake420.sol","contracts/src/governance/GovernanceTimelock.sol","contracts/src/governance/Governance420.sol","contracts/src/bridge/VerifiedGateway420.sol","contracts/src/swap/ApprovedQuoteAssetRegistry.sol","contracts/src/swap/GenesisDEXFactory.sol","contracts/src/swap/TWAPOracle.sol","contracts/src/swap/PublicBatchAuction.sol","contracts/src/testnet/TestnetFaucet420.sol","contracts/config/420explorer-genesis.json","docs/420EXPLORER.md","contracts/config/420search-genesis.json","docs/420SEARCH.md","testnet/public-services/search/readiness.json","contracts/config/420analytics-genesis.json","docs/420ANALYTICS.md","testnet/public-services/analytics/readiness.json","contracts/config/420arbitration-genesis.json","docs/420ARBITRATION.md","contracts/src/arbitration/ArbitrationIds420.sol","contracts/src/arbitration/ArbitrationPolicyRegistry420.sol","contracts/src/arbitration/ArbitrationCaseRegistry420.sol","contracts/src/arbitration/ArbitrationRulingRegistry420.sol"]
for f in files:
    if not (root/f).exists(): errors.append("missing "+f)
for n in ["420 Wallet","420 Explorer","420 Search","420 Analytics","420 Status"]:
    if mapped[n].get("contracts"): errors.append(n+" should not have required protocol state contract")
explorer_path=root/"contracts/config/420explorer-genesis.json"
if explorer_path.exists():
    explorer=json.loads(explorer_path.read_text()); indexing=explorer.get("indexing",{}); sources=explorer.get("sources",{}); inv="\n".join(explorer.get("invariants",[]))
    if explorer.get("contractsRequired") is not False: errors.append("explorer must remain contract-free")
    if explorer.get("canonicalStateAuthority") is not False: errors.append("explorer must remain non-canonical")
    if not indexing.get("tracksHeadSafeFinalizedSeparately"): errors.append("explorer finality distinction missing")
    if not indexing.get("rebuildableFromChain"): errors.append("explorer rebuildability invariant missing")
    if not indexing.get("databaseIsNonCanonical"): errors.append("explorer database authority invariant missing")
    if sources.get("protocolDiscovery")!="420Registry / ProtocolRegistry": errors.append("explorer registry discovery binding missing")
    for required in ["EXP-INV-001","EXP-INV-004","EXP-INV-005","EXP-INV-008","EXP-INV-009"]:
        if required not in inv: errors.append("missing explorer invariant "+required)
search_path=root/"contracts/config/420search-genesis.json"
if search_path.exists():
    search=json.loads(search_path.read_text()); indexing=search.get("indexing",{}); ranking=search.get("ranking",{}); privacy=search.get("privacy",{}); inv="\n".join(search.get("invariants",[]))
    if search.get("contractsRequired") is not False: errors.append("search must remain contract-free")
    if search.get("canonicalStateAuthority") is not False: errors.append("search must remain non-canonical")
    if search.get("serviceId")!="420/service/search/v1": errors.append("search canonical service id missing")
    if not indexing.get("databaseIsNonCanonical") or not indexing.get("rebuildableFromCanonicalSources") or not indexing.get("recordsCarrySourceAuthority") or not indexing.get("deterministicPagination"): errors.append("search indexing invariant missing")
    if not ranking.get("rankingIsNonCanonical") or not ranking.get("sponsoredResultsMustBeExplicitlyLabeled"): errors.append("search ranking invariant missing")
    for key in ["privateMessengerContentIndexed","privateCommonsContentIndexed","rawAttentionTelemetryIndexed","encryptedResourcePayloadsIndexed","privateIdentityDataIndexed"]:
        if privacy.get(key) is not False: errors.append("search privacy exclusion missing: "+key)
    for required in ["SRCH-INV-001","SRCH-INV-002","SRCH-INV-004","SRCH-INV-006","SRCH-INV-007","SRCH-INV-009","SRCH-INV-010"]:
        if required not in inv: errors.append("missing search invariant "+required)
analytics_path=root/"contracts/config/420analytics-genesis.json"
if analytics_path.exists():
    ana=json.loads(analytics_path.read_text()); agg=ana.get("aggregation",{}); privacy=ana.get("privacy",{}); presentation=ana.get("presentation",{}); inv="\n".join(ana.get("invariants",[]))
    if ana.get("contractsRequired") is not False: errors.append("analytics must remain contract-free")
    if ana.get("canonicalStateAuthority") is not False: errors.append("analytics must remain non-canonical")
    if ana.get("serviceId")!="420/service/analytics/v1": errors.append("analytics canonical service id missing")
    for key in ["databaseIsNonCanonical","rebuildableFromCanonicalSources","metricsCarrySourceProvenance","metricsCarryWindowDefinition","metricsCarryChainId","tracksIndexedAndFinalizedHeights","reorgRepairOnlyForNonFinalizedData","historicalSnapshotsAreVersioned","derivedMetricsAreNonCanonical"]:
        if agg.get(key) is not True: errors.append("analytics aggregation invariant missing: "+key)
    for key in ["privateMessengerContentAggregated","privateCommonsContentAggregated","encryptedResourcePayloadsAggregated","privateIdentityFieldsAggregated","rawAttentionTelemetryAggregated","deanonymizationOrWalletProfilingByDefault"]:
        if privacy.get(key) is not False: errors.append("analytics privacy exclusion missing: "+key)
    if presentation.get("methodologiesMustBeDocumented") is not True or presentation.get("alternativeAnalyticsProvidersAllowed") is not True: errors.append("analytics methodology/replaceability invariant missing")
    for required in ["ANL-INV-001","ANL-INV-002","ANL-INV-003","ANL-INV-005","ANL-INV-007","ANL-INV-008","ANL-INV-009","ANL-INV-010"]:
        if required not in inv: errors.append("missing analytics invariant "+required)
arb_path=root/"contracts/config/420arbitration-genesis.json"
if arb_path.exists():
    arb=json.loads(arb_path.read_text()); model=arb.get("model",{}); inv="\n".join(arb.get("invariants",[]))
    if arb.get("serviceId")!="420/service/arbitration/v1": errors.append("arbitration canonical service id missing")
    for key in ["policyIsDomainScoped","policySnapshotAtCaseOpen","evidenceIsCommitmentBased","resolverIsExplicitlyBound","appealsAreBounded","finalRulingIsCommitmentNotExecution","originProtocolExecutesRemedyUnderOwnAuthority"]:
        if model.get(key) is not True: errors.append("arbitration model invariant missing: "+key)
    for required in ["ARB-INV-001","ARB-INV-002","ARB-INV-004","ARB-INV-006","ARB-INV-008","ARB-INV-009","ARB-INV-011"]:
        if required not in inv: errors.append("missing arbitration invariant "+required)
service_ids=(root/"contracts/src/libraries/ServiceIds420.sol").read_text()
if 'SEARCH = keccak256("420/service/search/v1")' not in service_ids: errors.append("search canonical ServiceIds420 entry missing")
if 'ANALYTICS = keccak256("420/service/analytics/v1")' not in service_ids: errors.append("analytics canonical ServiceIds420 entry missing")
if 'ARBITRATION = keccak256("420/service/arbitration/v1")' not in service_ids: errors.append("arbitration canonical ServiceIds420 entry missing")
stake=(root/"contracts/src/apps/Stake420.sol").read_text()
if "delegationEnabled() external pure returns (bool) { return false; }" not in stake: errors.append("stake delegation invariant missing")
faucet=(root/"contracts/src/testnet/TestnetFaucet420.sol").read_text()
if "TESTNET ONLY" not in faucet or "42 ether" not in faucet: errors.append("testnet faucet invariant missing")
bridge=(root/"contracts/src/bridge/VerifiedGateway420.sol").read_text()
if "consumedDeposits" not in bridge or "_requireOperational" not in bridge or "IVerifiedGatewayVerifier420" not in bridge or "IReplayProtection420" not in bridge: errors.append("bridge verification/replay/shared-safety invariant missing")
reg=(root/"contracts/src/apps/ProtocolRegistry.sol").read_text()
if "codeHash" not in reg or "metadataHash" not in reg or "version" not in reg: errors.append("protocol registry canonical metadata fields missing")
out={"pass":not errors,"errors":errors,"genesis_apps":15,"testnet_only_apps":1,"explorer_profile":"420-explorer-genesis-v1","search_profile":"420-search-genesis-v1","analytics_profile":"420-analytics-genesis-v1","arbitration_profile":"420-arbitration-genesis-v1"}
(root/"contracts/config/genesis-dapp-verification.json").write_text(json.dumps(out,indent=2)+"\n")
print(json.dumps(out,indent=2))
sys.exit(0 if not errors else 2)

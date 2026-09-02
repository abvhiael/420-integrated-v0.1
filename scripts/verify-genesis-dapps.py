#!/usr/bin/env python3
import json, pathlib, sys
root=pathlib.Path(__file__).resolve().parents[1]
errors=[]
decision=json.loads((root/"config/genesis-applications.json").read_text())
mapping=json.loads((root/"contracts/config/genesis-dapp-contract-map.json").read_text())
if decision.get("status")!="FROZEN": errors.append("genesis application decision not frozen")
if len(decision.get("apps",[]))!=17: errors.append("expected 17 entries including testnet faucet")
mapped={x["dapp"]:x for x in mapping["apps"]}
for app in decision["apps"]:
    n=app["name"]
    if n not in mapped: errors.append("missing dapp map: "+n)
    elif app.get("contracts_required") and not mapped[n].get("contracts"): errors.append("missing contracts for "+n)
files=["contracts/src/apps/ProtocolRegistry.sol","contracts/src/apps/Names420.sol","contracts/src/apps/Identity420.sol","contracts/src/apps/Stake420.sol","contracts/src/governance/GovernanceTimelock.sol","contracts/src/governance/Governance420.sol","contracts/src/bridge/VerifiedGateway420.sol","contracts/src/swap/ApprovedQuoteAssetRegistry.sol","contracts/src/swap/GenesisDEXFactory.sol","contracts/src/swap/TWAPOracle.sol","contracts/src/swap/PublicBatchAuction.sol","contracts/src/testnet/TestnetFaucet420.sol","contracts/config/420explorer-genesis.json","docs/420EXPLORER.md","contracts/config/420search-genesis.json","docs/420SEARCH.md","testnet/public-services/search/readiness.json","contracts/config/420analytics-genesis.json","docs/420ANALYTICS.md","testnet/public-services/analytics/readiness.json","contracts/config/420arbitration-genesis.json","docs/420ARBITRATION.md","contracts/src/arbitration/ArbitrationIds420.sol","contracts/src/arbitration/ArbitrationPolicyRegistry420.sol","contracts/src/arbitration/ArbitrationCaseRegistry420.sol","contracts/src/arbitration/ArbitrationRulingRegistry420.sol","contracts/config/420token-genesis.json","docs/420TOKEN.md","testnet/public-services/token/readiness.json","contracts/src/token/TokenIds420.sol","contracts/src/token/TokenTemplateRegistry420.sol","contracts/src/token/TokenFactory420.sol","contracts/src/token/ERC20Template420.sol","contracts/src/token/ERC721Template420.sol","contracts/src/token/ERC1155Template420.sol"]
for f in files:
    if not (root/f).exists(): errors.append("missing "+f)
for n in ["420 Wallet","420 Explorer","420 Search","420 Analytics","420 Status"]:
    if mapped[n].get("contracts"): errors.append(n+" should not have required protocol state contract")

def profile(path): return json.loads((root/path).read_text()) if (root/path).exists() else {}
explorer=profile("contracts/config/420explorer-genesis.json")
if explorer:
    indexing=explorer.get("indexing",{}); sources=explorer.get("sources",{}); inv="\n".join(explorer.get("invariants",[]))
    if explorer.get("contractsRequired") is not False or explorer.get("canonicalStateAuthority") is not False: errors.append("explorer authority invariant missing")
    if not indexing.get("tracksHeadSafeFinalizedSeparately") or not indexing.get("rebuildableFromChain") or not indexing.get("databaseIsNonCanonical"): errors.append("explorer indexing invariant missing")
    if sources.get("protocolDiscovery")!="420Registry / ProtocolRegistry": errors.append("explorer registry discovery binding missing")
    for required in ["EXP-INV-001","EXP-INV-004","EXP-INV-005","EXP-INV-008","EXP-INV-009"]:
        if required not in inv: errors.append("missing explorer invariant "+required)
search=profile("contracts/config/420search-genesis.json")
if search:
    indexing=search.get("indexing",{}); ranking=search.get("ranking",{}); privacy=search.get("privacy",{}); inv="\n".join(search.get("invariants",[]))
    if search.get("contractsRequired") is not False or search.get("canonicalStateAuthority") is not False or search.get("serviceId")!="420/service/search/v1": errors.append("search authority/service invariant missing")
    if not indexing.get("databaseIsNonCanonical") or not indexing.get("rebuildableFromCanonicalSources") or not indexing.get("recordsCarrySourceAuthority") or not indexing.get("deterministicPagination"): errors.append("search indexing invariant missing")
    if not ranking.get("rankingIsNonCanonical") or not ranking.get("sponsoredResultsMustBeExplicitlyLabeled"): errors.append("search ranking invariant missing")
    for key in ["privateMessengerContentIndexed","privateCommonsContentIndexed","rawAttentionTelemetryIndexed","encryptedResourcePayloadsIndexed","privateIdentityDataIndexed"]:
        if privacy.get(key) is not False: errors.append("search privacy exclusion missing: "+key)
    for required in ["SRCH-INV-001","SRCH-INV-002","SRCH-INV-004","SRCH-INV-006","SRCH-INV-007","SRCH-INV-009","SRCH-INV-010"]:
        if required not in inv: errors.append("missing search invariant "+required)
ana=profile("contracts/config/420analytics-genesis.json")
if ana:
    agg=ana.get("aggregation",{}); privacy=ana.get("privacy",{}); presentation=ana.get("presentation",{}); inv="\n".join(ana.get("invariants",[]))
    if ana.get("contractsRequired") is not False or ana.get("canonicalStateAuthority") is not False or ana.get("serviceId")!="420/service/analytics/v1": errors.append("analytics authority/service invariant missing")
    for key in ["databaseIsNonCanonical","rebuildableFromCanonicalSources","metricsCarrySourceProvenance","metricsCarryWindowDefinition","metricsCarryChainId","tracksIndexedAndFinalizedHeights","reorgRepairOnlyForNonFinalizedData","historicalSnapshotsAreVersioned","derivedMetricsAreNonCanonical"]:
        if agg.get(key) is not True: errors.append("analytics aggregation invariant missing: "+key)
    for key in ["privateMessengerContentAggregated","privateCommonsContentAggregated","encryptedResourcePayloadsAggregated","privateIdentityFieldsAggregated","rawAttentionTelemetryAggregated","deanonymizationOrWalletProfilingByDefault"]:
        if privacy.get(key) is not False: errors.append("analytics privacy exclusion missing: "+key)
    if presentation.get("methodologiesMustBeDocumented") is not True or presentation.get("alternativeAnalyticsProvidersAllowed") is not True: errors.append("analytics methodology invariant missing")
    for required in ["ANL-INV-001","ANL-INV-002","ANL-INV-003","ANL-INV-005","ANL-INV-007","ANL-INV-008","ANL-INV-009","ANL-INV-010"]:
        if required not in inv: errors.append("missing analytics invariant "+required)
arb=profile("contracts/config/420arbitration-genesis.json")
if arb:
    model=arb.get("model",{}); inv="\n".join(arb.get("invariants",[]))
    if arb.get("serviceId")!="420/service/arbitration/v1": errors.append("arbitration canonical service id missing")
    for key in ["policyIsDomainScoped","policySnapshotAtCaseOpen","evidenceIsCommitmentBased","resolverIsExplicitlyBound","appealsAreBounded","finalRulingIsCommitmentNotExecution","originProtocolExecutesRemedyUnderOwnAuthority"]:
        if model.get(key) is not True: errors.append("arbitration model invariant missing: "+key)
    for required in ["ARB-INV-001","ARB-INV-002","ARB-INV-004","ARB-INV-006","ARB-INV-008","ARB-INV-009","ARB-INV-011"]:
        if required not in inv: errors.append("missing arbitration invariant "+required)
tok=profile("contracts/config/420token-genesis.json")
if tok:
    model=tok.get("model",{}); inv="\n".join(tok.get("invariants",[]))
    if tok.get("serviceId")!="420/service/token/v1" or tok.get("creationFeeNative420")!="42": errors.append("token service/fee invariant missing")
    if tok.get("communityTreasuryVaultId")!="420/treasury/vault/token-creation-community-revenue/v1": errors.append("token community treasury vault binding missing")
    if len(tok.get("templates",[]))!=8: errors.append("token template catalog must contain eight frozen V1 templates")
    for key in ["onlyFrozenTemplateIds","templateVersionRecorded","creatorRecorded","configHashRecorded","factoryDeploymentRecorded","exact42Native420Fee","feeDepositedToCanonicalCommunityTreasuryVault","feeDestinationImmutableAfterFactoryDeployment","feeForwardedThroughVaultAccounting","noFactoryCustody","noFactoryMintAuthorityAfterDeployment","creatorOwnsConfiguredAdminRights","templateDisableGovernanceOnly","newTemplateRequiresNewProtocolVersion"]:
        if model.get(key) is not True: errors.append("token model invariant missing: "+key)
    for required in ["TOK-INV-001","TOK-INV-FEE","TOK-INV-002","TOK-INV-003","TOK-INV-004","TOK-INV-005","TOK-INV-006","TOK-INV-007","TOK-INV-008","TOK-INV-009","TOK-INV-010"]:
        if required not in inv: errors.append("missing token invariant "+required)
service_ids=(root/"contracts/src/libraries/ServiceIds420.sol").read_text()
for label,value in [("search","SEARCH = keccak256(\"420/service/search/v1\")"),("analytics","ANALYTICS = keccak256(\"420/service/analytics/v1\")"),("arbitration","ARBITRATION = keccak256(\"420/service/arbitration/v1\")"),("token","TOKEN = keccak256(\"420/service/token/v1\")")]:
    if value not in service_ids: errors.append(label+" canonical ServiceIds420 entry missing")
factory=(root/"contracts/src/token/TokenFactory420.sol").read_text() if (root/"contracts/src/token/TokenFactory420.sol").exists() else ""
if "CREATION_FEE = 42 ether" not in factory or "msg.value!=CREATION_FEE" not in factory: errors.append("token exact-fee invariant missing")
if "COMMUNITY_TOKEN_REVENUE_VAULT" not in factory or "communityTreasuryVault.depositNative{value:CREATION_FEE}" not in factory: errors.append("token community treasury deposit invariant missing")
if "new ERC20Template420" not in factory or "new ERC721Template420" not in factory or "new ERC1155Template420" not in factory: errors.append("token frozen factory deployment paths missing")
stake=(root/"contracts/src/apps/Stake420.sol").read_text()
if "delegationEnabled() external pure returns (bool) { return false; }" not in stake: errors.append("stake delegation invariant missing")
faucet=(root/"contracts/src/testnet/TestnetFaucet420.sol").read_text()
if "TESTNET ONLY" not in faucet or "42 ether" not in faucet: errors.append("testnet faucet invariant missing")
bridge=(root/"contracts/src/bridge/VerifiedGateway420.sol").read_text()
if "consumedDeposits" not in bridge or "_requireOperational" not in bridge or "IVerifiedGatewayVerifier420" not in bridge or "IReplayProtection420" not in bridge: errors.append("bridge verification/replay/shared-safety invariant missing")
reg=(root/"contracts/src/apps/ProtocolRegistry.sol").read_text()
if "codeHash" not in reg or "metadataHash" not in reg or "version" not in reg: errors.append("protocol registry canonical metadata fields missing")
out={"pass":not errors,"errors":errors,"genesis_apps":16,"testnet_only_apps":1,"explorer_profile":"420-explorer-genesis-v1","search_profile":"420-search-genesis-v1","analytics_profile":"420-analytics-genesis-v1","arbitration_profile":"420-arbitration-genesis-v1","token_profile":"420-token-genesis-v1"}
(root/"contracts/config/genesis-dapp-verification.json").write_text(json.dumps(out,indent=2)+"\n")
print(json.dumps(out,indent=2))
sys.exit(0 if not errors else 2)

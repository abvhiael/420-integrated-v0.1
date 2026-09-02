#!/usr/bin/env python3
import json
import pathlib
import sys

root = pathlib.Path(__file__).resolve().parents[1]
errors = []

def load(path):
    p = root / path
    return json.loads(p.read_text()) if p.exists() else {}

def require_true(obj, keys, prefix):
    for key in keys:
        if obj.get(key) is not True:
            errors.append(f"{prefix}: {key}")

def require_false(obj, keys, prefix):
    for key in keys:
        if obj.get(key) is not False:
            errors.append(f"{prefix}: {key}")

def require_invariants(profile, required, prefix):
    inv = "\n".join(profile.get("invariants", []))
    for item in required:
        if item not in inv:
            errors.append(f"missing {prefix} invariant {item}")

decision = load("config/genesis-applications.json")
mapping = load("contracts/config/genesis-dapp-contract-map.json")
if decision.get("status") != "FROZEN":
    errors.append("genesis application decision not frozen")
if len(decision.get("apps", [])) != 19:
    errors.append("expected 19 entries including testnet faucet")

mapped = {x["dapp"]: x for x in mapping.get("apps", [])}
for app in decision.get("apps", []):
    name = app["name"]
    if name not in mapped:
        errors.append("missing dapp map: " + name)
    elif app.get("contracts_required") and not mapped[name].get("contracts"):
        errors.append("missing contracts for " + name)

required_files = [
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
    "contracts/config/420analytics-genesis.json",
    "docs/420ANALYTICS.md",
    "testnet/public-services/analytics/readiness.json",
    "contracts/config/420appstore-genesis.json",
    "docs/420APPSTORE.md",
    "testnet/public-services/appstore/readiness.json",
    "contracts/test/AppStoreGenesis420.t.sol",
    "contracts/config/420verify-genesis.json",
    "docs/420VERIFY.md",
    "testnet/public-services/verify/readiness.json",
    "contracts/test/VerifyGenesis420.t.sol",
    "contracts/config/420arbitration-genesis.json",
    "docs/420ARBITRATION.md",
    "contracts/src/arbitration/ArbitrationIds420.sol",
    "contracts/src/arbitration/ArbitrationPolicyRegistry420.sol",
    "contracts/src/arbitration/ArbitrationCaseRegistry420.sol",
    "contracts/src/arbitration/ArbitrationRulingRegistry420.sol",
    "contracts/config/420token-genesis.json",
    "docs/420TOKEN.md",
    "testnet/public-services/token/readiness.json",
    "contracts/src/token/TokenIds420.sol",
    "contracts/src/token/TokenTemplateRegistry420.sol",
    "contracts/src/token/TokenFactory420.sol",
    "contracts/src/token/ERC20Template420.sol",
    "contracts/src/token/ERC721Template420.sol",
    "contracts/src/token/ERC1155Template420.sol",
]
for path in required_files:
    if not (root / path).exists():
        errors.append("missing " + path)

for name in ["420 Wallet", "420 Explorer", "420 Search", "420 Analytics", "420 AppStore", "420 Verify", "420 Status"]:
    if mapped.get(name, {}).get("contracts"):
        errors.append(name + " should not have required protocol state contract")

explorer = load("contracts/config/420explorer-genesis.json")
if explorer:
    indexing = explorer.get("indexing", {})
    sources = explorer.get("sources", {})
    if explorer.get("contractsRequired") is not False or explorer.get("canonicalStateAuthority") is not False:
        errors.append("explorer authority invariant missing")
    if not indexing.get("tracksHeadSafeFinalizedSeparately") or not indexing.get("rebuildableFromChain") or not indexing.get("databaseIsNonCanonical"):
        errors.append("explorer indexing invariant missing")
    if sources.get("protocolDiscovery") != "420Registry / ProtocolRegistry":
        errors.append("explorer registry discovery binding missing")
    require_invariants(explorer, ["EXP-INV-001", "EXP-INV-004", "EXP-INV-005", "EXP-INV-008", "EXP-INV-009"], "explorer")

search = load("contracts/config/420search-genesis.json")
if search:
    indexing = search.get("indexing", {})
    ranking = search.get("ranking", {})
    privacy = search.get("privacy", {})
    if search.get("contractsRequired") is not False or search.get("canonicalStateAuthority") is not False or search.get("serviceId") != "420/service/search/v1":
        errors.append("search authority/service invariant missing")
    require_true(indexing, ["databaseIsNonCanonical", "rebuildableFromCanonicalSources", "recordsCarrySourceAuthority", "deterministicPagination"], "search indexing invariant missing")
    require_true(ranking, ["rankingIsNonCanonical", "sponsoredResultsMustBeExplicitlyLabeled"], "search ranking invariant missing")
    require_false(privacy, ["privateMessengerContentIndexed", "privateCommonsContentIndexed", "rawAttentionTelemetryIndexed", "encryptedResourcePayloadsIndexed", "privateIdentityDataIndexed"], "search privacy exclusion missing")
    require_invariants(search, ["SRCH-INV-001", "SRCH-INV-002", "SRCH-INV-004", "SRCH-INV-006", "SRCH-INV-007", "SRCH-INV-009", "SRCH-INV-010"], "search")

analytics = load("contracts/config/420analytics-genesis.json")
if analytics:
    aggregation = analytics.get("aggregation", {})
    privacy = analytics.get("privacy", {})
    presentation = analytics.get("presentation", {})
    if analytics.get("contractsRequired") is not False or analytics.get("canonicalStateAuthority") is not False or analytics.get("serviceId") != "420/service/analytics/v1":
        errors.append("analytics authority/service invariant missing")
    require_true(aggregation, ["databaseIsNonCanonical", "rebuildableFromCanonicalSources", "metricsCarrySourceProvenance", "metricsCarryWindowDefinition", "metricsCarryChainId", "tracksIndexedAndFinalizedHeights", "reorgRepairOnlyForNonFinalizedData", "historicalSnapshotsAreVersioned", "derivedMetricsAreNonCanonical"], "analytics aggregation invariant missing")
    require_false(privacy, ["privateMessengerContentAggregated", "privateCommonsContentAggregated", "encryptedResourcePayloadsAggregated", "privateIdentityFieldsAggregated", "rawAttentionTelemetryAggregated", "deanonymizationOrWalletProfilingByDefault"], "analytics privacy exclusion missing")
    require_true(presentation, ["methodologiesMustBeDocumented", "alternativeAnalyticsProvidersAllowed"], "analytics methodology invariant missing")
    require_invariants(analytics, ["ANL-INV-001", "ANL-INV-002", "ANL-INV-003", "ANL-INV-005", "ANL-INV-007", "ANL-INV-008", "ANL-INV-009", "ANL-INV-010"], "analytics")

appstore = load("contracts/config/420appstore-genesis.json")
if appstore:
    catalogue = appstore.get("catalogue", {})
    listing = appstore.get("listingMetadata", {})
    security = appstore.get("securityPresentation", {})
    wallet = appstore.get("walletIntegration", {})
    privacy = appstore.get("privacy", {})
    if appstore.get("contractsRequired") is not False or appstore.get("canonicalStateAuthority") is not False or appstore.get("serviceId") != "420/service/appstore/v1":
        errors.append("appstore authority/service invariant missing")
    require_true(catalogue, ["databaseIsNonCanonical", "rebuildableFromCanonicalSources", "canonicalIdentifiersPreserved", "serviceAndVersionProvenanceRequired", "chainIdAndNetworkRequired", "contractReferencesTraceable", "deprecationAndSecurityWarningsSupported", "alternativeClientsAndCataloguesAllowed"], "appstore catalogue invariant missing")
    require_true(listing, ["categoriesAreNonCanonical", "rankingIsNonCanonical", "featuredPlacementIsNonCanonical", "ratingsAndReviewsAreNonCanonical", "screenshotsAndDescriptionsAreNonCanonical", "sponsoredPlacementMustBeExplicitlyLabeled", "curationCannotRewriteCanonicalFields", "listingDoesNotConstituteEndorsement"], "appstore listing invariant missing")
    require_true(security, ["showRegisteredServiceAndVersion", "showContractAndVerificationReferences", "showRequestedWalletPermissions", "showCapabilityScopesAndHighRiskActions", "showDeprecationAndMaliciousWarnings", "warningsMustPreserveSourceProvenance"], "appstore security presentation missing")
    require_true(wallet, ["openInWalletSupported", "walletRemainsAuthorizationBoundary", "appStoreCannotSignTransactions", "appStoreCannotGrantCapabilities", "appStoreCannotBypassWalletConfirmation"], "appstore wallet invariant missing")
    require_false(privacy, ["privateMessengerContentIndexed", "privateCommonsContentIndexed", "encryptedResourcePayloadsIndexed", "privateIdentityFieldsIndexed", "rawAttentionTelemetryIndexed", "installationHistoryPublicByDefault"], "appstore privacy exclusion missing")
    require_invariants(appstore, ["APP-INV-001", "APP-INV-002", "APP-INV-003", "APP-INV-006", "APP-INV-007", "APP-INV-008", "APP-INV-009", "APP-INV-010", "APP-INV-011", "APP-INV-012", "APP-INV-013"], "appstore")

verify = load("contracts/config/420verify-genesis.json")
if verify:
    verification = verify.get("verification", {})
    proxy = verify.get("proxyHandling", {})
    submission = verify.get("submission", {})
    meaning = verify.get("securityMeaning", {})
    privacy = verify.get("privacy", {})
    if verify.get("contractsRequired") is not False or verify.get("canonicalStateAuthority") is not False or verify.get("serviceId") != "420/service/verify/v1":
        errors.append("verify authority/service invariant missing")
    if verification.get("statuses") != ["FULL_MATCH", "PARTIAL_MATCH", "MISMATCH", "UNVERIFIABLE"]:
        errors.append("verify result status taxonomy missing")
    require_true(verification, ["fullMatchRequiresRuntimeBytecodeMatch", "creationBytecodeCheckedWhenRecoverable", "compilerVersionRequired", "compilerSettingsRequired", "sourceBundleHashRequired", "deployedRuntimeCodeHashRequired", "chainIdAndAddressRequired", "optimizerAndRunsRecorded", "evmVersionRecorded", "viaIRRecorded", "metadataHashModeRecorded", "libraryLinksRecorded", "constructorArgumentsRecordedOrMarkedUnknown", "immutableReferencesHandled", "metadataDifferencesCannotBeSilentlyIgnored", "verificationEvidenceIsReproducible", "databaseIsNonCanonical", "alternativeVerifiersAllowed"], "verify reproducibility invariant missing")
    require_true(proxy, ["proxyShellAndImplementationVerifiedSeparately", "implementationAddressResolvedFromCanonicalStateWhenPossible", "implementationUpgradeInvalidatesInheritedImplementationStatus", "proxyVerificationCannotImplyImplementationVerification", "implementationVerificationCannotImplyProxyAdminSafety"], "verify proxy invariant missing")
    require_true(submission, ["supportsStandardJsonInput", "supportsMultiFileSourceBundles", "supportsFlattenedSourceAsCompatibilityInput", "supportsConstructorArguments", "supportsLibraryAddresses", "supportsCompilerVersionSelection", "supportsCompilerSettings", "sourceNormalizationMustNotChangeSemanticInput", "submittedSourceMayBePubliclyRedistributedWhenPublisherRequestsPublication"], "verify submission invariant missing")
    require_true(meaning, ["verifiedMeansSourceBuildCorrespondsToDeployedCode", "verifiedDoesNotMeanAudited", "verifiedDoesNotMeanSafe", "verifiedDoesNotMeanOfficial", "verifiedDoesNotMeanImmutable", "verifiedDoesNotMeanNonMalicious", "verificationCannotCreateRegistryLegitimacy", "verificationCannotGrantWalletPermissions"], "verify security meaning invariant missing")
    require_false(privacy, ["privateSourceSubmissionRequired", "walletPrivateKeysAccepted", "signingSecretsAccepted", "encryptedApplicationPayloadsIndexed", "privateMessengerContentIndexed", "rawAttentionTelemetryIndexed"], "verify privacy/security exclusion missing")
    require_invariants(verify, ["VER-INV-001", "VER-INV-002", "VER-INV-003", "VER-INV-004", "VER-INV-005", "VER-INV-006", "VER-INV-007", "VER-INV-008", "VER-INV-009", "VER-INV-010", "VER-INV-011", "VER-INV-012", "VER-INV-013"], "verify")

arbitration = load("contracts/config/420arbitration-genesis.json")
if arbitration:
    model = arbitration.get("model", {})
    if arbitration.get("serviceId") != "420/service/arbitration/v1":
        errors.append("arbitration canonical service id missing")
    require_true(model, ["policyIsDomainScoped", "policySnapshotAtCaseOpen", "evidenceIsCommitmentBased", "resolverIsExplicitlyBound", "appealsAreBounded", "finalRulingIsCommitmentNotExecution", "originProtocolExecutesRemedyUnderOwnAuthority"], "arbitration model invariant missing")
    require_invariants(arbitration, ["ARB-INV-001", "ARB-INV-002", "ARB-INV-004", "ARB-INV-006", "ARB-INV-008", "ARB-INV-009", "ARB-INV-011"], "arbitration")

token = load("contracts/config/420token-genesis.json")
if token:
    model = token.get("model", {})
    if token.get("serviceId") != "420/service/token/v1" or token.get("creationFeeNative420") != "42":
        errors.append("token service/fee invariant missing")
    if token.get("communityTreasuryVaultId") != "420/treasury/vault/token-creation-community-revenue/v1":
        errors.append("token community treasury vault binding missing")
    if len(token.get("templates", [])) != 8:
        errors.append("token template catalog must contain eight frozen V1 templates")
    require_true(model, ["onlyFrozenTemplateIds", "templateVersionRecorded", "creatorRecorded", "configHashRecorded", "factoryDeploymentRecorded", "exact42Native420Fee", "feeDepositedToCanonicalCommunityTreasuryVault", "feeDestinationImmutableAfterFactoryDeployment", "feeForwardedThroughVaultAccounting", "noFactoryCustody", "noFactoryMintAuthorityAfterDeployment", "creatorOwnsConfiguredAdminRights", "templateDisableGovernanceOnly", "newTemplateRequiresNewProtocolVersion"], "token model invariant missing")
    require_invariants(token, ["TOK-INV-001", "TOK-INV-FEE", "TOK-INV-002", "TOK-INV-003", "TOK-INV-004", "TOK-INV-005", "TOK-INV-006", "TOK-INV-007", "TOK-INV-008", "TOK-INV-009", "TOK-INV-010"], "token")

service_ids = (root / "contracts/src/libraries/ServiceIds420.sol").read_text()
for label, value in [
    ("search", 'SEARCH = keccak256("420/service/search/v1")'),
    ("analytics", 'ANALYTICS = keccak256("420/service/analytics/v1")'),
    ("appstore", 'APPSTORE = keccak256("420/service/appstore/v1")'),
    ("verify", 'VERIFY = keccak256("420/service/verify/v1")'),
    ("arbitration", 'ARBITRATION = keccak256("420/service/arbitration/v1")'),
    ("token", 'TOKEN = keccak256("420/service/token/v1")'),
]:
    if value not in service_ids:
        errors.append(label + " canonical ServiceIds420 entry missing")

factory_path = root / "contracts/src/token/TokenFactory420.sol"
factory = factory_path.read_text() if factory_path.exists() else ""
if "CREATION_FEE = 42 ether" not in factory or "msg.value!=CREATION_FEE" not in factory:
    errors.append("token exact-fee invariant missing")
if "COMMUNITY_TOKEN_REVENUE_VAULT" not in factory or "communityTreasuryVault.depositNative{value:CREATION_FEE}" not in factory:
    errors.append("token community treasury deposit invariant missing")
if "new ERC20Template420" not in factory or "new ERC721Template420" not in factory or "new ERC1155Template420" not in factory:
    errors.append("token frozen factory deployment paths missing")

stake = (root / "contracts/src/apps/Stake420.sol").read_text()
if "delegationEnabled() external pure returns (bool) { return false; }" not in stake:
    errors.append("stake delegation invariant missing")

faucet = (root / "contracts/src/testnet/TestnetFaucet420.sol").read_text()
if "TESTNET ONLY" not in faucet or "42 ether" not in faucet:
    errors.append("testnet faucet invariant missing")

bridge = (root / "contracts/src/bridge/VerifiedGateway420.sol").read_text()
if "consumedDeposits" not in bridge or "_requireOperational" not in bridge or "IVerifiedGatewayVerifier420" not in bridge or "IReplayProtection420" not in bridge:
    errors.append("bridge verification/replay/shared-safety invariant missing")

registry = (root / "contracts/src/apps/ProtocolRegistry.sol").read_text()
if "codeHash" not in registry or "metadataHash" not in registry or "version" not in registry:
    errors.append("protocol registry canonical metadata fields missing")

out = {
    "pass": not errors,
    "errors": errors,
    "genesis_apps": 18,
    "testnet_only_apps": 1,
    "explorer_profile": "420-explorer-genesis-v1",
    "search_profile": "420-search-genesis-v1",
    "analytics_profile": "420-analytics-genesis-v1",
    "appstore_profile": "420-appstore-genesis-v1",
    "verify_profile": "420-verify-genesis-v1",
    "arbitration_profile": "420-arbitration-genesis-v1",
    "token_profile": "420-token-genesis-v1"
}
(root / "contracts/config/genesis-dapp-verification.json").write_text(json.dumps(out, indent=2) + "\n")
print(json.dumps(out, indent=2))
sys.exit(0 if not errors else 2)

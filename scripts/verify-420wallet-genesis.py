#!/usr/bin/env python3
import json
import pathlib
import sys

root = pathlib.Path(__file__).resolve().parents[1]
errors = []


def load(path):
    p = root / path
    if not p.exists():
        errors.append(f"missing {path}")
        return {}
    try:
        return json.loads(p.read_text())
    except Exception as exc:
        errors.append(f"invalid json {path}: {exc}")
        return {}


wallet = load("contracts/config/420wallet-genesis.json")
apps = load("config/genesis-applications.json")
mapping = load("contracts/config/genesis-dapp-contract-map.json")
readiness = load("testnet/public-services/wallet/readiness.json")

if not (root / "docs/420WALLET.md").exists():
    errors.append("missing docs/420WALLET.md")

if wallet.get("serviceId") != "420/service/wallet/v1":
    errors.append("wallet service id missing")
if wallet.get("contractsRequired") is not False:
    errors.append("420 Wallet web client must remain contract-free")
if wallet.get("canonicalStateAuthority") is not False:
    errors.append("420 Wallet web client must remain non-canonical")

core = wallet.get("walletCore", {})
required_core = {
    "accountImplementation": "SmartAccount420.sol",
    "accountFactory": "SmartAccountFactory420.sol",
    "scopeLibrary": "SmartAccountScopes420.sol",
    "signatureLibrary": "ECDSA420.sol",
    "capabilityRegistry": "CapabilityRegistry420.sol",
    "protocolDiscovery": "420Registry / ProtocolRegistry",
}
for key, expected in required_core.items():
    if core.get(key) != expected:
        errors.append(f"wallet core binding {key} != {expected}")
for key in [
    "reusesGenesisSmartAccounts",
    "accountStateIsPortableAcrossClients",
    "capabilityStateIsPortableAcrossClients",
    "recoveryStateIsPortableAcrossClients",
    "sessionStateIsBoundToCanonicalAccountPolicy",
]:
    if core.get(key) is not True:
        errors.append(f"wallet core invariant missing: {key}")
if core.get("createsIndependentWalletAuthority") is not False:
    errors.append("wallet core must not create independent authority")

web = wallet.get("webClient", {})
for key in [
    "includedAtGenesis",
    "canonicalDomainMayBeAssignedLater",
    "configurationMustNotHardCodeFinalDomain",
    "httpsRequiredForProduction",
    "passkeyProductionRelyingPartyBoundAfterCanonicalDomainAssignment",
    "mayUseLocalhostOrStagingBeforeProductionDomain",
]:
    if web.get(key) is not True:
        errors.append(f"wallet web invariant missing: {key}")
if web.get("finalProductionDomainRequiredForBuild") is not False:
    errors.append("final production domain must not block wallet implementation")

nav = wallet.get("ecosystemNavigation", {})
for required in ["420 Search", "420 AppStore", "420 AI", "420 Token", "Developer Hub"]:
    if required not in nav.get("coreDestinations", []):
        errors.append(f"wallet navigation missing {required}")
for required in ["User Guides", "Developer Guides", "White Papers", "SDK and API Documentation", "Security and Audit Documentation"]:
    if required not in nav.get("developerResources", []):
        errors.append(f"wallet developer resources missing {required}")
if nav.get("usesRegistryOrSignedManifest") is not True or nav.get("hardCodedUnverifiedServiceUrlsForbidden") is not True:
    errors.append("wallet verified navigation invariant missing")

auth = wallet.get("authorizationBoundary", {})
for key in [
    "webUiMayNotPossessServerSideUserSigningKeys",
    "webUiMayNotAutoSign",
    "webUiMayNotGrantCapabilitiesWithoutAccountAuthorization",
    "webUiMayNotBypassSmartAccountPolicy",
    "webUiMayNotOverrideCapabilityRegistry",
    "webUiMayNotBecomeCanonicalIdentityOrOwnershipAuthority",
]:
    if auth.get(key) is not True:
        errors.append(f"wallet authorization invariant missing: {key}")

invariants = "\n".join(wallet.get("invariants", []))
for invariant in [f"WALLET-INV-{n:03d}" for n in range(1, 11)]:
    if invariant not in invariants:
        errors.append(f"missing {invariant}")

decision = next((x for x in apps.get("apps", []) if x.get("name") == "420 Wallet"), None)
if not decision:
    errors.append("420 Wallet missing from frozen genesis application decision")
elif decision.get("contracts_required") is not False:
    errors.append("420 Wallet decision unexpectedly requires independent contracts")

mapped = next((x for x in mapping.get("apps", []) if x.get("dapp") == "420 Wallet"), None)
if not mapped:
    errors.append("420 Wallet missing from genesis dapp contract map")
elif mapped.get("contracts"):
    errors.append("420 Wallet client must not own protocol state contracts")

smart = next((x for x in mapping.get("apps", []) if x.get("dapp") == "420 Smart Accounts"), None)
smart_contracts = set((smart or {}).get("contracts", []))
for contract in ["SmartAccount420.sol", "SmartAccountFactory420.sol", "SmartAccountScopes420.sol", "ECDSA420.sol", "CapabilityRegistry420.sol"]:
    if contract not in smart_contracts:
        errors.append(f"420 Smart Accounts missing wallet-core dependency {contract}")

if readiness.get("serviceId") != "420/service/wallet/v1" or readiness.get("genesisRequired") is not True:
    errors.append("wallet readiness profile missing genesis binding")
if readiness.get("domainAssignmentBlocksImplementation") is not False:
    errors.append("wallet readiness incorrectly blocks implementation on domain")
if readiness.get("walletCoreBoundToGenesisSmartAccounts") is not True or readiness.get("capabilityRegistryBound") is not True:
    errors.append("wallet readiness missing core bindings")

if errors:
    print(json.dumps({"pass": False, "errors": errors}, indent=2))
    sys.exit(1)

print(json.dumps({
    "pass": True,
    "serviceId": "420/service/wallet/v1",
    "genesisWeb": True,
    "walletCoreReusesSmartAccounts": True,
    "productionDomainDeferred": True,
    "verifiedEcosystemGateway": True,
    "developerHubLinked": True
}, indent=2))

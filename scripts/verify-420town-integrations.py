#!/usr/bin/env python3
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
errors=[]
def need(cond,msg):
    if not cond: errors.append(msg)

cfg=json.loads((ROOT/"config/420town-integrations-v1.json").read_text())
town=json.loads((ROOT/"config/420town-genesis.json").read_text())
consumer=json.loads((ROOT/"config/genesis-consumer-services.json").read_text())
frozen=json.loads((ROOT/"config/genesis-applications.json").read_text())
src=(ROOT/"town/integrations/integrations.go").read_text()
tests=(ROOT/"town/integrations/integrations_test.go").read_text()
search_profile=(ROOT/"search/architecture/profile.go").read_text()
search_privacy=(ROOT/"search/privacy/admission.go").read_text()
service_ids=(ROOT/"contracts/src/libraries/ServiceIds420.sol").read_text()
workflow=(ROOT/".github/workflows/420town-audit.yml").read_text()

need(cfg.get("schema")=="420-town-integrations-v1","integration schema drift")
need(cfg.get("serviceId")=="420/service/town/v1","Town service ID drift")
need(cfg.get("status")=="SERVICE_INTEGRATION_BASELINE","integration status drift")
need("TOWN-AUDIT-6" in town.get("implementedThrough",[]),"Town canonical config missing TOWN-AUDIT-6")
need("TOWN-AUDIT-6" not in town.get("deferredRoadmap",[]),"TOWN-AUDIT-6 still deferred")

deps=cfg.get("dependencies",{})
expected={
 "identity":"420/service/identity/v1",
 "storage":"420/service/resource-protocol/v1",
 "search":"420/service/search/v1",
 "notifications":"420/service/notifications/v1",
 "messenger":"420/service/messenger/v1",
}
for key,sid in expected.items():
    need(deps.get(key,{}).get("serviceId")==sid,f"{key} service ID drift")

need(deps.get("identity",{}).get("mayMutateIdentity") is False,"Town must not mutate Identity")
need(deps.get("storage",{}).get("bodyPolicy")=="OFF_CHAIN","Town storage body policy must remain off-chain")
need(deps.get("storage",{}).get("integrity")=="SHA256","Town storage integrity must remain SHA256")
need(deps.get("search",{}).get("visibility")=="PUBLIC_ONLY","Town Search projection must remain public-only")
need(deps.get("search",{}).get("classification")=="PUBLIC_APPLICATION","Town Search projection classification drift")
need(deps.get("search",{}).get("canonicalAuthority") is False,"Search must remain non-canonical")
need(deps.get("notifications",{}).get("townRequiresExplicitSubscriptionHandoff") is True,"notification handoff must require selected subscription")
need(deps.get("notifications",{}).get("consentCheck")=="ACTIVE_NOT_MUTED_OPERATIONAL_CONSENT","notification consent check drift")
need(deps.get("notifications",{}).get("canonicalAuthority") is False,"notifications must remain non-authoritative")
need(deps.get("messenger",{}).get("plaintextAllowed") is False,"Town Messenger integration must forbid plaintext transport")
need(deps.get("messenger",{}).get("transportFailureMayRewriteTownAuthority") is False,"transport failure cannot rewrite Town authority")
need("envelope commitments" in deps.get("messenger",{}).get("canonicalState",[]),"Messenger canonical envelope commitment missing")
need(deps.get("messenger",{}).get("commitOrder")=="ENCRYPTED_TRANSPORT_THEN_CANONICAL_ENVELOPE_COMMIT","Messenger commit ordering drift")
need(deps.get("rewards",{}).get("requiredForTownCore") is False,"Rewards must remain optional")

reg=cfg.get("registryDiscovery",{})
need(reg.get("mode")=="OPTIONAL_CANONICAL_DISCOVERY","Registry discovery mode drift")
need(reg.get("serviceId")=="420/service/protocol-registry/v1","ProtocolRegistry service ID drift")
need(reg.get("promotesTownToFrozenGenesisApplication") is False,"Town cannot be promoted by integration config")
need(len(cfg.get("invariants",[]))>=18,"integration invariant coverage incomplete")

townsvc=next((x for x in consumer.get("services",[]) if x.get("id")=="420/service/town/v1"),None)
need(townsvc is not None,"Town missing from GEN-SVC consumer registry")
if townsvc:
    need(townsvc.get("authority")=="REPLACEABLE_APPLICATION","Town GEN-SVC authority drift")
    need(set(townsvc.get("depends_on",[]))=={"420 Identity","420 Search","420 Notifications","420 Storage"},"Town direct GEN-SVC dependency drift")

# Decision #2 authorizes only the release-disabled TownSquare public client.
# It does not promote the underlying Town service ID or grant new authority.
decision=json.loads((ROOT/"config/genesis-application-decision-2.json").read_text())
entry=next((x for x in decision.get("entries",[]) if x.get("name")=="TownSquare"),None)
need(decision.get("decision_id")=="GENESIS_APPLICATION_DECISION_2","TownSquare catalog authorization decision missing")
need(entry is not None and entry.get("release_enabled") is False and entry.get("class")=="GENESIS_USER_APP" and entry.get("contracts_required") is False,"TownSquare requires expressly authorized, release-disabled app classification")
need(entry is not None and entry.get("existing_authority")=="420Town Community Boards","TownSquare must retain canonical Town service authority")
need(sum(x.get("name")=="TownSquare" for x in frozen.get("apps",[]))==1,"TownSquare public catalog classification drift")
need(not any(x.get("name")=="420Town" for x in frozen.get("apps",[])),"Town service must not become a separate public app")
need(all("420/service/town/v1" not in x.get("name","") for x in frozen.get("apps",[])),"Town service ID must not masquerade as public app")
need(townsvc is not None and townsvc.get("role")=="GENESIS_FACING_UPDATE","Town canonical GEN-SVC implementation role drift")

for preimage in [
 "420/service/identity/v1","420/service/resource-protocol/v1","420/service/search/v1",
 "420/service/notifications/v1","420/service/messenger/v1","420/service/protocol-registry/v1"
]:
    need(preimage in service_ids,f"canonical service ID absent from ServiceIds420: {preimage}")

for token in [
 "type IdentityAdapter struct","RequireActiveProfile","storage420.NewClient" if False else "storage420.Client",
 "PrepareContent","RetrieveContent","privacy.Admit","architecture.SourceTown","architecture.DomainPublicTown",
 "NotificationFeedSink","AllowsOperational","Authoritative:false","type MessengerAdapter struct","SendEncrypted","CommitEnvelope",
 "EndpointActive","ConversationActive","ConversationParticipant","Blocked","ResolveService"
]:
    need(token in src,f"missing integration implementation token: {token}")

for token in [
 'DomainPublicTown     ResultDomain = "public_town"',
 'SourceTown     SourceBoundary = "420Town:public"',
]:
    need(token in search_profile,f"Search Town source/domain missing: {token}")
need("architecture.SourceTown:     {architecture.DomainPublicTown: {}}" in search_privacy,"Search privacy allowlist missing exact Town source/domain")
need('ClassPublicApplication     Classification = "public_application"' in search_privacy,"Search public application classification missing")
need("Town application projection cannot be classified as public on-chain state" in search_privacy,"Town Search classification boundary missing")
need("public application classification is not admitted for this source" in search_privacy,"public application classification widened beyond Town")
need("privacy.ClassPublicApplication" in src,"Town Search projection must use public application classification")

for token in [
 "TestIdentityRequiresExactActiveCanonicalProfile",
 "TestIdentityDependencyFailureDoesNotInventLocalAuthority",
 "TestStoragePrepareAndRetrieveVerifiesPayloadIntegrity",
 "TestStorageRejectsProviderSubstitutionAndPayloadTampering",
 "TestSearchProjectsOnlyExplicitPublicTownMaterial",
 "TestNotificationHandoffRemainsNonAuthoritativeAndProvenanceBound",
 "TestMessengerRequiresCanonicalAuthorizationAndReplaceableEncryptedTransport",
 "TestMessengerFailsClosedOnAuthorityOutageAndNeverFallsBack",
 "TestServiceDiscoveryRejectsWrongOrInactiveBinding",
]:
    need(token in tests,f"missing integration test: {token}")

for token in [
 "Verify Town service integrations",
 "scripts/verify-420town-integrations.py",
 "Test affected Town service dependencies",
 "go test ./search/architecture ./search/privacy ./search/result ./sdk/storage420 ./notifications/feed ./notifications/security ./notifications/subscriptions",
]:
    need(token in workflow,f"Town workflow missing integration gate: {token}")

if errors:
    print("420Town service integration verifier FAILED")
    for e in errors: print("-",e)
    raise SystemExit(1)

print("420Town service integration verifier PASS")
print("dependencies=identity,storage,search,notifications,messenger,rewards")
print("search=PUBLIC_ONLY_NON_CANONICAL")
print("transport=ENCRYPTED_REPLACEABLE")
print("catalog=TownSquare:release_disabled; town_service=GEN_SVC_only")
print(f"invariants={len(cfg['invariants'])}")

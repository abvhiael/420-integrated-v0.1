#!/usr/bin/env python3
from pathlib import Path
import json, re

ROOT=Path(__file__).resolve().parents[1]
API=ROOT/"hz"/"config"/"gca-api-interface-contracts-v1.json"
THREAT=ROOT/"hz"/"config"/"gca-threat-model-v1.json"
MOD=ROOT/"hz"/"config"/"gca-moderation-dispute-v1.json"
VOTE=ROOT/"hz"/"config"/"gca-nomination-voting-policy-v1.json"
COMM=ROOT/"hz"/"config"/"gca-community-authority-v1.json"
SERVICE_IDS=ROOT/"contracts"/"src"/"libraries"/"ServiceIds420.sol"
DOC=ROOT/"docs"/"architecture"/"420hz"/"HZ-GCA-1.16-API-EVENT-INTERFACE-CONTRACTS.md"
ROADMAP=ROOT/"docs"/"420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md"
errors=[]

def need(cond,msg):
    if not cond: errors.append(msg)

for p in [API,THREAT,MOD,VOTE,COMM,SERVICE_IDS,DOC,ROADMAP]:
    need(p.is_file(),f"missing {p.relative_to(ROOT)}")

if not errors:
    api=json.loads(API.read_text())
    threat=json.loads(THREAT.read_text())
    mod=json.loads(MOD.read_text())
    vote=json.loads(VOTE.read_text())
    comm=json.loads(COMM.read_text())
    service_ids=SERVICE_IDS.read_text()
    doc=DOC.read_text()
    roadmap=ROADMAP.read_text()

    need(api.get("schema")=="420hz-gca-api-interface-contracts-v1","API/interface schema drift")
    need(api.get("version")==1,"API/interface version drift")
    need(api.get("canonicalStep")=="HZ-GCA-1","canonical parent step drift")
    need(api.get("workPackage")=="HZ-GCA-1.16","work package drift")
    need(api.get("level")==1,"HZ-GCA-1.16 must remain Level 1")
    need(api.get("milestoneRequired") is False,"HZ-GCA-1.16 must not become Level-2 milestone")

    boundary=api.get("implementationBoundary",{})
    need(boundary.get("logicalContractsOnly") is True,"must remain logical-contract-only")
    need(boundary.get("hzCanonicalServiceId") is None,"must not invent 420Hz service ID")
    need(boundary.get("productionBaseUrl") is None,"must not invent production endpoint")
    need(boundary.get("deployedAddress") is None,"must not invent deployed address")
    need(boundary.get("liveAdapterClaim") is False,"must not claim live adapter")

    expected_ids={
      "protocolRegistry":"420/service/protocol-registry/v1",
      "wallet":"420/service/wallet/v1",
      "smartAccounts":"420/service/smart-accounts/v1",
      "identity":"420/service/identity/v1",
      "rights":"420/service/rights/v1",
      "resourceProtocol":"420/service/resource-protocol/v1",
      "pay":"420/service/pay/v1",
      "ai":"420/service/ai/v1",
      "computeMarket":"420/service/compute-market/v1",
      "search":"420/service/search/v1",
      "notifications":"420/service/notifications/v1",
      "analytics":"420/service/analytics/v1",
      "arbitration":"420/service/arbitration/v1"
    }
    need(api.get("canonicalDependencyIds")==expected_ids,"canonical dependency ID map drift")
    for sid in expected_ids.values():
        need(f'keccak256("{sid}")' in service_ids,f"ServiceIds420 missing {sid}")

    req=api.get("requestEnvelope",{})
    need(req.get("required")==["schemaVersion","requestId","operation","domain","resourceRef","payload"],"request required fields drift")
    need(req.get("requiredForMutations")==["actorRef","idempotencyKey"],"mutation actor/idempotency requirements drift")
    conditional=set(req.get("conditional",[]))
    for field in ["actorRef","idempotencyKey","chainId","networkId","capabilityRef","deadline","expectedRevision","sourceCheckpoint"]:
        need(field in conditional,f"request conditional field missing: {field}")
    req_rules=" ".join(req.get("rules",[]))
    for token in ["operation/domain/resource scoped","qualified Wallet/session actor","wrong-network requests fail closed","lost-update/stale-state protection","minimum fields needed","eligible PUBLIC read queries may omit actorRef/idempotencyKey"]:
        need(token in req_rules,f"request-envelope rule missing: {token}")

    resp=api.get("responseEnvelope",{})
    need(resp.get("required")==["schemaVersion","requestId","status","source","sourceVersion"],"response required fields drift")
    need(resp.get("statuses")==["OK","ACCEPTED","PENDING","PARTIAL","REJECTED","FAILED"],"response status vocabulary drift")
    resp_rules=" ".join(resp.get("rules",[]))
    for token in ["does not create authority","freshness/finality/checkpoint","must not be presented as final success","never replace canonical source authority"]:
        need(token in resp_rules,f"response-envelope rule missing: {token}")

    expected_errors=[
      "INVALID_ARGUMENT","UNAUTHORIZED","FORBIDDEN","NOT_FOUND","CONFLICT","STALE_STATE","WRONG_NETWORK",
      "REPLAY_DETECTED","EXPIRED","RATE_LIMITED","POLICY_DENIED","DEPENDENCY_UNAVAILABLE","DEPENDENCY_MISMATCH",
      "INTEGRITY_MISMATCH","VERIFICATION_FAILED","NOT_SUPPORTED","INTERNAL_ERROR"
    ]
    need(api.get("errorTaxonomy")==expected_errors,"logical error taxonomy drift")

    evt=api.get("eventEnvelope",{})
    need(evt.get("required")==["schemaVersion","eventId","eventType","occurredAt","sourceDomain","sourceRef","subjectRef","visibility","payload"],"event required fields drift")
    need(evt.get("visibility")==["PRIVATE","UNLISTED","PUBLIC","SECURITY_RESTRICTED"],"event visibility vocabulary drift")
    erules=" ".join(evt.get("rules",[]))
    for token in ["do not themselves grant Wallet","stable for dedupe/replay","chain/block/finality context","source revision/checkpoint/provenance","excluded from public Search/Analytics","minimum-disclosure"]:
        need(token in erules,f"event-envelope rule missing: {token}")

    interfaces={x.get("name"):x for x in api.get("logicalInterfaces",[])}
    expected_ifaces={
      "RegistryDiscovery420Hz","WalletAuthorization420Hz","AIGeneration420Hz","ComputeExecution420Hz",
      "CreativeRights420Hz","Storage420Hz","IdentityEligibility420Hz","PaymentHandoff420Hz",
      "IndexerSearchRead420Hz","Notifications420Hz","Analytics420Hz","Arbitration420Hz"
    }
    need(set(interfaces)==expected_ifaces,f"logical interface set drift: {sorted(set(interfaces)^expected_ifaces)}")

    expected_deps={
      "RegistryDiscovery420Hz":"protocolRegistry",
      "WalletAuthorization420Hz":"wallet+smartAccounts",
      "AIGeneration420Hz":"ai",
      "ComputeExecution420Hz":"computeMarket",
      "CreativeRights420Hz":"rights",
      "Storage420Hz":"resourceProtocol",
      "IdentityEligibility420Hz":"identity",
      "PaymentHandoff420Hz":"pay",
      "IndexerSearchRead420Hz":"search",
      "Notifications420Hz":"notifications",
      "Analytics420Hz":"analytics",
      "Arbitration420Hz":"arbitration"
    }
    for name,dep in expected_deps.items():
        need(interfaces[name].get("dependency")==dep,f"{name} dependency drift")
        need(len(interfaces[name].get("operations",[]))>=2,f"{name} operation contract incomplete")
        need(len(interfaces[name].get("forbidden",[]))>=2,f"{name} forbidden-authority contract incomplete")

    commands=api.get("applicationCommands",[])
    for cmd in [
      "CreateGenerationProject","RequestGenerationQuote","SubmitGeneration","CancelGeneration",
      "RequestRegisterAndPublish","FollowArtist","FavoriteRecording","CreatePlaylist",
      "SubmitAwardNomination","SubmitAwardVote","SubmitModerationReport","SubmitModerationAppeal"
    ]:
        need(cmd in commands,f"application command missing: {cmd}")
    queries=api.get("applicationQueries",[])
    for q in ["GetGenerationProject","GetGenerationProvenance","GetPublishedRecording","GetChartSnapshot","GetAwardBallot","GetAwardResult","GetModerationCase"]:
        need(q in queries,f"application query missing: {q}")

    events={x.get("event"):x for x in api.get("eventCatalogue",[])}
    need(len(events)==23,f"expected 23 logical events, found {len(events)}")
    for e in [
      "generation.quote.created","generation.submitted","generation.succeeded","generation.failed","generation.cancelled",
      "release.registered","release.published","community.follow.changed","community.favorite.changed",
      "chart.snapshot.published","award.nomination.changed","award.vote.accepted","award.result.finalized",
      "moderation.report.submitted","moderation.decision.changed","arbitration.ruling.observed","notification.delivery.failed"
    ]:
        need(e in events,f"event missing: {e}")
    need(events["award.vote.accepted"].get("visibility")=="SECURITY_RESTRICTED","Award vote event visibility drift")
    need(events["moderation.report.submitted"].get("visibility")=="SECURITY_RESTRICTED","moderation report event visibility drift")

    evrules=" ".join(api.get("eventRules",[]))
    for token in ["does not imply REGISTERED or PUBLISHED","does not imply payer refund paid","do not become Chart credit unless admitted by the exact chart policy","does not create Award eligibility/result","do not become Chart or Civic votes","allegations","never auto-executes","never change source state"]:
        need(token in evrules,f"event semantic rule missing: {token}")

    idem=" ".join(api.get("idempotencyReplayRules",[]))
    for token in ["operation/domain/resource scoped","existing logical result","changed payload","stable eventId","cross-chain/cross-domain"]:
        need(token in idem,f"idempotency/replay rule missing: {token}")

    ver=" ".join(api.get("versioningCompatibilityRules",[]))
    for token in ["schemaVersion","canonical Registry","breaking field/semantic changes","unknown required enum/state values fail closed","retain the interface/policy commitments frozen"]:
        need(token in ver,f"versioning rule missing: {token}")

    privacy=" ".join(api.get("privacyMinimumDisclosureRules",[]))
    for token in ["Search/Analytics/Notifications never receive raw private prompts/drafts","minimum-disclosure predicate/nullifier","raw private evidence","only public/privacy-safe aggregate signals","never broaden the source object's visibility"]:
        need(token in privacy,f"privacy/minimum-disclosure rule missing: {token}")

    failures=set(api.get("failureRules",[]))
    for f in [
      "missing actor/domain/idempotency context for a mutating command fails closed",
      "wrong chain/network or inactive/deprecated incompatible service fails closed",
      "dependency timeout/unavailability cannot be converted into synthetic success",
      "private/unlisted payload cannot fall back to a public event/query path",
      "duplicate command/event delivery cannot repeat payment, generation, community, chart, nomination, vote, moderation or publication side effects",
      "derived read disagreement with canonical source cannot authorize a privileged transition",
      "Arbitration observation cannot invoke a remedy outside the HZ-GCA-1.14 allowlist"
    ]:
        need(f in failures,f"failure rule missing: {f}")

    inv=api.get("invariants",[])
    need(len(inv)==18,"expected HZGCA-API-001..018")
    for i,x in enumerate(inv,1):
        need(x.startswith(f"HZGCA-API-{i:03d} "),f"invariant numbering drift at {i}")

    need(threat.get("workPackage")=="HZ-GCA-1.15","HZ-GCA-1.15 prerequisite drift")
    need(mod.get("arbitrationIntegration",{}).get("adopted")=="OPTIONAL_EXPLICIT_ONLY","HZ-GCA-1.14 Arbitration prerequisite drift")
    need(vote.get("policyModes",{}).get("voterEligibility")==["WALLET_ONE_ACCOUNT_ONE_VOTE","IDENTITY_UNIQUE_ONE_VOTE","JURY_ONE_MEMBER_ONE_VOTE"],"HZ-GCA-1.13 voter-mode prerequisite drift")
    access=comm.get("accessModel",{})
    need("read PUBLIC creator/community presentation" in access.get("anonymous",[]),"HZ-GCA-1.10 anonymous-read prerequisite drift")

    for source in api.get("sourceDocs",[]):
        need((ROOT/source).is_file(),f"missing reconciled interface source: {source}")

    need(re.search(r"0x[a-fA-F0-9]{40}", json.dumps(api)) is None,"HZ-GCA-1.16 must not assign a deployed address")
    need("420/service/420hz" not in json.dumps(api).lower(),"HZ-GCA-1.16 must not invent a 420Hz service ID")
    need("https://" not in json.dumps(api) and "http://" not in json.dumps(api),"HZ-GCA-1.16 must not invent a production endpoint")

    for token in [
      "420Hz itself receives **no new service ID**",
      "Eligible PUBLIC reads may remain anonymous",
      "An event is a fact/observation. It is **not ambient authority**.",
      "Wallet connection alone is not operation approval.",
      "A StorageObjectRef does not prove universal physical-deletion authority.",
      "Delivery failure never rolls back or changes source state.",
      "HZ-GCA-1.17 — Failure and recovery semantics"
    ]:
        need(token in doc,f"normative API/interface token missing: {token}")

    need("HZ-GCA-1.16 — API/event/interface contracts" in roadmap,"roadmap HZ-GCA-1.16 missing")
    need("machine-readable interface manifest" in roadmap,"roadmap interface deliverable missing")
    need("Level 1 only" in roadmap,"roadmap Level-1 classification missing")

print(json.dumps({
  "pass":not errors,
  "suite":"420Hz HZ-GCA-1.16 API event interface contracts",
  "level":1,
  "interfaces":0 if errors else len(api.get("logicalInterfaces",[])),
  "events":0 if errors else len(api.get("eventCatalogue",[])),
  "errors":errors
},indent=2))
raise SystemExit(0 if not errors else 2)

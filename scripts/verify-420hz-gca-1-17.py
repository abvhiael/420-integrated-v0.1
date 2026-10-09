#!/usr/bin/env python3
from pathlib import Path
import json, re

ROOT=Path(__file__).resolve().parents[1]
REC=ROOT/"hz"/"config"/"gca-failure-recovery-v1.json"
API=ROOT/"hz"/"config"/"gca-api-interface-contracts-v1.json"
THREAT=ROOT/"hz"/"config"/"gca-threat-model-v1.json"
STORE=ROOT/"hz"/"config"/"gca-storage-retention-v1.json"
ECON=ROOT/"hz"/"config"/"gca-generation-economics-v1.json"
COMM=ROOT/"hz"/"config"/"gca-community-authority-v1.json"
CHART=ROOT/"hz"/"config"/"gca-charts-v1.json"
VOTE=ROOT/"hz"/"config"/"gca-nomination-voting-policy-v1.json"
MOD=ROOT/"hz"/"config"/"gca-moderation-dispute-v1.json"
DOC=ROOT/"docs"/"architecture"/"420hz"/"HZ-GCA-1.17-FAILURE-RECOVERY-SEMANTICS.md"
ROADMAP=ROOT/"docs"/"420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md"
errors=[]

def need(cond,msg):
    if not cond: errors.append(msg)

for p in [REC,API,THREAT,STORE,ECON,COMM,CHART,VOTE,MOD,DOC,ROADMAP]:
    need(p.is_file(),f"missing {p.relative_to(ROOT)}")

if not errors:
    rec=json.loads(REC.read_text())
    api=json.loads(API.read_text())
    threat=json.loads(THREAT.read_text())
    store=json.loads(STORE.read_text())
    econ=json.loads(ECON.read_text())
    comm=json.loads(COMM.read_text())
    chart=json.loads(CHART.read_text())
    vote=json.loads(VOTE.read_text())
    mod=json.loads(MOD.read_text())
    doc=DOC.read_text()
    roadmap=ROADMAP.read_text()

    need(rec.get("schema")=="420hz-gca-failure-recovery-v1","recovery schema drift")
    need(rec.get("version")==1,"recovery version drift")
    need(rec.get("canonicalStep")=="HZ-GCA-1","canonical parent step drift")
    need(rec.get("workPackage")=="HZ-GCA-1.17","work package drift")
    need(rec.get("level")==1,"HZ-GCA-1.17 must remain Level 1")
    need(rec.get("milestoneRequired") is False,"HZ-GCA-1.17 must not become Level-2 milestone")

    expected_classes=[
      "CLIENT_OR_SESSION_FAILURE","DEPENDENCY_UNAVAILABLE","DEPENDENCY_MISMATCH","TIMEOUT","CANCEL_REQUESTED",
      "PROVIDER_FAILURE","PARTIAL_OUTPUT","VERIFICATION_FAILURE","STORAGE_INTEGRITY_FAILURE",
      "STALE_OR_REORGED_DERIVED_STATE","ECONOMIC_RECONCILIATION_FAILURE","RIGHTS_OR_POLICY_BLOCK",
      "IDENTITY_ELIGIBILITY_FAILURE","DUPLICATE_OR_REPLAY","MODERATION_OR_DISPUTE_HOLD",
      "NOTIFICATION_DELIVERY_FAILURE","OPERATOR_OR_CONFIGURATION_FAILURE"
    ]
    need(rec.get("failureClasses")==expected_classes,"failure-class vocabulary drift")

    principles=" ".join(rec.get("recoveryPrinciples",[]))
    for token in [
      "reconcile canonical/source authority before retrying",
      "never infer terminal success",
      "retries are idempotent",
      "partial results remain non-final",
      "derived projections are rebuildable",
      "privacy classification survives failure",
      "explicit superseding/correction records",
      "degraded/read-only or fail closed"
    ]:
        need(token in principles,f"recovery principle missing: {token}")

    gen=rec.get("generationFailureSemantics",{})
    for section in ["providerUnavailable","timeout","cancellation","partialOutput","malformedOrMissingResult"]:
        need(isinstance(gen.get(section),list) and gen[section],f"generation failure section missing: {section}")

    provider=" ".join(gen.get("providerUnavailable",[]))
    for token in ["before submission","reconcile AI/Compute request/job state","accepted provider/resource/economic bindings","does not authorize switching beneficiary"]:
        need(token in provider,f"provider-unavailable rule missing: {token}")

    timeout=" ".join(gen.get("timeout",[]))
    for token in ["client timeout is not proof","before resubmission","resume observation","terminal state is confirmed"]:
        need(token in timeout,f"timeout rule missing: {token}")

    cancel=" ".join(gen.get("cancellation",[]))
    for token in ["local cancel intent is not proof","same request/job identity","economic state","never implies PAYER_REFUND_PAID"]:
        need(token in cancel,f"cancellation rule missing: {token}")

    partial=" ".join(gen.get("partialOutput",[]))
    for token in ["PARTIAL_OUTPUT","does not imply SUCCEEDED, VERIFIED, REGISTERED, PUBLISHED or SETTLED","partial payable units","keep private"]:
        need(token in partial,f"partial-output rule missing: {token}")

    malformed=" ".join(gen.get("malformedOrMissingResult",[]))
    for token in ["do not advance to valid result/verified state","retry/dispute/refund","STORAGE_INTEGRITY_FAILURE or VERIFICATION_FAILURE"]:
        need(token in malformed,f"malformed-result rule missing: {token}")

    retry=" ".join(rec.get("retrySemantics",[]))
    for token in ["same material payload","changed material payload","fresh intent/run and fresh authorization","never duplicates provider entitlement","automatic retry is forbidden"]:
        need(token in retry,f"retry rule missing: {token}")

    rr=rec.get("restartRecovery",{})
    order=rr.get("requiredReconciliationOrder",[])
    need(len(order)==14,f"expected 14-step restart recovery order, found {len(order)}")
    for i,x in enumerate(order,1):
        need(x.startswith(str(i)+" "),f"restart recovery order drift at step {i}")
    rrules=" ".join(rr.get("rules",[]))
    for token in ["does not assume in-memory queue/UI state","idempotency/replay keys must survive restart","canonical/durable checkpoints","lower-authority projection","same authority rules"]:
        need(token in rrules,f"restart recovery rule missing: {token}")

    storage=" ".join(rec.get("storageRecovery",[]))
    for token in ["integrity commitment","tombstone state wins","different bytes under the same identity","reapply current privacy/retention/deletion","retain PRIVATE visibility"]:
        need(token in storage,f"storage recovery rule missing: {token}")

    econr=" ".join(rec.get("economicRecovery",[]))
    for token in ["accepted price","EARNED/CLAIMABLE/PAID","REFUNDABLE/CLAIMABLE/PAID","second charge or provider entitlement","falsely marking PAID","falsely marking REFUNDED/PAID","blocks new spending"]:
        need(token in econr,f"economic recovery rule missing: {token}")

    rights=" ".join(rec.get("rightsPublicationRecovery",[]))
    for token in ["not publication authority","rechecks Wallet authorization","existing native Creator/Work/Recording IDs","revoked or stale","cannot rewrite Creative/Rights"]:
        need(token in rights,f"rights/publication recovery rule missing: {token}")

    awards=" ".join(rec.get("identityAwardsRecovery",[]))
    for token in ["blocks unique-human Awards actions","same ballot-scoped voter/nullifier","before retry","single-use","never recalculated under a newer policy"]:
        need(token in awards,f"Identity/Awards recovery rule missing: {token}")

    cc=" ".join(rec.get("communityChartsRecovery",[]))
    for token in ["logical relation/idempotency key","cannot inflate Community counters or Chart credit","eligible source signals plus policy/window/checkpoint","deterministic ordering","cannot create or resurrect"]:
        need(token in cc,f"Community/Charts recovery rule missing: {token}")

    modr=" ".join(rec.get("moderationDisputeRecovery",[]))
    for token in ["idempotent and cannot duplicate enforcement","append-only report/decision/appeal","revalidated after restart","deterministic retally","service/domain/origin/parties/finality/remedy/replay","never auto-executes"]:
        need(token in modr,f"moderation/dispute recovery rule missing: {token}")

    derived=rec.get("derivedServiceRecovery",{})
    for key in ["indexerSearch","analytics","notifications"]:
        need(isinstance(derived.get(key),list) and derived[key],f"derived recovery section missing: {key}")
    ds=" ".join(derived.get("indexerSearch",[])+derived.get("analytics",[])+derived.get("notifications",[]))
    for token in ["does not mutate canonical application/protocol state","rebuild/reconcile from canonical source/checkpoints","wrong-chain, stale or reorged","never ingests protected private payloads","does not roll back source operations","stable event/deduplication keys"]:
        need(token in ds,f"derived-service recovery rule missing: {token}")

    modes=rec.get("degradedModes",[])
    need(len(modes)==9,f"expected 9 degraded modes, found {len(modes)}")
    deps={x.get("dependency") for x in modes}
    for dep in ["420AI/Compute","Storage","Creative/Rights","Identity","Pay/Vault","Indexer/Search","Notifications","Analytics","Arbitration"]:
        need(dep in deps,f"degraded dependency missing: {dep}")

    op=" ".join(rec.get("operatorRecoveryRules",[]))
    for token in ["may pause ingestion, matching, generation submission, publication, voting or moderation surfaces","cannot fabricate canonical completion","versioned/auditable correction path","readiness requires dependency identity/version/freshness/integrity","remains authorized and non-terminal"]:
        need(token in op,f"operator recovery rule missing: {token}")

    failures=set(rec.get("failureRules",[]))
    for f in [
      "client/network timeout cannot be interpreted as canonical failure or success without reconciliation",
      "partial output cannot be presented as SUCCEEDED/VERIFIED/REGISTERED/PUBLISHED/SETTLED",
      "retry before canonical reconciliation cannot create a second paid generation attempt",
      "restart cannot discard durable replay/idempotency state for protected mutations",
      "storage integrity mismatch or tombstoned object cannot be served during recovery",
      "economic disagreement blocks new spending",
      "lost Register/Publish response cannot cause duplicate Creative IDs",
      "Identity outage cannot silently weaken a unique-human voting policy",
      "lost vote response cannot produce a second accepted vote",
      "Arbitration recovery cannot consume stale/wrong-domain/unfinalized/non-allowlisted remedies",
      "dependency failure cannot widen PRIVATE/UNLISTED visibility",
      "operator recovery cannot fabricate canonical state"
    ]:
        need(f in failures,f"failure rule missing: {f}")

    inv=rec.get("invariants",[])
    need(len(inv)==18,"expected HZGCA-REC-001..018")
    for i,x in enumerate(inv,1):
        need(x.startswith(f"HZGCA-REC-{i:03d} "),f"invariant numbering drift at {i}")

    need(api.get("workPackage")=="HZ-GCA-1.16","HZ-GCA-1.16 prerequisite drift")
    need(threat.get("workPackage")=="HZ-GCA-1.15","HZ-GCA-1.15 prerequisite drift")
    need(store.get("workPackage")=="HZ-GCA-1.8","HZ-GCA-1.8 prerequisite drift")
    need(econ.get("workPackage")=="HZ-GCA-1.9","HZ-GCA-1.9 prerequisite drift")
    need(comm.get("workPackage")=="HZ-GCA-1.10","HZ-GCA-1.10 prerequisite drift")
    need(chart.get("workPackage")=="HZ-GCA-1.11","HZ-GCA-1.11 prerequisite drift")
    need(vote.get("workPackage")=="HZ-GCA-1.13","HZ-GCA-1.13 prerequisite drift")
    need(mod.get("workPackage")=="HZ-GCA-1.14","HZ-GCA-1.14 prerequisite drift")

    need(econ.get("feePolicy",{}).get("hidden420HzSurcharge")=="forbidden","economic hidden-fee guard drift")
    need(chart.get("authority",{}).get("chartState")=="DERIVED_PROJECTION_ONLY","Charts authority prerequisite drift")
    need(mod.get("arbitrationIntegration",{}).get("adopted")=="OPTIONAL_EXPLICIT_ONLY","Arbitration recovery prerequisite drift")

    for source in rec.get("sourceDocs",[]):
        need((ROOT/source).is_file(),f"missing recovery source: {source}")

    need(re.search(r"0x[a-fA-F0-9]{40}",json.dumps(rec)) is None,"HZ-GCA-1.17 must not assign a deployed address")
    need("https://" not in json.dumps(rec) and "http://" not in json.dumps(rec),"HZ-GCA-1.17 must not invent endpoint")
    need("420/service/420hz" not in json.dumps(rec).lower(),"HZ-GCA-1.17 must not invent 420Hz service ID")

    for token in [
      "**Reconcile canonical/source authority before retrying anything that can create spend, entitlement, publication, vote, moderation or remedy effects.**",
      "A client timeout is ambiguous.",
      "A partial artifact does **not** imply:",
      "A timeout does not authorize a second paid attempt.",
      "Lower-authority projections may never be restored ahead of the source authority they depend on.",
      "Identity-dependent Award voting is disabled/fail-closed.",
      "Notification delivery failure never rolls back the source operation.",
      "HZ-GCA-1.18 — Architecture documentation consolidation"
    ]:
        need(token in doc,f"normative recovery token missing: {token}")

    need("HZ-GCA-1.17 — Failure and recovery semantics" in roadmap,"roadmap HZ-GCA-1.17 missing")
    need("machine-readable recovery manifest" in roadmap,"roadmap recovery deliverable missing")
    need("Level 1 only" in roadmap,"roadmap Level-1 classification missing")

print(json.dumps({
  "pass":not errors,
  "suite":"420Hz HZ-GCA-1.17 failure recovery semantics",
  "level":1,
  "failureClasses":0 if errors else len(rec.get("failureClasses",[])),
  "recoverySteps":0 if errors else len(rec.get("restartRecovery",{}).get("requiredReconciliationOrder",[])),
  "errors":errors
},indent=2))
raise SystemExit(0 if not errors else 2)

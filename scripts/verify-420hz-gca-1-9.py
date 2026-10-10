#!/usr/bin/env python3
from pathlib import Path
import json

ROOT=Path(__file__).resolve().parents[1]
ECON=ROOT/"hz"/"config"/"gca-generation-economics-v1.json"
STORE=ROOT/"hz"/"config"/"gca-storage-retention-v1.json"
LIFE=ROOT/"hz"/"config"/"gca-generate-lifecycle-v1.json"
DOC=ROOT/"docs"/"architecture"/"420hz"/"HZ-GCA-1.9-GENERATION-ECONOMICS.md"
ROADMAP=ROOT/"docs"/"420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md"
AI=ROOT/"contracts"/"src"/"ai"/"AIJobManager.sol"
errors=[]

def need(cond,msg):
    if not cond: errors.append(msg)

for p in [ECON,STORE,LIFE,DOC,ROADMAP,AI]:
    need(p.is_file(),f"missing {p.relative_to(ROOT)}")

if not errors:
    econ=json.loads(ECON.read_text())
    store=json.loads(STORE.read_text())
    life=json.loads(LIFE.read_text())
    doc=DOC.read_text()
    roadmap=ROADMAP.read_text()
    ai=AI.read_text()

    need(econ.get("schema")=="420hz-gca-generation-economics-v1","economics schema drift")
    need(econ.get("version")==1,"economics version drift")
    need(econ.get("canonicalStep")=="HZ-GCA-1","canonical parent step drift")
    need(econ.get("workPackage")=="HZ-GCA-1.9","work package drift")
    need(econ.get("level")==1,"HZ-GCA-1.9 must remain Level 1")
    need(econ.get("milestoneRequired") is False,"HZ-GCA-1.9 must not become Level-2 milestone")
    need(store.get("workPackage")=="HZ-GCA-1.8","HZ-GCA-1.8 prerequisite drift")
    need(life.get("workPackage")=="HZ-GCA-1.3","HZ-GCA-1.3 prerequisite drift")

    states=[x.get("state") for x in econ.get("economicStates",[])]
    expected=[
      "ESTIMATE","QUOTED","AUTHORIZED_MAX","FUNDED","ACCEPTED_PRICE","VERIFIED_EARNED",
      "PROVIDER_CLAIMABLE","PROVIDER_PAID","PAYER_REFUNDABLE","PAYER_REFUND_CLAIMABLE",
      "PAYER_REFUND_PAID","DISPUTE_HOLD"
    ]
    need(states==expected,f"economic state vocabulary/order drift: {states}")
    need(len(states)==len(set(states)),"duplicate economic states")

    quote=" ".join(econ.get("quoteRules",[]))
    for token in ["QUOTED is application state only","requires re-quote","exact accepted price","versioned policy"]:
        need(token in quote,f"quote rule missing: {token}")

    auth=" ".join(econ.get("authorizationAndFundingRules",[]))
    for token in ["explicit, bounded","unbounded legacy max-spend","independently authorized","job-bound","distinguish payment authorization"]:
        need(token in auth,f"authorization/funding rule missing: {token}")

    accepted=" ".join(econ.get("acceptedPriceRules",[]))
    for token in ["payer signed/authorized maximum","actual job-specific Vault-backed funded credit","scoped accept-match capability","provider-derived beneficiary","creates no provider earning"]:
        need(token in accepted,f"accepted-price rule missing: {token}")

    settlement=" ".join(econ.get("entitlementAndSettlementRules",[]))
    for token in ["canonical verification","RESULT_COMMITTED is not VERIFIED_EARNED","one canonical entitlement key","PROVIDER_CLAIMABLE and PROVIDER_PAID are distinct","already-bound canonical beneficiary"]:
        need(token in settlement,f"settlement rule missing: {token}")

    refunds=" ".join(econ.get("cancellationFailureRefundRules",[]))
    for token in ["creates no provider charge","local cancel click cannot promise","PAYER_REFUNDABLE, PAYER_REFUND_CLAIMABLE and PAYER_REFUND_PAID","cancelObligation","recorded/bound payer"]:
        need(token in refunds,f"refund rule missing: {token}")

    retry=" ".join(econ.get("retryReplayRules",[]))
    for token in ["cannot create a second payable entitlement","idempotency key","fresh explicit payer authorization","never silently recharge","reconcile canonical"]:
        need(token in retry,f"retry/replay rule missing: {token}")

    sponsor=" ".join(econ.get("sponsorshipAndSubsidyRules",[]))
    for token in ["canonical funding source/pool","useful-computation reward","community/award popularity","re-quote/re-authorize","silently shift the amount to the user"]:
        need(token in sponsor,f"sponsorship rule missing: {token}")

    fee=econ.get("feePolicy",{})
    need(fee.get("hidden420HzSurcharge")=="forbidden","hidden surcharge must remain forbidden")
    need(fee.get("currentApplicationFee")=="none defined by HZ-GCA-1.9","unexpected application fee introduced")
    need("separate line item" in fee.get("futureRule",""),"future fee separate-line-item rule missing")
    need("separate user authorization" in fee.get("futureRule",""),"future fee authorization rule missing")

    ui=" ".join(econ.get("uiPresentationRules",[]))
    for token in ["quote/estimate status","exact accepted price","provider earning, provider claimable and provider paid","payer refundable, refund claimable and refund paid","Do not show 'refunded'","stale/unavailable pricing"]:
        need(token in ui,f"UI economic truth rule missing: {token}")

    equation=econ.get("reconciliationEquation",{})
    need(equation.get("equation")=="funded = provider_earned_or_claimable_or_paid + payer_refundable_or_claimable_or_paid + still_reserved + policy_explicit_fees_or_holds","reconciliation equation drift")
    need(any("counted exactly once" in x for x in equation.get("rules",[])),"single-count reconciliation rule missing")

    failures=set(econ.get("failureRules",[]))
    for f in [
      "quote above payer maximum fails closed",
      "accepted price above actual job funding fails closed",
      "provider beneficiary substitution fails closed",
      "duplicate payable entitlement for retry/replay fails closed",
      "application label claiming PAID or REFUNDED without canonical evidence is invalid",
      "hidden 420Hz surcharge is invalid"
    ]:
        need(f in failures,f"economic failure rule missing: {f}")

    inv=econ.get("invariants",[])
    need(len(inv)==18,"expected HZGCA-ECON-001..018")
    for i,x in enumerate(inv,1):
        need(x.startswith(f"HZGCA-ECON-{i:03d} "),f"invariant numbering drift at {i}")

    need("maxSpend" in ai and "FundingExceedsMaximum" in ai,"AIJobManager max-spend bound evidence missing")

    for source in econ.get("sourceDocs",[]):
        need((ROOT/source).is_file(),f"missing reconciled economics source: {source}")

    for token in [
      "A quote is not funding.",
      "RESULT_COMMITTED",
      "cancelObligation",
      "before any new charge is allowed",
      "defines **no hidden or implicit 420Hz surcharge**",
      "funded = provider earned/claimable/paid + payer refundable/claimable/paid + still reserved + explicit accepted fees/holds",
      "HZ-GCA-1.10 — Define Community authority model"
    ]:
        need(token in doc,f"normative economics token missing: {token}")

    need("HZ-GCA-1.9 — Define generation economics" in roadmap,"roadmap HZ-GCA-1.9 missing")
    need("machine-readable economics manifest" in roadmap,"roadmap economics deliverable missing")
    need("Level 1 only" in roadmap,"roadmap Level-1 classification missing")

print(json.dumps({
  "pass":not errors,
  "suite":"420Hz HZ-GCA-1.9 generation economics",
  "level":1,
  "economicStates":0 if errors else len(econ.get("economicStates",[])),
  "errors":errors
},indent=2))
raise SystemExit(0 if not errors else 2)

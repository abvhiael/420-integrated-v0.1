# BNB-3.1 — Phase 2 handoff and Phase 3 baseline

**State: Phase 2 repository Level 3 PASS; restricted source integration review ready; PR #616 unmerged; no approved Phase 3 baseline.**

## Scope authority

This handoff depends on canonical BNB-2.15 Level 3 closeout. A Phase 3 step listing in chat was a proposal, not committed roadmap approval. No Phase 3 implementation or BNB-3.1 completion is established here. After approved integration, record the actual merged main SHA and committed roadmap authority.

## Verified source and evidence

Implementation: `9cdc324a1b5bd22a2dd9f343931fef05e934b8b2`, frozen branch `qualification/bnb-phase2-exact-9cdc324a`. Reconciliation base main: `fe21ef07359d6915bf5daac37c4bf24a24fcf19b`. Certification PR #616 branch `audit/bnb-phase2-level3-candidate-20261012` carries documentation-only evidence beyond that implementation. PR #600 original head `273b6c7e714fdbc7e1c96463922546f74dc83c89` remains preserved; do not merge it independently or reconcile it before qualified integration approval.

| Gate | Run | Result at this update |
| --- | --- | --- |
| Canonical full Solidity Contracts | 38281106064 | PASS: all four primary/test/coverage partitions, Decision 10 fixture, complete unique inventory and coverage aggregate |
| Genesis Address Authority | 38280934685 | PASS; independent namespace/manifest/predeploy regressions, no duplicate Foundry |
| 420 Integrated Qualification | 38280419435 | PASS; all four jobs actual checkout exact implementation |
| Canonical global 420Docs Qualification | 38280739099 | PASS; all 41 stages and aggregate; not publication |
| Oracle retry | 38205294248 attempt 2 | PASS; all four jobs exact checkout |
| Additive pinned architecture/Travel qualification | 38287212823 | PASS: all five jobs actual checkout exact implementation |

Full log inspection corrects historical twelve-exact-pass claims: old Travel 38205294324 and BnB 1.1/1.2 38205294198 / 38205294329 checked out synthetic merge SHA `ee255885b7d2b8fab2ed97d75d12589f6ea4c467` and are excluded. The additive support run executes all nine canonical BnB validators, Travel/shared Genesis/DOOBR validators and migration plan, noncached compatibility/Travel tests, vet and build at literal checkout `9cdc324a1b5bd22a2dd9f343931fef05e934b8b2`; workflow source is tooling-only `2c668a20da3bae9f5b91e6249573863f4a61e521` on `qualification/bnb-phase2-travel-support-9cdc324a`. Do not merge that support harness into main.

Retained exact-SHA BnB 1.3–1.9, Runtime 38205294263 (163 API/security tests; six operations tests are a subset) and Indexer 38205145966 passed. Oracle 18 tests/five suites and static/consumer/readiness checks passed. Cancelled support 38284948559, cancelled Pages 38280588257, cancelled Oracle attempt 1, skipped historical Docs and inapplicable PR-only jobs remain excluded.

## Failure, security and approval boundaries

The authoritative detailed review is in [BNB-2.15 closeout](BNB-2.15-PHASE2-LEVEL3-CLOSEOUT.md), including reconciliation evidence commit `9eb1078cc6eaf743d39720be84a16cdb337bef92`. Unchanged Governance/420Hz invalid YAML and five unrelated Cloudflare deployment failures are explicitly scoped baseline defects, never passes. Their source/configuration is absent from the BnB implementation diff; exact core/Genesis/Indexer integration evidence covers affected dependencies.

Reviewed runtime boundaries include verified sessions/recovery epochs, independently pinned RS256 purpose/subject-bound issuer proof, replay/locking/inventory protections and Pay finality/refund/disbursement conservation. No new critical BnB finding was observed within reviewed source/regressions; existing Solidity lint diagnostics and independent production security acceptance are not erased. README evidence commit `68625e12062e372b7e7fe647c17b6e8e33942c5c` corrects obsolete HMAC/proxy identity claims.

[BNB testnet roadmap](BNB-TESTNET-WORK-ROADMAP.md) retains independent Identity/Compliance/Location/property/legal issuer provenance, actual Pay finality/reorg/refunds/payouts, manual accessibility, multi-instance deployment/failover/backup-restore and independent security acceptance. These are deferred, not waived. Preserve `travel.bnb_booking=false` and disabled booking/financial execution. Repository CI does not certify live operations.

Terminal closeout evidence commit `525b3df1a96779e4ef74b9ee80a15a53db939c5b` records all mandatory repository gates PASS: 1,064 unique primary units, four shards with 16 coverage contexts each, Decision 10 fixture assertions, 790 diagnostic LCOV source records and retained artifact IDs/digests. Full logs verify exact implementation checkout for every mandatory job. Main refreshed still equals the recorded base; evidence delta is three Markdown files only. Repository source scope is ready for restricted integration approval/review; live acceptance remains deferred. Keep #616 unmerged pending integration approval; reconcile #600 only after that approval. No Phase 3 baseline exists until the actual approved merged main and canonical roadmap are recorded.

## Three-level qualification policy

Level 1 applies to ordinary steps, Level 2 to material milestones, and Level 3 once at phase closeout. Preserve this single full Foundry/global qualification; no duplicate Foundry in Genesis. Evidence-only commits inherit the frozen executable SHA. Any executable implementation change requires a new candidate and complete applicable exact-SHA requalification.

# BNB-3.1 — Phase 2 handoff and Phase 3 baseline

**State: BNB-3.1 COMPLETE — approved roadmap, merged source baseline and scoped Level 1 handoff qualification PASS.**

## BNB-3.1 targeted Level 1 completion (2026-10-12)

Requirements/substantive document candidate: `14fa117ca6daf5788595cc7a6fcdaa75c5f3e643`; approval commit `50ca2a8886f1724efbde885cfd48ab9b570d7a17`; prior main/source baseline `fd0861e5d4c68d230893e20514d80d0da01b3172`, approved integration `2bc74d12662f60b9ea499fa5b38bc49e191b8f94`, predecessor qualified executable `9cdc324a1b5bd22a2dd9f343931fef05e934b8b2`. Candidate delta is only this handoff and BNB-PHASE3-ROADMAP.md; no application source/tests/workflow/dependency/configuration/deployment change. Both prior PRs remain merged/closed. This completion update is evidence-only and inherits the candidate requirements qualification.

Existing fast BNB source-boundary workflow **38294987483**, job **114963800198**, completed SUCCESS. Full log verifies actual checkout `14fa117ca6daf5788595cc7a6fcdaa75c5f3e643`, exact-head step PASS, canonical source-boundary verifier PASS and zero job errors. This workflow supplies retained Genesis/source guard verification; it is not described as a dedicated BNB-3.1 workflow.

Additional scoped document/traceability checks at the same candidate: exactly twelve contiguous approved names/numbers; owner approval and commit reference; correct merged baseline; documented Level 2 milestones and phase-closeout Level 3 ownership; every referenced T-BNB gate resolved to the committed testnet roadmap; next step BNB-3.2 — Production infrastructure. Canonical feature flag authority `config/genesis-consumer-services.json` retains `travel.bnb_booking=false`; Travel schema retains `bnb_compatibility.enabled_at_genesis=false` and `trip_collections.payment_authority=false`. All nine checks PASS. The initial manual flag lookup used the wrong schema; inspection corrected the lookup to canonical feature_flags authority, with no product defect or implementation edit.

Original exit criteria individually satisfied: predecessor full Level 3 PASS retained; approved merge preserves reviewed tree; #616/#600 reconciled; canonical roadmap committed with approval; external deferrals and disabled activation preserved; actual merged/source baseline recorded; targeted Level 1 evidence verified; next canonical step identified. Planning/adoption completion does not approve future code or live providers. Security review confirms no authority expansion, secret provisioning, frozen-address/catalog change or financial activation in this step.

Level 2 is intentionally deferred to M3-A after BNB-3.6 and M3-B after BNB-3.10 (plus BNB-3.11 end-to-end milestone). Level 3 is intentionally deferred to BNB-3.12; Phase 2 global/Foundry evidence was not redundantly rerun. No repository blocker remains for BNB-3.1; independent live issuer/legal/Pay/operations/security/accessibility prerequisites remain open in their T-BNB roadmap. **Next: BNB-3.2 — Production infrastructure.**


## Canonical Phase 3 roadmap adoption

The repository owner explicitly approved adoption on 2026-10-12. [BNB-PHASE3-ROADMAP.md](BNB-PHASE3-ROADMAP.md), approval commit `50ca2a8886f1724efbde885cfd48ab9b570d7a17`, is now the canonical twelve-step sequence with preserved names/numbers, required scope and exit criteria, dependencies and Level 1/2/3 ownership. It supersedes the prior proposed/unapproved status. BNB-3.1 finishes predecessor handoff, baseline, roadmap adoption and targeted qualification; next is **BNB-3.2 — Production infrastructure**. No BNB-3.2 implementation or live issuer/operator/payment approval is claimed.


## Approved merged integration baseline

Owner authorized restricted source integration review and merge on 2026-10-12. PR #616 merged as `2bc74d12662f60b9ea499fa5b38bc49e191b8f94`; post-merge tree has zero file differences from reviewed evidence head `8e15c748289fbff2f7d4a7ef85aa6cb619c20e77`, preserving qualified executable candidate `9cdc324a1b5bd22a2dd9f343931fef05e934b8b2`. Original #600 head `273b6c7e714fdbc7e1c96463922546f74dc83c89` is an ancestor of main and GitHub automatically marked #600 merged/closed through the incorporated implementation. Both PRs are reconciled; no second older-source merge is required.

The approved integration baseline is `2bc74d12662f60b9ea499fa5b38bc49e191b8f94`. Post-merge closeout evidence commit `6e2926c21a3c8578409f07b2a03921fc677972ba` and this handoff update modify documentation only and inherit the qualified executable. Independent official-testnet/legal/issuer/Pay/operations/security deferrals remain intact. This establishes the actual merged Phase 2 source baseline; the canonical Phase 3 roadmap is now committed and owner-approved as linked above; BNB-3.1 final targeted qualification is PASS as recorded above. Earlier unmerged observations below are historical.


## Scope authority

This handoff depends on canonical BNB-2.15 Level 3 closeout. The earlier Phase 3 listing was a proposal; owner approval and committed BNB-PHASE3-ROADMAP.md now adopt it. The actual approved merged source baseline and roadmap authority are recorded above. Future Phase 3 implementation remains unqualified until its applicable exact-SHA checks pass.

## Verified source and evidence

Implementation: `9cdc324a1b5bd22a2dd9f343931fef05e934b8b2`, frozen branch `qualification/bnb-phase2-exact-9cdc324a`. Reconciliation base main: `fe21ef07359d6915bf5daac37c4bf24a24fcf19b`. Certification PR #616 branch `audit/bnb-phase2-level3-candidate-20261012` carries documentation-only evidence beyond that implementation. PR #600 original head `273b6c7e714fdbc7e1c96463922546f74dc83c89` is incorporated through merged certification #616; both PRs are merged/closed.

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

Terminal closeout evidence commit `525b3df1a96779e4ef74b9ee80a15a53db939c5b` records all mandatory repository gates PASS: 1,064 unique primary units, four shards with 16 coverage contexts each, Decision 10 fixture assertions, 790 diagnostic LCOV source records and retained artifact IDs/digests. Full logs verify exact implementation checkout for every mandatory job. Main refreshed still equals the recorded base; evidence delta is three Markdown files only. Repository source scope is ready for restricted integration approval/review; live acceptance remains deferred. Restricted integration approval and merges are now complete as recorded above. The actual merged source baseline is established; canonical Phase 3 roadmap approval and BNB-3.1 targeted qualification are now complete.

## Three-level qualification policy

Level 1 applies to ordinary steps, Level 2 to material milestones, and Level 3 once at phase closeout. Preserve this single full Foundry/global qualification; no duplicate Foundry in Genesis. Evidence-only commits inherit the frozen executable SHA. Any executable implementation change requires a new candidate and complete applicable exact-SHA requalification.

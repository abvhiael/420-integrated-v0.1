# BNB-3.1 — Phase 2 handoff and Phase 3 baseline

**State: BLOCKED — predecessor Level 3 qualification incomplete; no approved Phase 3 baseline.**

## Scope authority

The user-requested Phase 3 handoff is to complete BNB-2.15 full Level 3 qualification, reconcile PRs #600/#616, and establish a qualified Phase 3 baseline. The Phase 3 step listing previously presented in chat was a **proposal**, not verified canonical repository authority. Do not treat BNB-3.1 numbering or subsequent Phase 3 steps as formally adopted without committed roadmap approval. Preserve the canonical BNB-2.15 Phase 2 closeout.

## Verified repository status

- Current main at handoff check: `fe21ef07359d6915bf5daac37c4bf24a24fcf19b`.
- Original audit PR #600: `273b6c7e714fdbc7e1c96463922546f74dc83c89`, draft/open, **do not merge independently** ahead of the reconciled certification.
- Reconciled draft PR #616: implementation merge candidate `9cdc324a1b5bd22a2dd9f343931fef05e934b8b2`, plus evidence-only docs at `40fae9c76b8bf9847f0eaffbbdea8e332bd9bc43`. Against recorded main, PR #616 was ahead 457 / behind 0, GitHub mergeable; these properties are not qualification.
- Exact-PR-head runs for PR #616 completed **12 PASS**: BNB-1.1–1.9 (9), Runtime Slice (1), GEN-SVC-3 Travel (1), 420Oracle (1). No failures or pending runs among those; 420Docs Qualification `38205346692` was SKIPPED and is **not** a Level 3 PASS.
- Provenance: BnB Runtime `38205346659`, Travel `38205346715`, Oracle `38205346629`, BNB Deployment Operations `38205346736`. GitHub Actions PR workflow checkouts must independently assert exact candidate SHA as defined by the workflow; merely sharing PR context is not enough.

## Level 3 blockers before Phase 3 can begin

1. Run canonical **Solidity Contracts full repository Foundry inventory** on the *same final implementation candidate SHA*, around four balanced shards as repository CI authorizes.
2. Run **Genesis Address Authority** qualification for canonical addresses, namespace, collision, predeploy, frozen-address and manifests on that SHA, **without duplicating** full Foundry.
3. Run **420 Integrated Qualification** and applicable affected client/service/Indexer/Search/RPC/SDK/integration, static and security/deployment/config checks on that same candidate. Identify inapplicable checks using evidence, not assumption.
4. Run **global Docs qualification** and reconcile architecture, frozen addresses, audit records, BnB 1.x/2.x work, deployment and planned testnet requirements; an expected PR path skip may be appropriate for ordinary steps but **does not qualify final Level 3**.
5. Inspect final GitHub workflow/job/commit evidence. Diagnose failures before retry; changed implementation means a **new exact candidate SHA** and complete applicable requalification.
6. Before merge, refresh main and confirm it has **not advanced** since the reconciliation base. Confirm no missing interfaces, source drift, unapproved production activation, secret exposure, weakened guards or incompatible CI paths.
7. Only after all mandatory checks PASS: record Level 3 completion on exact SHA, authorize PR #616 merge to main and reconcile PR #600 as superseded by the qualified integration. Establish Phase 3 baseline using the actual merged main SHA and a committed canonical Phase 3 roadmap/authority.
8. Keep external/testnet dependencies in `docs/bnb/BNB-TESTNET-WORK-ROADMAP.md` including independently authorized issuers, property and Compliance approvals, Pay finality/reorg/refund evidence, actual deployment/failover/restore, testnet witnesses. Software-only CI is not their acceptance.

**No broad Level 3 runs have been proven from the available GitHub workflows.** Current GitHub connector does not expose workflow dispatch, so no canonical full Solidity, Genesis or global execution is asserted. Do not approve merge or mark BNB-3.1 complete.

## Three-level qualification policy

BNB-3.1 inherits Phase 2 **Level 3 once at closeout**. After approved handoff, Phase 3 ordinary steps use app-scoped Level 1, retained app Level 2 at material milestones and one non-duplicative Level 3 at the next complete phase boundary. Every implementation modification after a qualified SHA invalidates exact-SHA qualification.

**Next action:** complete outstanding BNB-2.15 Level 3 gates on PR #616; approve/publish canonical Phase 3 roadmap, then create Phase 3 development baseline from reconciled, qualified and merged main. No Phase 3 implementation changes authorized as already qualified.

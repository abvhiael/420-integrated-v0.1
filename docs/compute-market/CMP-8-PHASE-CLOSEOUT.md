# CMP-8 — Phase closeout

Status: **COMPLETE — Level 3 comprehensively qualified on `1889713a30ebee9afbdfc21b151d7c69789c1e09`.**

Durable evidence: [CMP-8 qualification](CMP-8-QUALIFICATION-EVIDENCE.md). The closeout commit is evidence-only and inherits the qualified implementation SHA.

## Scope

CMP-8 closes the human-facing **420Compute application** phase. The accumulated implementation provides researcher/job-owner submission, worker onboarding, verifier views, research-project management, worker health/earnings, completed jobs, CPU/GPU contribution, projects supported, result/verification status, and reputation/stake evidence.

The application does not become protocol authority. Indexed state remains non-authoritative, browser write actions remain reviewed 420Wallet handoffs, and the checked-in runtime remains fail-closed until CMP-9 materializes canonical public-testnet endpoints and addresses.

## Reconciliation

- current-main baseline: `0993ff5b5b3b213a0768dbde90e4734df5ab4cc0`
- reconciliation merge anchor: `f8970cc02d5d780471c04bab955d396032eeee74`
- branch behind current main immediately after reconciliation: **0**
- reconciliation was conflict-free because current-main changes were confined to ReeferReview surfaces.

## Level 1 and Level 2

CMP-8 is one canonical roadmap step.

Level 1 is the app-specific set of directly affected checks:
- 420Compute web structure/security/unit/build;
- affected 420Indexer Compute projection/API tests;
- Compute API regression;
- node420-compute configuration/resource-control regression;
- inventory verifier.

The single meaningful Level 2 milestone is **human participation convergence**, owned by the retained 420Compute integration job: web + Compute API/SDK + Indexer application projections + worker participation controls on one exact SHA.

## Required Level 3 owners

One exact accumulated merge-candidate SHA must pass:

1. **Solidity Contracts** — canonical full repository Foundry inventory once, four balanced PR shards;
2. **Genesis Address Authority** — namespace/address/predeploy/frozen-manifest authority without duplicate full Foundry;
3. **420 Integrated Qualification** — global runtime/build/Geth/fault/dependency qualification;
4. **420Docs Qualification**;
5. **Compute Market Qualification** — retained protocol regression and CMP-8 closeout verifier;
6. **420Compute App Qualification** — retained human-facing web/Indexer/API/worker integration;
7. **420Indexer** direct qualification;
8. **420Indexer** shared-consumer qualification;
9. **420 Genesis Contract Hardening** — size/invariant/static/security/Slither gate.

No Wallet-wide rerun is required solely because CMP-8 creates Wallet handoff intents: CMP-8 does not modify Wallet implementation or signing authority. The handoff schema and fail-closed write boundary are exercised by the app suite.

## Security and authority invariants

The candidate must preserve:

- no browser private-key, mnemonic, seed-phrase or credential custody;
- no direct browser canonical writes;
- Compute API submission remains `READY_FOR_WALLET_AUTHORIZATION`;
- Indexer and dashboard state remain `authoritative:false`;
- collection reads are chain-scoped and bounded;
- signed reputation totals decode correctly as `int256`;
- stake views expose only captured reference evidence and do not invent stake amounts;
- CPU/GPU contribution and projects-supported counts derive from canonical `ContributionRecorded` records;
- earnings derive from useful-reward accounting;
- local project preferences never masquerade as scheduler/canonical assignment authority;
- worker CPU/GPU limits map to the qualified packaged worker argument model.

## Deployment boundary

CMP-8 is repository application qualification, **not** public-testnet deployment.

Deferred to CMP-9:
- canonical runtime endpoint/address materialization;
- public 420Compute deployment;
- live worker package distribution/signing channels;
- real worker fleet operation;
- real funded $420 jobs;
- end-to-end matching/execution/verification/payment/refund/dispute evidence.

## Completion rule

CMP-8 may be marked COMPLETE only after every required Level-3 owner passes one exact reconciled implementation SHA. Durable qualification evidence is committed afterward as evidence-only and inherits that qualified implementation SHA without recursively rerunning substantive qualification.

Next canonical phase: **CMP-9 — Public testnet compute**.

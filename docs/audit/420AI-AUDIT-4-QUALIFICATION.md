# AI-AUDIT-4 — current ComputeMarket integration qualification

Status: **COMPLETE**  
Qualification: **Level 1 step qualification + Level 2 app-integration milestone coverage**  
Application: **420AI**  
Repository: `abvhiael/420-integrated-v0.1`  
Audit branch: `audit/420ai-complete-20261002`  
Pull request: **#491**  
Qualified implementation SHA: `3108fa8f17c1e9482c6506cc39ea64e56fd8727f`  
Qualification base / PR base SHA: `b58b09a17e641a42b81d832bad913a83c7caada9`  
Current main observed at durable closeout: `edfd0752e825fc5379700851358e8398efb0b9c5`  
Workflow: **420AI Audit Qualification**  
Workflow run: **37093230900**

## Canonical requirements satisfied

AI-AUDIT-4 requires the AI request path to bind to the **current** ComputeMarket request/job/worker/verifier/economic authorities, prove that adaptation may narrow but not broaden user constraints, bind accepted identities/economics/result evidence, and add end-to-end AI-to-CMP entitlement/refund coverage.

The qualified implementation satisfies that boundary without introducing a parallel AI compute marketplace.

### Request and manifest binding

`AIComputeAdapter420` now binds an AI request to the current CMP signed request authority and canonical job registry. Its deterministic adaptation manifest commits to:

- AI request ID;
- deployment ID;
- model-version identity;
- compute-requirement identity;
- privacy-policy identity;
- verification-profile identity;
- workload class;
- input commitment;
- model-version output-schema commitment;
- narrowed maximum spend; and
- narrowed deadline.

The CMP request owner, workload, input and output commitments must match the AI/model semantics. CMP spend and deadline may be narrower but may not exceed the AI authorization or actually confirmed AI funding.

### Provider, deployment and accepted economics

The selected AI deployment binds one model version, AI provider and expected compute offer. The AI provider's `computeProviderRef` must resolve to the accepted CMP provider.

The accepted priced match must preserve the bound offer and provider and freezes:

- CMP job and match identity;
- resource identity;
- payer;
- provider-derived beneficiary;
- accepted fixed price;
- funded amount and payer ceiling.

The accepted amount, CMP payer maximum and CMP funded amount may not exceed the narrowed AI/CMP request ceiling. The beneficiary must equal the canonical current CMP provider settlement account.

### Result, verification and entitlement binding

Canonical CMP execution/result evidence advances the constrained AI lifecycle only after the corresponding current CMP state exists. The CMP result commitment is copied unchanged into AI result state; AI stores a deterministic evidence commitment rather than inventing a second output.

AI verification advances only when the CMP verified entitlement binds the same:

- compute request/job;
- accepted match;
- result commitment;
- verification reference/verifier;
- payer;
- provider;
- resource;
- beneficiary;
- accepted price and bounded earning.

Settlement and original-payer refund references are observed from the canonical CMP settlement authority. AI-AUDIT-4 does not move funds or fabricate settlement state.

## Exact-head qualification

420AI Audit Qualification **run 37093230900** passed against exact implementation SHA `3108fa8f17c1e9482c6506cc39ea64e56fd8727f`:

- `compute-integration` — job **111117818705** — PASS
- `genesis-compatibility` — job **111117818829** — PASS
- `focused-ai-contracts` — job **111117818837** — PASS
  - AI contract build — PASS
  - focused/retained AI Foundry suites — PASS
- `v1-modules` — job **111117818860** — PASS
- `audit-state` — job **111117818885** — PASS

Two deterministic CI defects were diagnosed during qualification rather than blindly rerun:

1. the AI-AUDIT-3 V1 verifier still prohibited the lifecycle integration that AI-AUDIT-4 is explicitly required to implement; it was corrected to preserve single-authority/module invariants across later roadmap steps;
2. the new Foundry integration harness evaluated `router.componentGraphHash()` after `vm.prank(ALICE)`, consuming the prank before `bindComputeRequest`; argument evaluation was separated from the pranked call without weakening production authorization.

The corrected exact head then passed all required app-specific checks.

## Security / adversarial / invariant coverage

The qualified step proves or explicitly checks that:

- spend and deadline cannot broaden during AI-to-CMP adaptation;
- contradictory manifest terms fail closed;
- wrong accepted provider or beneficiary fails closed;
- deployment/provider/offer/resource identities remain cross-bound;
- payer and beneficiary come from canonical CMP evidence rather than caller selection;
- terminal CMP states cannot be mistaken for successful progression merely because of enum ordering;
- result commitment and verified entitlement evidence remain immutable and cross-consistent;
- settlement/refund evidence must originate from the bound canonical CMP job;
- retained AI compatibility, hardening, model-rights, V1 module and rewards regressions remain green.

## Level 2 milestone

AI-AUDIT-4 is a meaningful cross-component AI/ComputeMarket integration boundary. The same exact-head qualification run included both the targeted `compute-integration` verifier and the broader retained focused AI contract suite. That provides the required app-focused Level 2 integration protection without duplicating repository-wide Level 3 inventories.

## Intentionally deferred

**AI-AUDIT-5** owns compatibility custody, settlement-state and dispute reconciliation: 420Vault/CMP settlement usage, payer segregation, one-time settlement/refund synchronization, dispute holds/resolution, objective slashing boundary and non-confiscatory emergency behavior.

**Level 3** remains deferred to complete 420AI app-phase closeout: current-main reconciliation, canonical full Solidity qualification, Genesis/address-authority qualification, 420 Integrated/global qualification, Docs/global reconciliation and other affected services/clients/security/deployment checks.

Live deployment, ProtocolRegistry publication and production-equivalent testnet evidence remain later roadmap work.

## Base/main note

The implementation was qualified while PR #491's base was `b58b09a17e641a42b81d832bad913a83c7caada9`. At durable-evidence closeout, repository `main` had advanced to `edfd0752e825fc5379700851358e8398efb0b9c5`.

This closeout records that divergence explicitly. It does not claim reconciliation with the newer main and does not alter the already-tested implementation. Current-main reconciliation remains a later milestone/Level 3 responsibility unless an earlier canonical step materially requires it.

## Completion

All AI-AUDIT-4 repository-side exit criteria are satisfied. There are no AI-AUDIT-4 blockers.

**Next canonical roadmap step: AI-AUDIT-5 — custody, settlement and disputes.**

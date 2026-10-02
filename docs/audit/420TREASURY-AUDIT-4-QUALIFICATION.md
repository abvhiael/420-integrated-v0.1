# 420Treasury TREASURY-AUDIT-4 qualification evidence

Status: **COMPLETE**  
Roadmap step: **TREASURY-AUDIT-4 — Vault release evidence model**  
Qualification level: **Level 1 — per-roadmap-step fast qualification**  
Implementation SHA: `afc1e8d7c6742b6568db9170decc70d7eadbc763`  
Qualification base/main SHA: `27ae1873edcca8fb05dec9f4e70af9832b5dafe2`  
Audit branch: `audit/420treasury-complete-20261001`  
Pull request: **#474**  
CI workflow: **420Treasury audit qualification**  
Passing workflow run: **36972209878**  
Passing job: **110728359462**

## Canonical decision

TREASURY-AUDIT-4 adopts and freezes:

- evidence model version: `420/TREASURY/VAULT_RELEASE_COMMITMENT/V1`;
- mode: `AUTHORIZED_EXECUTOR_COMMITMENT_ONLY`;
- custody authority: `420Vault VAULT_TREASURY`;
- Treasury cryptographic Vault verification: **false**.

The exact-disbursement authorized executor supplies a nonzero `vaultReleaseHash` derived from the actual Vault release evidence. Treasury records that commitment as its audit link, settles Treasury budget accounting, and marks the disbursement `EXECUTED`.

The commitment is Treasury completion evidence. It is **not independent cryptographic proof inside Treasury** that the underlying 420Vault transfer occurred.

Production-equivalent live qualification must correlate the retained commitment with the actual canonical Vault release transaction/event/receipt evidence.

## Historical PR reconciliation

Original PR #25, **feat(treasury): add Genesis 420Treasury control plane**, included both:

- "one-time governance-bound disbursement controller for atomic reserve/settle/release accounting"; and
- "nonzero Vault release commitments for public auditability".

The same PR explicitly stated that 420Treasury is the public-funds budget/disbursement control plane, not an independent custody system, and that assets remain in 420Vault.

Repository implementation and current architecture resolve the phrase "atomic reserve/settle/release accounting" as **Treasury budget commitment accounting**:

- scheduling calls Treasury budget `reserve`;
- successful execution calls Treasury budget `settle`;
- cancellation calls Treasury budget `release`.

It does not mean that Treasury atomically performs the underlying 420Vault transfer.

The historical PR language is therefore consistent with the adopted commitment-only Vault release evidence model and the current architecture.

## Files changed for the implementation candidate

### `contracts/config/420treasury-genesis.json`

Added a machine-readable `vault_release_evidence_model` defining:

- version;
- commitment-only mode;
- no Treasury-side cryptographic Vault verification;
- canonical Vault custody authority;
- explicit executor trust assumption;
- downstream consumer semantics and live-correlation requirement.

### `docs/architecture/decisions/TREASURY-AUDIT-4-VAULT-RELEASE-EVIDENCE-MODEL.md`

Added the adopted architecture decision documenting:

- commitment-only semantics;
- PR #25 reconciliation;
- executor trust boundary;
- downstream consumer rule;
- non-goals;
- live/testnet evidence requirement.

### `docs/architecture/protocols/stake-governance-treasury-grants.md`

Updated the canonical Treasury architecture to state explicitly that:

- Treasury does not cryptographically verify the Vault transfer;
- `EXECUTED + nonzero vaultReleaseHash` is Treasury completion evidence;
- it is not independent cryptographic proof of the underlying Vault release;
- production-equivalent qualification must correlate the commitment to actual canonical Vault release evidence.

### `contracts/test/GrantsGenesis420.t.sol`

Strengthened the existing Grants consumer qualification so a milestone cannot transition to `PAID` when the bound Treasury disbursement is `EXECUTED` but its `vaultReleaseHash` is zero.

The same test then proves that `EXECUTED + nonzero vaultReleaseHash` permits the expected paid transition.

### `.github/workflows/treasury-audit.yml`

Extended exact-head Treasury qualification to:

- build the affected Grants consumer;
- run the Grants Genesis consumer suite;
- validate the frozen machine-readable release evidence model;
- inventory every runtime `vaultReleaseHash` consumer;
- fail if an unqualified new runtime consumer appears;
- verify the Grants source still requires both `EXECUTED` and nonzero `vaultReleaseHash`.

## Runtime consumer inventory

Exact-head source qualification found only:

1. `contracts/src/treasury/TreasuryDisbursementRegistry420.sol` — producer/record of `vaultReleaseHash`;
2. `contracts/src/grants/GrantMilestoneRegistry420.sol` — downstream runtime consumer.

No other runtime Solidity source consumes `vaultReleaseHash` on the qualified head.

Any future consumer must be explicitly qualified against the same evidence semantics or a later adopted model revision.

## Executor trust assumption

The V1 model intentionally contains a trust boundary:

- scoped capability authorization proves that the caller is authorized for the exact disbursement and amount;
- Treasury requires the supplied commitment to be nonzero;
- Treasury does not itself verify that the hash corresponds to a real Vault release;
- an authorized executor could submit an arbitrary nonzero value unless deployment/operational controls ensure commitments are derived from actual canonical Vault release evidence.

This assumption is now explicit rather than implicit.

It must remain visible in operator/security/testnet documentation and must never be presented as cryptographic Vault verification.

## Level 1 exact-head qualification

Workflow run `36972209878`, job `110728359462`, exact implementation SHA `afc1e8d7c6742b6568db9170decc70d7eadbc763`:

- exact-head checkout: **PASS**
- Foundry setup: **PASS**
- Treasury Solidity formatting: **PASS**
- Treasury + affected Grants consumer build: **PASS**
- retained Treasury lifecycle regression suite: **PASS — 9 passed, 0 failed, 0 skipped**
- retained Treasury security/property suite: **PASS — 5 passed, 0 failed, 0 skipped**
- affected Grants release-evidence consumer suite: **PASS — 4 passed, 0 failed, 0 skipped**
- Treasury canonical authority/config verifier: **PASS**
- Vault release evidence consumer inventory: **PASS**
- targeted Treasury Slither high-severity gate: **PASS — 0 high-severity findings**
- Treasury forbidden-primitive scan: **PASS**

The repository `Solidity Contracts` pull-request workflow also concluded **SUCCESS** on this same implementation SHA. That result is supplementary to the targeted Level 1 qualification and is not represented as final Level 3 closeout.

## Requirement-by-requirement exit verification

### Reconcile original PR language with current architecture

**SATISFIED.**

The original "atomic reserve/settle/release accounting" phrase is tied to the implemented Treasury budget commitment lifecycle and is not an assertion of Treasury-side Vault transfer execution.

PR #25's separate nonzero release-commitment requirement and explicit no-custody boundary agree with the current architecture.

### Freeze the adopted evidence model or introduce an adopted verifier

**SATISFIED by freezing the commitment-only model.**

No unadopted Vault receipt/verifier interface was invented. 420Vault remains the sole custody/release authority.

The model is now frozen in machine-readable Treasury config and architecture decision documentation.

### Document executor trust assumption

**SATISFIED.**

The repository now explicitly states that Treasury authorization + nonzero commitment does not prove the underlying Vault transfer and identifies the requirement for live evidence correlation.

### Qualify Grants and other consumers

**SATISFIED.**

- Grants consumer test proves `EXECUTED` with a zero commitment cannot finalize payment.
- Positive Grants path proves `EXECUTED + nonzero commitment` can finalize.
- Source inventory confirms no other runtime consumer exists on the qualified head.
- CI will fail if a new runtime consumer appears without qualification.

## Security/adversarial result

No new custody or transfer authority was added to Treasury.

The adopted model preserves:

- 420Vault as custody/release authority;
- default-deny exact-disbursement capability authorization;
- Treasury's separate budget accounting;
- explicit fail-closed Grants behavior when release evidence is absent.

Targeted Slither reported **zero high-severity Treasury findings** and the forbidden-primitive scan passed.

The remaining risk is explicit and intentional: an authorized executor can submit a nonzero commitment without Treasury independently verifying its relationship to a real Vault release. That risk is owned by the adopted V1 trust model and must be tested against actual Vault evidence during live qualification.

## Milestone status

TREASURY-AUDIT-4 is an ordinary Level 1 roadmap step with one directly affected cross-protocol consumer, 420Grants.

The affected Grants suite is included directly in the Treasury Level 1 qualification. No separate broad Level 2 milestone was required because the step did not introduce a new shared custody dependency or change Grants authority; it froze and qualified the already-existing Treasury/Grants evidence boundary.

## Intentionally deferred

Not blockers for TREASURY-AUDIT-4:

- modern Indexer/Explorer/Analytics event/read-model qualification — TREASURY-AUDIT-5;
- deterministic deployment/runtime/ProtocolRegistry materialization — TREASURY-AUDIT-6;
- operator/deployment/recovery documentation closeout — TREASURY-AUDIT-7;
- live correlation of `vaultReleaseHash` with actual canonical 420Vault release evidence — TREASURY-AUDIT-8;
- external security review and final Genesis/production closeout — TREASURY-AUDIT-9;
- repository-wide Level 3 closeout qualification.

## Limitations

Repository-only qualification cannot prove a real Vault release because no production-equivalent testnet deployment is being claimed in this step.

TREASURY-AUDIT-4 therefore freezes the semantics and qualification boundary without fabricating transaction, receipt, event, block, chain, deployment or registry evidence.

## Blockers

**None for TREASURY-AUDIT-4.**

The prior roadmap status **BLOCKED ON CANONICAL DECISION** is resolved by the adopted commitment-only V1 decision.

## Completion determination

Every canonical TREASURY-AUDIT-4 requirement has been satisfied and directly qualified against exact implementation SHA `afc1e8d7c6742b6568db9170decc70d7eadbc763`.

**TREASURY-AUDIT-4 is COMPLETE.**

Next canonical roadmap step: **TREASURY-AUDIT-5 — Indexer/Explorer/Analytics integration**.

# TREASURY-AUDIT-4 — Vault release evidence model decision

Status: **ADOPTED**  
Roadmap step: **TREASURY-AUDIT-4 — Vault release evidence model**  
Decision: **420/TREASURY/VAULT_RELEASE_COMMITMENT/V1**  
Mode: **AUTHORIZED_EXECUTOR_COMMITMENT_ONLY**

## Decision

420Treasury does **not** cryptographically verify or execute the underlying 420Vault release inside `TreasuryDisbursementRegistry420`.

The canonical model is:

1. Governance/Civic creates and bounds the Treasury budget and scheduled disbursement.
2. The exact disbursement executor must already hold the narrowly scoped execution capability.
3. The actual asset release remains inside the canonical `420Vault VAULT_TREASURY` custody/release domain.
4. The authorized executor supplies a nonzero `vaultReleaseHash` derived from the actual Vault release evidence.
5. Treasury records that commitment, settles its own budget accounting, and marks the disbursement `EXECUTED`.
6. Downstream consumers may require `EXECUTED + nonzero vaultReleaseHash` as Treasury completion evidence.
7. The commitment is **not** an independent cryptographic proof inside Treasury that the Vault transfer occurred. Live/testnet qualification must correlate the commitment with the actual Vault release transaction/event/receipt evidence.

Treasury therefore remains a governed budget/disbursement control plane and never becomes a parallel custody system.

## Historical PR reconciliation

Original PR #25 described both:

- a "one-time governance-bound disbursement controller for atomic reserve/settle/release accounting"; and
- "nonzero Vault release commitments for public auditability".

Those statements are not contradictory.

In the implemented Treasury contract family, `reserve`, `settle`, and `release` are operations on **Treasury budget commitment accounting**:

- scheduling reserves budget commitment;
- successful execution settles the committed amount into executed accounting;
- cancellation releases still-unexecuted commitment.

The phrase "atomic reserve/settle/release accounting" therefore describes consistency of the Treasury accounting lifecycle under its one-time controller. It does not state that Treasury atomically performs the underlying 420Vault asset transfer.

The same PR explicitly defined Treasury as the budget/disbursement control plane rather than custody and separately required a nonzero Vault release commitment. The current architecture makes that boundary explicit and is consistent with the actual implementation.

## Executor trust assumption

The commitment-only model has an explicit trust boundary:

- capability authorization proves that the caller is authorized for the exact Treasury disbursement and amount;
- it does **not** prove that the supplied nonzero hash corresponds to a real Vault release;
- Treasury currently checks only that the commitment is nonzero;
- an authorized executor could therefore submit an arbitrary nonzero value unless operational/deployment controls ensure that executors derive it from actual Vault release evidence.

This trust assumption is accepted for the V1 Treasury evidence model and must remain visible in security, operator, deployment, and live-testnet documentation.

It must not be silently upgraded into a claim of cryptographic Vault verification.

## Consumer rule

Runtime source inspection identifies 420Grants as the current downstream consumer of `vaultReleaseHash`.

`GrantMilestoneRegistry420.finalizePaid` may transition a milestone to `PAID` only when the bound Treasury disbursement is:

- `EXECUTED`; and
- has a nonzero `vaultReleaseHash`.

Grants therefore consumes Treasury completion evidence according to this adopted model. It does not independently verify the underlying Vault transfer and must not be documented as doing so.

Any future runtime consumer of `vaultReleaseHash` must be explicitly qualified against this same semantic boundary or a later formally adopted evidence-model revision.

## Non-goals

TREASURY-AUDIT-4 does not:

- add a second custody contract;
- give Treasury unrestricted transfer authority;
- introduce an unadopted Vault receipt/verifier interface;
- claim that a nonzero hash alone proves a Vault release;
- fabricate live Vault, deployment, registry, chain, or transaction evidence.

A future cryptographic verifier model would require a separate adopted architecture/interface decision, migration and compatibility analysis, consumer requalification, and exact-head qualification.

## Release/testnet requirement

Production-equivalent testnet qualification must retain evidence that permits an independent reviewer to correlate each tested Treasury `vaultReleaseHash` with the actual canonical 420Vault release evidence, including applicable transaction/event/receipt identity and chain/block context.

That live correlation is owned by **TREASURY-AUDIT-8** and is not fabricated during this repository-only step.

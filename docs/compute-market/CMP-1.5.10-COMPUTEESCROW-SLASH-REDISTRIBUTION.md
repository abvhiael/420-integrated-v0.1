# CMP-1.5.10 — ComputeEscrow slash-redistribution integration

Status: **IMPLEMENTED. LEVEL 1 + LEVEL 2 QUALIFICATION PENDING.**

## Canonical definition

> ComputeEscrow slash-redistribution integration

CMP-1.5.10 closes the original CMP-1.2 `slash redistribution` cross-phase dependency.

The architecture does **not** debit payer escrow to fund slashes.

Instead:

1. canonical ComputeEscrow/dispute state identifies the harmed payer;
2. objective CMP-1.5 slash authorization freezes that recipient;
3. separately backed worker/verifier collateral is forfeited;
4. the CMP-1.5 distribution path pays the frozen recipient from collateral Vault obligations.

Payer deposits remain payer property except where the already-qualified CMP-1.2 settlement/refund lifecycle lawfully disposes them.

## Repository gap closed

CMP-1.5.6 already implemented policy-bound collateral redistribution and a verifier-dispute recipient resolver.

However, before CMP-1.5.10 the resolver dynamically trusted the entitlement endpoint returned by its dispute engine on each read.

CMP-1.5.10 strengthens the cross-phase binding by freezing:

- exact canonical entitlement contract address;
- exact entitlement runtime code hash.

The resolver refuses endpoint or runtime drift.

## Canonical harmed-payer derivation

`ComputeVerifierDisputeSlashRecipientResolver420` is bound to one exact dispute engine and one exact verifier evidence adapter.

At construction it now requires the dispute engine's entitlement endpoint to exist and freezes:

- `canonicalEntitlements`;
- `canonicalEntitlementsCodeHash`.

At resolution it requires:

- final dispute disposition;
- adverse disposition to the original verification;
- provider/result loss;
- exact verifier subject account;
- nonzero claimant/challenger;
- nonzero job;
- unchanged canonical entitlement endpoint;
- unchanged entitlement runtime code hash;
- nonzero entitlement/claim;
- canonical payer;
- claim still present and not already paid.

The harmed payer therefore comes from the exact ComputeEscrow entitlement snapshot, not caller input.

## Escrow remains read-only to slashing

The real ComputeEscrow integration regression constructs an actual paid job through:

- signed payer funding;
- accepted price reservation;
- verified earning;
- provider claim;
- bounded dispute;
- objective verifier-error ground;
- final payer-win disposition.

It then resolves the harmed payer through the CMP slash recipient resolver and proves that the read:

- returns the original payer;
- returns the canonical claimant as challenger;
- invents no replacement worker;
- does not change Vault balance;
- does not change recorded/reserved/claimable/released accounting;
- does not alter payer refund obligation identity, amount or paid/claimable state.

No ComputeEscrow method is added that can slash, cancel payer credit for punishment, or receive confiscation authority.

## Collateral-only redistribution

Actual slash value remains sourced only from the qualified CMP-1.5 collateral contracts.

The existing CMP-1.5.6 distribution path:

- consumes an objective slash authorization;
- selects the bound worker/verifier collateral source;
- cancels only collateral obligations;
- immediately re-reserves any unslashed collateral remainder;
- creates slash-recipient obligations;
- releases/claims those obligations through the collateral Vault;
- never calls a payer-escrow mutation method.

CMP-1.5.10 does not duplicate that distribution engine. It closes the missing identity/accounting integration boundary.

## CMP-1.2 reconciliation

The original CMP-1.2 closeout explicitly recorded:

`slash_redistribution = FAIL_CLOSED_PENDING_CMP_1_5_STAKE`

CMP-1.5.10 supersedes that repository-level blocker with:

`QUALIFIED_VIA_CMP_1_5_10_COLLATERAL_REDISTRIBUTION`

The remaining CMP-1.2 release blocker is still:

- `CMP-1.2.9-LIVE`.

This step does not fabricate deployment addresses, live transaction receipts, Registry publication, runtime hashes, live capability grants or public-testnet slash evidence.

## Authority boundaries

CMP-1.5.10 does not:

- make payer escrow slashable;
- let ComputeStake settle or refund jobs;
- let ComputeEscrow authorize slash;
- let a claimant choose a payer address;
- let a relayer redirect an authorization;
- convert a generic payer win into objective verifier fault;
- bypass dispute appeal/finality;
- bypass CMP-1.5 slash policy;
- bypass collateral Vault accounting;
- claim live/testnet deployment.

## Qualification

Level 1 covers:

- Compute build;
- exact entitlement endpoint/code-hash freeze;
- endpoint-drift fail-closed behavior;
- real ComputeEscrow harmed-payer resolution;
- escrow Vault/accounting non-mutation;
- CMP-1.2 closeout verifier reconciliation;
- CMP-1.5.10 mechanical verifier.

CMP-1.5.10 is a **Level 2 Compute milestone** because it closes the cross-phase payer-accounting/collateral-redistribution boundary.

The retained `Compute*.t.sol` suite must pass on the same exact implementation SHA.

Repository-wide Level 3 remains deferred to **CMP-1.5.13 — Phase closeout**.

## Exit criteria

CMP-1.5.10 is COMPLETE only when:

- canonical escrow entitlement identity is frozen by address and runtime code hash;
- endpoint/runtime drift fails closed;
- the harmed payer is reconstructed from canonical finalized escrow/dispute state;
- actual recipient resolution does not mutate payer escrow accounting;
- collateral redistribution remains the only slash value source;
- payer deposits are never treated as stake;
- CMP-1.2 machine-readable closeout no longer carries the repository stake/slash blocker;
- CMP-1.2.9 live deployment remains explicitly blocked;
- focused Level 1 qualification passes;
- retained Compute Level 2 qualification passes on the same exact implementation SHA;
- durable evidence records that SHA.

Next canonical step:

**CMP-1.5.11 — Hostile economic qualification**

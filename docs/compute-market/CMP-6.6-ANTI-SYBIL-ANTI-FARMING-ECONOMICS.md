# CMP-6.6 — Anti-Sybil / anti-farming economics

Status: **IMPLEMENTED; QUALIFICATION PENDING.**

## Canonical definition

> Anti-Sybil / anti-farming economics

CMP-6 provides application-layer incentives for verified useful compute. Compute rewards must not replace chain consensus.

CMP-6.6 introduces economic admission controls over already-recorded CMP-6.5 sponsor matches. It does not create a second identity system and does not slash, seize, move, or pay funds.

## Design boundary

The repository already contains role-specific worker, verifier, collateral and research-identity systems. Those authorities are not universal identities for every researcher, university, grant, philanthropic, community or ecosystem funder.

CMP-6.6 therefore treats anti-Sybil protection as an economic-admission problem:

- minimum qualifying contribution;
- per-principal match-count caps;
- per-principal matched-amount caps;
- pool-scoped epochs;
- cooldowns;
- replay prevention;
- governance-controlled clustering of multiple accounts under one anti-farming principal key.

This does not claim that one blockchain address equals one human.

## Policy authority

`ComputeUsefulAntiFarming420` publishes append-only governance policies.

Each policy revision freezes:

- policy ID;
- epoch duration;
- cooldown duration;
- maximum matches per principal per pool per epoch;
- minimum qualifying funding contribution;
- maximum matched amount per principal per pool per epoch;
- publication time;
- revision.

Historic policy revisions remain immutable.

## Principal keys

Every account has a deterministic default anti-farming principal key derived from:

- domain;
- chain ID;
- anti-farming contract address;
- account address.

Governance may set a non-zero principal override to bind known related accounts to the same economic principal.

Governance may clear the override by setting `bytes32(0)`, returning the account to its deterministic address key.

This clustering mechanism is deliberately administrative and narrow. It does not issue credentials, alter Identity420, alter worker identity, or claim proof-of-personhood.

## Admission

`admit(policyId, policyRevision, matchId)` is permissionless relay.

The contract reads the immutable CMP-6.5 match record and its program. The caller cannot choose:

- contributor;
- pool;
- program;
- contributed amount;
- matched amount;
- match timestamp.

Admission fails unless:

- the match exists;
- the match has non-zero matched amount;
- contributed funding satisfies the policy minimum;
- the referenced sponsor program exists;
- the program resolves to a non-zero research pool;
- the match's program ID is exact;
- the match has not already been consumed by CMP-6.6;
- the principal's per-pool epoch match-count cap is not exhausted;
- the principal's per-pool epoch matched-amount cap is not exceeded;
- the pool/principal cooldown has elapsed.

## Epoch and pool scoping

Epoch is derived from the immutable CMP-6.5 `matchedAt` timestamp:

`epoch = matchedAt / epochSeconds`

Count and amount limits are scoped by:

- research pool;
- anti-farming principal;
- epoch.

Independent research pools therefore do not silently consume each other's policy budget.

Cross-epoch capacity resets according to the policy, but exact match replay never resets.

## Cooldown

The policy may require a minimum time between admitted matches for the same pool/principal pair.

A zero cooldown disables only that rule; count, amount, minimum-contribution and replay rules remain active.

Out-of-order older matches fail closed after a newer admitted match when the cooldown would be violated.

## Economic invariants

For one exact policy revision, pool, principal and epoch:

- admitted match count never exceeds the policy count cap;
- admitted matched amount never exceeds the policy amount cap;
- dust contributions below the minimum never qualify;
- one CMP-6.5 match can be admitted only once;
- clustered accounts share the same count and amount budget;
- separate pools maintain separate budgets.

## Authority boundaries

CMP-6.6 does not:

- mint native $420;
- replace consensus rewards;
- move Vault value;
- create/release/cancel/claim Vault obligations;
- slash worker/verifier stake;
- seize sponsor funds;
- transfer sponsor funds;
- change CMP-6.5 sponsor capacity;
- change CMP-6.4 pool configuration;
- create payout entitlements;
- choose reward beneficiaries;
- convert contribution metrics into token value;
- settle Compute jobs;
- issue Identity420 credentials;
- claim proof-of-personhood.

CMP-6.7 remains responsible for transparent reward accounting.

## Qualification level

CMP-6.6 is an ordinary **Level 1** step following the CMP-6.5 Level-2 integration milestone.

The change is app-scoped and consumes established CMP-6.5 records without introducing a new custody, settlement or shared protocol authority.

Repository-wide Level 3 remains deferred to **CMP-6.8 — Phase closeout**.

## Focused qualification

Coverage must prove:

- valid matches admit under exact frozen policy limits;
- dust/minimum-contribution farming fails closed;
- repeated matches hit per-principal count caps;
- split funding hits per-principal amount caps;
- cooldown rejects rapid repetition;
- multiple addresses clustered to one principal share limits;
- independent research pools remain isolated;
- new epochs restore policy budget;
- exact match replay never resets;
- policy revisions are append-only;
- historic policy commitments are immutable;
- only governance can set principal overrides;
- no payout, Vault, stake-slash or consensus authority is introduced.

## Limitations

Economic controls reduce common farming strategies but cannot prove that unrelated addresses belong to the same real-world person.

Known related accounts can be clustered by governance. Stronger identity guarantees must come from canonical identity/credential systems where applicable, not from invented heuristics in CMP-6.6.

## Exit criteria

CMP-6.6 is COMPLETE only when:

- append-only economic policies exist;
- default and governance-clustered principal keys exist;
- minimum contribution, count, amount, epoch, cooldown and replay controls are enforced;
- pool scoping is deterministic;
- clustered-address farming is covered;
- exact match replay is terminal;
- no fund movement, slashing or payout authority is introduced;
- focused Level 1 tests and repository verifier pass;
- exact-head Compute Market qualification passes;
- durable repository evidence records the qualified implementation SHA.

Durable evidence: [CMP-6.6 qualification](CMP-6.6-QUALIFICATION-EVIDENCE.md).

Next canonical step:

**CMP-6.7 — Transparent reward accounting**

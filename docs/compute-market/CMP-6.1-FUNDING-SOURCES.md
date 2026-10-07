# CMP-6.1 — Funding sources

Status: **IMPLEMENTED; LEVEL 1 QUALIFICATION PENDING.**

## Canonical definition

> Researcher, university, grant, philanthropic, community and ecosystem-funded jobs/pools.

CMP-6 provides application-layer incentives for verified useful computation. Compute rewards must not replace chain consensus.

CMP-6.1 establishes the funding/custody provenance needed by later CMP-6 reward steps without implementing reward eligibility, verification gating, contribution metrics, research-pool policy, sponsor matching, anti-Sybil economics or payout accounting.

## Purpose

CMP-6.1 answers:

> Where did separately supplied useful-computation reward funding come from, what job or pool was it intended to support, and is the value actually held by canonical Vault custody?

The step deliberately does not answer:

> Who earned a reward, how much did they earn, or may value be released?

Those questions remain owned by CMP-6.2 and later steps.

## Canonical funding source classes

`ComputeUsefulRewardFunding420` preserves the six funding-source classes named by the roadmap:

1. researcher;
2. university;
3. grant;
4. philanthropic;
5. community;
6. ecosystem.

The source kind is funding provenance metadata. It is **not** proof that a caller is an accredited university, grant administrator, charity or ecosystem authority. Identity/credential assertions must remain separately verified by the appropriate identity/policy layer.

## Funding targets

A contribution is explicitly scoped to exactly one:

- `TARGET_JOB`; or
- `TARGET_POOL`.

The target reference is an opaque non-zero commitment/identifier. CMP-6.1 does not reinterpret JobRegistry, scientific project, external-work or later reward-pool authority.

## Canonical custody

Every accepted contribution is native $420 supplied by the caller and immediately deposited into one configured `AssetVault420`.

The contract records:

- exact contributor;
- source kind;
- target kind;
- target reference;
- caller-supplied unique funding reference;
- amount;
- funding timestamp;
- immutable contribution ID;
- aggregate funding by contributor, source kind and target.

A successful contribution therefore proves that the recorded amount reached canonical Vault accounting.

CMP-6.1 does **not** create a parallel treasury.

## Replay and atomicity

The funding reference is consumed under a domain that includes:

- chain;
- funding contract;
- contributor;
- source kind;
- target kind;
- target reference;
- funding reference.

Reusing the same exact funding reference for the same contribution domain fails closed.

State is written before the Vault call only within the same transaction. If the Vault rejects the deposit, EVM atomicity rolls back the consumed reference and every accounting write.

## Authority boundaries

CMP-6.1 does not:

- mint native $420;
- call or substitute for consensus reward issuance;
- debit payer/job escrow;
- create, release, cancel or claim Vault obligations;
- withdraw from the reward Vault;
- decide whether computation is valid;
- decide reward eligibility;
- choose a worker/verifier beneficiary;
- calculate useful-computation reward amounts;
- consume CMP-5 external-work reward opportunity;
- implement sponsor matching;
- implement anti-Sybil/anti-farming policy.

The deposited value remains unencumbered canonical Vault backing until later CMP-6 authority is implemented and qualified.

## Relationship to existing reward accounting

CMP-1.5.7 already provides a separately authorized, Vault-backed worker/verifier stake-reward accounting primitive. Its canonical scope explicitly excludes later useful-computation sponsor/research reward pools.

CMP-6.1 therefore reuses `AssetVault420` custody while keeping useful-computation funding provenance separate from ComputeStake reward evidence and accounting.

## Security and qualification

Focused Level 1 coverage must prove:

- all six canonical source kinds are accepted;
- only canonical source-kind values are accepted;
- both job and pool targets are supported;
- zero amount, zero target reference and zero funding reference fail closed;
- invalid target kinds fail closed;
- exact funding-reference replay fails closed;
- independent source classes can converge on one pool;
- successful funding increases canonical native-$420 Vault accounting exactly;
- CMP-6.1 creates no Vault payout obligation;
- source/contributor/target totals remain exact;
- no reward, mint, payer-escrow, withdrawal or consensus authority is introduced;
- the app-specific Compute Market qualification runs against the exact implementation SHA.

CMP-6.1 is an ordinary **Level 1** step. It does not itself introduce reward release authority or a cross-component milestone requiring Level 2.

Level 2 remains deferred until a meaningful CMP-6 integration boundary.

Repository-wide Level 3 remains deferred to **CMP-6.8 — Phase closeout**.

## Exit criteria

CMP-6.1 is COMPLETE only when:

- the six roadmap funding source classes are represented;
- funding can target canonical job-or-pool references;
- accepted funding is real separately supplied native $420;
- accepted funding reaches canonical `AssetVault420` custody atomically;
- contribution provenance and aggregate accounting are deterministic;
- exact funding-reference replay is rejected;
- malformed/zero funding fails closed;
- no payout, reward-eligibility, verification, mint, payer-escrow or consensus authority is introduced;
- focused contract tests pass;
- the CMP-6.1 repository verifier passes;
- exact-head Compute Market Level 1 qualification passes;
- durable qualification evidence records the implementation SHA.

Next canonical step:

**CMP-6.2 — Verification-gated rewards**

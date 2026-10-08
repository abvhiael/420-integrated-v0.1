# CMP-6.5 — Sponsor matching

Status: **IMPLEMENTED; QUALIFICATION PENDING.**

## Canonical definition

> Sponsor matching

CMP-6 provides application-layer incentives for verified useful compute. Compute rewards must not replace chain consensus.

CMP-6.5 introduces bounded, prefunded sponsor matching for research-pool funding.

It deliberately matches **CMP-6.1 native-$420 pool funding contributions**, not CPU/GPU/project-credit metric units. CMP-6.3 metrics are scientific/accounting units, and CMP-6.7 has not yet defined token reward accounting. Assigning a token value to those units here would silently pull CMP-6.7 economics forward.

## Sponsor program funding

Every sponsor program is backed by one exact prior CMP-6.1 contribution.

The backing contribution must:

- exist;
- belong to the sponsor creating the program;
- target `TARGET_POOL`;
- target the exact CMP-6.4 research pool;
- have non-zero native-$420 amount.

The sponsor contribution amount becomes the program's maximum total match capacity.

No synthetic or unbacked match capacity can be created.

## Matching policy

Each program freezes:

- research pool ID;
- sponsor funding contribution ID;
- sponsor address;
- numerator;
- denominator;
- total prefunded capacity;
- per-contribution match cap;
- creation time.

The match ratio uses integer native-$420 accounting:

`matched = contribution.amount * numerator / denominator`

The result is then bounded by:

1. the per-contribution cap; and
2. remaining sponsor capacity.

Zero-value matches fail closed.

## Eligible matched funding

A funding contribution can be matched only when:

- the program exists and is active;
- the CMP-6.4 pool exists and is accepting contributions;
- the contribution exists;
- it targets the same pool;
- it has non-zero amount;
- the contributor is non-zero;
- the contributor is not the sponsor;
- it is not the sponsor's backing contribution;
- it was funded after the match program was created;
- it has not already been matched by the same program.

The relay caller does not choose the contributor, contribution amount, pool, or sponsor.

## Replay and self-match protection

Matching is one-time per program + funding-contribution pair.

Sponsor self-funding cannot be matched.

A sponsor cannot reuse the backing contribution as both capacity and matched public funding.

These are basic sponsor-matching integrity controls. More comprehensive identity/Sybil/farming economics remain explicitly reserved for **CMP-6.6**.

## Pool admission dependency

CMP-6.5 respects the live CMP-6.4 pool admission state.

If a pool is paused, new sponsor-match records fail closed.

Historic match records remain immutable accounting evidence.

## Authority boundaries

CMP-6.5 does not:

- mint native $420;
- replace consensus rewards;
- move Vault value;
- create/release/cancel/claim Vault obligations;
- withdraw sponsor backing;
- transfer funds;
- create payout entitlements;
- choose reward beneficiaries;
- convert CPU/GPU/project-credit metrics into token value;
- debit payer escrow;
- settle Compute jobs;
- implement general anti-Sybil / anti-farming economics;
- perform transparent reward payout accounting.

The sponsor's CMP-6.1 funds are already separately deposited in canonical custody before the matching program is created.

CMP-6.5 only records how much of that finite prefunded capacity has been committed as a sponsor match.

## Qualification level

CMP-6.5 is the next **Level 2 app integration milestone**.

Reason: it is the first CMP-6 step where previously separate useful-reward components converge into an economic commitment lifecycle:

1. CMP-6.1 pool funding provenance;
2. CMP-6.4 research-pool admission;
3. sponsor-owned prefunded capacity;
4. deterministic ratio/cap matching;
5. replay-safe consumption of that finite capacity.

Level 2 remains app-focused through the retained Compute Market suite. Repository-wide Level 3 remains deferred to **CMP-6.8 — Phase closeout**.

## Focused qualification

Coverage must prove:

- sponsor capacity comes only from exact sponsor-owned CMP-6.1 pool funding;
- one-to-one matching;
- non-1:1 ratios;
- per-contribution caps;
- final remaining-capacity clipping;
- sponsor self-match rejection;
- backing-contribution reuse rejection;
- exact contribution replay rejection;
- wrong-pool funding rejection;
- pre-program funding rejection;
- paused-pool rejection;
- only the sponsor controls program activation;
- invalid ratios fail closed;
- foreign funding cannot back another sponsor's program;
- matching accounting never exceeds prefunded capacity;
- no Vault movement or payout authority is introduced.

## Exit criteria

CMP-6.5 is COMPLETE only when:

- every sponsor program has exact prefunded backing;
- total match accounting cannot exceed backing capacity;
- match ratio and per-contribution cap are immutable;
- sponsor self-match and replay are rejected;
- only same-pool post-program third-party funding can be matched;
- paused pools fail closed;
- no reward-unit valuation or payout authority is introduced;
- focused Level 1 checks pass;
- retained Compute Market Level 2 qualification passes on the same exact implementation SHA;
- durable repository evidence records the qualified implementation SHA.

Durable evidence: [CMP-6.5 qualification](CMP-6.5-QUALIFICATION-EVIDENCE.md).

Next canonical step:

**CMP-6.6 — Anti-Sybil / anti-farming economics**

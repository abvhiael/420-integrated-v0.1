# 420Automation

420Automation is the replaceable off-chain scheduling and execution-coordination layer for 420 Integrated. It discovers when a protocol-defined job is eligible, validates the trigger and job boundary, and coordinates bounded transaction submission without becoming protocol, consensus, custody, bridge, oracle, or wallet authority.

## Core rule

**A trigger means a registered job may be eligible for evaluation. It never grants ambient execution authority.**

420Automation workers may observe time, block, event, 420Oracle automation-feed, and explicit manual triggers. The consuming protocol or job definition still owns authorization, target, calldata/value bounds, timing, replay rules, and the state transition itself.

Workers never custody user keys, sign as users, invent target/calldata/value, bypass contract authorization, define canonical/finalized chain state, convert oracle data into remote execution authority, substitute for bridge proofs, or expose Engine API authority.

## AUT-0 through AUT-10

AUT-0 through AUT-10 established the architecture/trust boundary, immutable job identity and execution envelopes, deterministic trigger normalization and scheduling, bounded execution, fee/funding limits, replay-safe recovery, worker leases/liveness, provider-neutral 420Oracle integration, authenticated Developer Hub/API access, and bounded readiness/observability.

Important invariants carried forward from those phases include:

- job target, selector, calldata commitment, native-value bound, and gas bound are fixed by the registered job rather than invented by workers;
- trigger eligibility is distinct from protocol authorization;
- ambiguous or reorg-affected submissions never replay speculatively;
- workers are replaceable infrastructure and never user-signing/custody authorities;
- Oracle data is consumed only through the approved provider-neutral boundary;
- API credentials are scoped service credentials, not protocol identity;
- readiness and telemetry are operator signals, not canonical truth.

## AUT-11 — security hardening

AUT-11 adds the hostile-state security layer and cross-layer adversarial qualification for the complete Automation pipeline.

The security module adds authenticated observation envelopes with explicit source identity, chain-420 binding, bounded clock skew, freshness requirements, monotonic source sequencing, and signature verification. A bounded replay guard rejects duplicate request identities and non-monotonic source sequences and fails closed at configured capacity rather than evicting live replay protections.

Execution security adds explicit calldata-size, gas, retry, batch-job, and batch-byte ceilings. Finality protection rejects finalized-height rollback, finalized-hash conflicts, malformed chain ordering, and safe-head observations that move behind previously accepted finality.

Operational output is hardened as well: recursive secret redaction removes credential-like fields from diagnostic structures, metric labels are bounded and low-cardinality, and secret/high-cardinality dimensions are rejected rather than exported.

AUT-11 also includes cross-layer qualification proving that spoofed manual triggers cannot gain eligibility, consumed occurrences remain replay-suppressed under repeated/racing delivery, trigger evaluation cannot mutate an AUT-1 execution envelope, tampered calldata fails before submission, finalized-chain conflicts fail closed, and hostile diagnostic payloads do not leak secrets.

The AUT-11 implementation and cross-layer suite passed both the dedicated 420Automation workflow and the full 420 Integrated qualification workflow on the qualified branch head.

## Current status

AUT-0 through AUT-11 are implemented and qualified on the AUT-11 branch. AUT-11 remains pending final branch reconciliation/documentation closeout and merge into `main`.

The next planned phase is **AUT-12 — public-testnet qualification and launch closeout**, covering exact release identity, live worker/job evidence, failure drills, compatibility evidence, and an explicit go/no-go decision.

## Delivery discipline

Each Automation phase is developed on its own branch and pull request, reconciled against current `main`, fully qualified on its exact final head, and merged before the next phase starts.

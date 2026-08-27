# 420Trust V1 Model

Status: **FROZEN FOR IMPLEMENTATION**

420Trust is the portable evidence and reputation-signal protocol for 420 Integrated. It does **not** assign a universal social, financial, political, or behavioral score. Canonical state records authenticated domain-specific facts and objective measurements. Applications may apply their own versioned policy to those facts.

## Core distinction

- **420 Identity** answers who/what an entity is and which credentials it possesses.
- **420Trust** records what verifiable protocol history that entity has accumulated.

Neither protocol may silently absorb the authority of the other.

## Canonical V1 objects

### Issuer
A protocol contract, system component, organization, or approved operator authorized to publish narrowly scoped Trust signals. Issuers have stable `issuerId` values, current operators, active state, metadata commitments, and epochs.

### Metric
A versioned, domain-scoped measurement definition. A metric binds:
- `metricId`
- `domainId`
- canonical unit identifier
- metadata/specification commitment
- revision
- active state

### Signal
An immutable evidence record binding:
- `signalId`
- subject type and subject ID
- domain and metric
- issuer
- signed integer value
- evidence commitment/reference
- occurrence time
- recording time
- metric revision
- issuer epoch
- optional correction predecessor

### Aggregate
A deterministic per-subject, per-metric aggregate consisting only of the sum of currently active signal values and active signal count. It is **not** a universal reputation score.

## Genesis domains

Canonical V1 domain namespaces include Market, Oracle, Resource, Validator, Pay, Creative, Game, and AI. Governance may add future metrics/domains through explicit versioned policy rather than string-based execution logic.

## Issuance

A signal is accepted only when:
1. the issuer exists and is active;
2. the caller is the issuer's current operator;
3. the metric exists and is active;
4. that issuer is explicitly authorized for that metric;
5. the subject, signal ID, evidence reference, and occurrence time are valid;
6. the signal ID has never been used;
7. the same issuer/subject/metric/evidence tuple has never been used.

Issuer authority is reporting-only. It conveys no custody, transfer, governance, bridge, validator, oracle-routing, identity, or arbitrary execution authority.

## Corrections

Corrections are append-only. A corrected signal remains historically readable and points to its replacement through `supersededBy`. A replacement signal records `correctionOf`. The active aggregate removes the superseded value and adds the replacement value atomically.

Only the same stable issuer may correct its signal, using its current authorized operator. A correction must carry a new evidence reference.

## Revocation

An issuer's current operator may revoke an unsuperseded signal issued by that stable issuer, including after the issuer is deactivated. Revocation removes the signal from the active aggregate but never deletes or rewrites the historical signal. A nonzero reason commitment is recorded in the revocation event/state.

## Privacy

Sensitive personal information, review text, KYC documents, delivery addresses, health information, and other private payloads are non-canonical. Trust stores only minimal identifiers, typed values, commitments, timestamps, and evidence references needed for verification.

## V1 exclusions

420Trust V1 does not:
- create a global trust/social/credit score;
- accept arbitrary subjective star ratings as canonical protocol truth;
- custody funds or assets;
- mint or transfer rights;
- determine Identity420 credentials;
- grant validator or governance weight;
- permit stake-weighted reputation issuance;
- execute arbitrary target calls;
- erase historical evidence;
- infer one domain's meaning from another domain automatically.

## Invariants

- **TRUST-INV-001 — No universal score:** canonical state exposes only domain/metric evidence and per-metric aggregates.
- **TRUST-INV-002 — Issuer authorization:** only the current operator of an active issuer may create new signals.
- **TRUST-INV-003 — Metric authorization:** an issuer must be explicitly approved for the exact metric it reports.
- **TRUST-INV-004 — Revision pinning:** every signal binds the metric revision and issuer epoch applicable at issuance.
- **TRUST-INV-005 — Signal replay protection:** a `signalId` is globally single-use.
- **TRUST-INV-006 — Evidence replay protection:** an issuer/subject/metric/evidence tuple is single-use.
- **TRUST-INV-007 — Append-only correction:** correction never mutates or deletes the predecessor signal.
- **TRUST-INV-008 — Single active successor:** a signal may be superseded at most once.
- **TRUST-INV-009 — Revocation safety:** an active signal may be revoked at most once and is removed from active aggregation exactly once.
- **TRUST-INV-010 — Aggregate conservation:** per-metric aggregate equals the sum/count of non-revoked, non-superseded signals represented by canonical state transitions.
- **TRUST-INV-011 — Domain separation:** signals and aggregates never silently combine metrics across domains.
- **TRUST-INV-012 — Identity separation:** Trust subject references do not create or alter Identity420 authority.
- **TRUST-INV-013 — Authority minimization:** Trust issuers receive reporting authority only.
- **TRUST-INV-014 — Private-data minimization:** canonical state contains commitments/references rather than sensitive plaintext payloads.
- **TRUST-INV-015 — Historical reconstructability:** signals, corrections, revocations, policy revisions, issuer changes, and aggregates can be reconstructed from chain state/events plus published specs.
- **TRUST-INV-016 — Prospective issuer disable:** disabling an issuer blocks new evidence but does not erase previously valid history.

## Genesis implementation sequence

1. `TrustIds420`
2. `TrustIssuerRegistry420`
3. `TrustPolicyRegistry420`
4. `TrustSignalRegistry420`
5. `TrustAggregator420`
6. invariant/unit tests
7. Genesis service-map integration
8. Solidity, Genesis verification, and full 420 Integrated qualification

No new frozen system/predeploy address is allocated by this suite. Discovery remains through the protocol/application registry layer.

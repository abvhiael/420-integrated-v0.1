# Genesis documentation matrix

This matrix is the canonical DOC-16 audit model for frozen Genesis documentation coverage. It is an audit artifact, not runtime or protocol authority.

## Authority boundary

The matrix records whether required documentation exists and links to the canonical evidence. It does not define chain state, deployment authenticity, application eligibility, account authority, transaction finality, provider correctness, supported assets, governance outcomes or any other runtime fact.

Canonical authority remains with the source owned by the relevant subsystem. DOC-16 only checks that the documentation points to those sources correctly and does not overstate them.

## Frozen audit dimensions

Every audited Genesis surface is evaluated across six required dimensions:

1. **Architecture** — system role, dependencies, canonical-versus-derived authority, trust boundaries and failure assumptions.
2. **User** — onboarding, primary tasks, state/value-changing actions, signing/permissions, economics and safe completion states where applicable.
3. **Developer** — canonical discovery, network/environment identity, interfaces/APIs, reads/writes, events/errors, reliability patterns and integration examples where applicable.
4. **Security / privacy** — secret handling, signing authority, private-data boundaries, value-risk warnings, provider trust and recovery safety.
5. **Troubleshooting / recovery** — stable `TRB-*` or canonical recovery routes, safe diagnostics, retry classification, authority-first recovery and escalation.
6. **Reference** — generated or canonical reference evidence, provenance/freshness, version/environment scope and explicit unavailable states.

A dimension may be marked `not-applicable` only when the exclusion is deliberate and evidenced. Absence of a page is not by itself evidence that a dimension is not applicable.

## Environment and version rules

The audit uses DOC-13 as publication authority.

- `development` may resolve only to development documentation and is mutable.
- `genesis` may resolve only to the immutable Genesis publication/release.
- `testnet` and `mainnet` remain unavailable until explicitly published by the version registry.
- No audit row may treat a semantic environment allow-list as proof that documentation is currently published.
- No cross-environment or implicit cross-release fallback is allowed.
- A deliberately unavailable target is valid only when the unavailable state is explicit and fail closed.

## Matrix row contract

Each machine-readable row introduced in DOC-16.1 must contain:

- `surface_id` — stable audit identity.
- `surface_name` — human-readable surface name.
- `surface_class` — application, protocol, infrastructure, chain, consensus, wallet, developer-service or testnet-only utility.
- `genesis_role` — user-facing, protocol-only, infrastructure, support/observability or testnet-only.
- `environments` — semantic environment applicability.
- `required_dimensions` — subset of the six audit dimensions; exclusions require evidence.
- `evidence` — per-dimension canonical documentation paths.
- `status` — `covered`, `gap`, `not-applicable`, `unpublished` or `blocked` per dimension.
- `notes` — concise rationale for exclusions, unpublished states or remediation.

## Evidence rules

A `covered` dimension must point to repository-controlled canonical evidence. Evidence may consist of more than one page when the responsibility is intentionally split, but the matrix must not substitute derived tooling for canonical protocol or runtime authority.

A `gap` means required documentation is missing, misleading, stale, internally inconsistent or not safely reachable. Blocking gaps must be remediated before DOC-16.10 closeout.

A `not-applicable` dimension requires a documented reason. A `unpublished` state must agree with DOC-13 publication authority. A `blocked` state means the documentation cannot safely claim coverage because an upstream canonical artifact is unavailable or unresolved.

## Frozen Genesis inventory basis

The machine-readable matrix will be materialized from the already frozen Genesis documentation inventory and the canonical architecture/protocol/infrastructure surfaces established in DOC-2 through DOC-10. In particular:

- user-facing Genesis application inventory comes from the DOC-8 application coverage audit;
- protocol and architecture ownership comes from DOC-2 and DOC-7;
- chain and consensus ownership comes from DOC-3 and DOC-4;
- infrastructure ownership comes from DOC-5;
- Wallet onboarding/application coverage comes from DOC-6 and DOC-8;
- developer integration ownership comes from DOC-9;
- generated reference ownership comes from DOC-10;
- troubleshooting/error ownership comes from DOC-11;
- publication/version ownership comes from DOC-13;
- contextual-link ownership comes from DOC-14;
- Ask 420 support behavior comes from DOC-15.

The Gaming Protocol remains protocol/developer documentation rather than a standalone Genesis application manual. The Faucet remains testnet-only and must never be inferred to exist on Genesis or mainnet merely because it is represented in the audit.

## Pass criteria

DOC-16 can close only when every frozen row has an explicit result for every required dimension, every `covered` result resolves to canonical evidence, all blocking gaps are remediated, deliberate exclusions and unpublished states are recorded, and exact-head documentation/full-repository qualification passes after reconciliation with current `main`.

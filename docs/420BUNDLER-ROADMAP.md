# 420 Bundler Network — GEN-11 Roadmap

The 420 Bundler Network is the provider-neutral transaction-submission layer for smart-account UserOperations. It accepts signed operations, validates and simulates them, maintains a bounded mempool, constructs bundles for the configured EntryPoint, submits those bundles through execution RPC, and exposes lifecycle/receipt information to 420Wallet and compatible third-party clients.

The Bundler Network is not custody, wallet authorization, consensus, settlement or finality authority. EntryPoint and smart-account validation remain authoritative. A bundler may delay or refuse relay, but it cannot manufacture authorization or prevent a user from selecting another compatible operator.

## GEN-11 status

- **GEN-11.0 — architecture + executable invariant baseline — ACTIVE**
- GEN-11.1 — core bundler runtime/service scaffold — pending
- GEN-11.2 — canonical UserOperation model + hashing — pending
- GEN-11.3 — public Bundler RPC API — pending
- GEN-11.4 — deterministic validation + simulation engine — pending
- GEN-11.5 — bounded UserOperation mempool — pending
- GEN-11.6 — bundle construction + EntryPoint submission — pending
- GEN-11.7 — gas + fee estimation — pending
- GEN-11.8 — Paymaster integration boundary — pending
- GEN-11.9 — receipts + lifecycle tracking — pending
- GEN-11.10 — multi-bundler propagation — pending
- GEN-11.11 — reputation + anti-abuse controls — pending
- GEN-11.12 — replacement + nonce hardening — pending
- GEN-11.13 — failure isolation + reorg/restart recovery — pending
- GEN-11.14 — persistence + audit trail — pending
- GEN-11.15 — 420Wallet integration + provider fallback — pending
- GEN-11.16 — 420Status + observability integration — pending
- GEN-11.17 — security hardening + hostile dependency isolation — pending
- GEN-11.18 — Genesis ordering/economic policy boundary — pending
- GEN-11.19 — cross-client/operator compatibility — pending
- GEN-11.20 — adversarial qualification, reconciliation + closeout — pending

## GEN-11.0 — architecture + executable invariant baseline

Freeze service identity `420/service/bundler/v1`, define the non-custodial/non-authoritative relay boundary, pin UserOperation identity to chain + EntryPoint + sender + nonce + operation hash, and encode the Genesis invariants in Go tests plus machine-readable configuration.

### Genesis invariants

- **BUNDLER-INV-001** — a bundler is non-custodial and stores no wallet private key, recovery secret or signing authority.
- **BUNDLER-INV-002** — smart-account and EntryPoint validation remain authoritative for UserOperation authorization; bundlers cannot forge or override authorization.
- **BUNDLER-INV-003** — bundlers cannot determine canonical execution, settlement or finality; inclusion/finality must be derived from canonical chain evidence.
- **BUNDLER-INV-004** — every admitted UserOperation is bound to an explicit chain identity and configured EntryPoint.
- **BUNDLER-INV-005** — every admitted operation must pass local validation/simulation against sufficiently current chain state; peer propagation never bypasses local admission.
- **BUNDLER-INV-006** — stale or invalidated simulation evidence cannot remain silently eligible for bundling.
- **BUNDLER-INV-007** — sender/nonce conflicts, duplicate operations and replacements follow deterministic rules and cannot produce ambiguous local admission state.
- **BUNDLER-INV-008** — failed validation, failed simulation or failed submission cannot consume account nonce or mutate canonical smart-account state.
- **BUNDLER-INV-009** — Paymaster sponsorship authority remains with the Paymaster/account-abstraction validation path; bundlers do not grant sponsorship.
- **BUNDLER-INV-010** — one bundler/operator failing cannot block canonical protocol interaction or prevent a wallet from selecting another compatible bundler.
- **BUNDLER-INV-011** — alternative bundler clients/operators are permitted; 420Wallet must not depend on one monopoly relay implementation.
- **BUNDLER-INV-012** — operation lifecycle states are operational evidence only and cannot claim inclusion/finality without matching canonical chain evidence.
- **BUNDLER-INV-013** — restart/recovery cannot fabricate admission, inclusion, receipt or finality; persistent state must be reconstructable against chain evidence.
- **BUNDLER-INV-014** — public health/metrics exported to 420Status remain explicitly noncanonical and cannot authorize or invalidate UserOperations.
- **BUNDLER-INV-015** — peer/operator inputs, RPC dependencies and revert/error payloads are treated as untrusted and bounded.
- **BUNDLER-INV-016** — Genesis ordering and prioritization behavior must be documented and auditable; hidden preferential ordering is outside the Genesis contract.

## Phase acceptance

GEN-11.0 is complete when the service boundary, invariant catalogue, UserOperation identity requirements, provider-neutrality requirements and machine-readable Genesis configuration are committed and the repository qualification workflows pass on the exact branch head.

GEN-11.1 then begins the production runtime scaffold: configuration, lifecycle, chain identity, EntryPoint discovery, execution-RPC dependency qualification, health/readiness, graceful shutdown and structured logging.

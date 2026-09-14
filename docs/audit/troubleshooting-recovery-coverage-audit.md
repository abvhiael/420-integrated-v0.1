# DOC-16.6 — Troubleshooting and recovery coverage audit

## Result

**AUDIT COMPLETE — one blocking contextual-routing gap recorded for DOC-16.9.**

DOC-11 troubleshooting coverage itself passes. Every frozen user-facing Genesis/testnet application has an explicit shared or application-specific `TRB-*` route in `docs/troubleshooting/genesis-application-coverage.md`. 420 Gaming Protocol remains protocol-only and correctly reuses shared Wallet/capability/session/transaction troubleshooting rather than inventing a user-application namespace.

## Stable troubleshooting identity

Published troubleshooting identity remains `TRB-<DOMAIN>-<NNN>`. Exact `TRB-*` identifiers own symptom, authority source, retry safety, recovery and escalation semantics. Ask 420 gives exact published TRB identifiers precedence and may not independently authorize a retry.

The frozen application coverage includes Wallet, derived services, Registry/Names/Identity, Arbitration, Swap, Bridge, Stake, Governance, AI, Attention, Token, Status and testnet Faucet. AppStore, Governance and Faucet use the explicit `TRB-APP-001` through `TRB-APP-003` entries where shared-domain coverage is insufficient.

## Retry, unknown-state and escalation safety

The documented recovery model is fail-closed:

- authority-first diagnostics precede derived UI/provider state;
- blind retries are prohibited where a prior state-changing attempt may have succeeded;
- timeout or missing UI confirmation does not prove a write failed;
- canonical transaction/protocol state is reconciled before another write when outcome is uncertain;
- value-risk and security-critical conditions preserve the safest documented state and escalation path;
- diagnostics are copy-safe and must not require secrets.

This is consistent across DOC-11 and the Ask 420 troubleshooting policy.

## Contextual troubleshooting routing

Wallet and operator troubleshooting CTX records are materialized in `docs/contextual/contextual-link-registry.json`, including `CTX-WALLET-003`, `CTX-OPS-002` through `CTX-OPS-004`, and generic `CTX-TRB-001`.

The Genesis dApp contextual map also defines a standard `006` troubleshooting slot for each supported application (`CTX-<DOMAIN>-006`) and points that slot at each application's `troubleshooting.md` page.

### Blocking gap: application CTX IDs are not registered

The application-specific IDs declared by `docs/contextual/genesis-dapp-context-map.json` are not materialized as records in `docs/contextual/contextual-link-registry.json`. The registry currently contains Wallet, generic troubleshooting, developer and operator records, but not the declared Genesis dApp `CTX-<DOMAIN>-006` entries.

This means the intended semantic API and runtime resolver can describe the dApp troubleshooting IDs by convention but cannot resolve those IDs from the authoritative contextual registry itself.

**Owner:** DOC-16.9 gap remediation.

Required remediation:

1. materialize every published Genesis dApp contextual ID, including each `006` troubleshooting target, into the contextual-link registry or establish one equally authoritative deterministic registry representation;
2. keep 420 Gaming Protocol excluded because it is protocol-only;
3. keep Faucet testnet-only and unavailable until DOC-13 publishes the testnet documentation track;
4. extend validation so every ID declared by the Genesis dApp contextual map resolves exactly once and matches target type, path, environment and application namespace;
5. fail qualification on missing, duplicate, retired-without-replacement or environment-incompatible contextual IDs.

## DOC-16.6 disposition

TRB coverage, retry safety, authority-first recovery, escalation and ambiguous-outcome handling pass. DOC-16.6 itself is complete as an audit, but DOC-16 cannot close until the missing application contextual-registry materialization is remediated and deterministically validated in DOC-16.9.

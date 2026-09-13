# DOC-18 — Genesis contract inventory reconciliation

DOC-18 reconciles `config/genesis-applications.json` with `contracts/config/genesis-dapp-contract-map.json` so every Genesis code surface has canonical documentation ownership.

## Plan

- DOC-18.1 — inventory reconciliation and classification — COMPLETE
- DOC-18.2 — 420 Launchpad package — COMPLETE
- DOC-18.3 — 420 Trust package — COMPLETE
- DOC-18.4 — 420 Commons package — COMPLETE
- DOC-18.5 — 420 Pulse package — COMPLETE
- DOC-18.6 — 420 Vault coverage — COMPLETE
- DOC-18.7 — 420 Market package — IN PROGRESS
- DOC-18.8 — Civic/Governance naming reconciliation
- DOC-18.9 — stale Genesis inventory cleanup
- DOC-18.10 — CI coverage enforcement, exact-head qualification and merge

## Completed reconciliation

Launchpad, Trust, Commons and Pulse now have governed 420Docs ownership in addition to the original frozen implementation models.

420 Vault is covered by the existing governed `Stake, Governance, Treasury and Grants` architecture family, which already establishes Vault as the canonical custody/release authority behind Treasury and Grants while preserving separate governance, budget and grant workflow authority. The frozen `420Vault V1` model remains the detailed implementation source for lifecycle, accounting, obligation, policy and authorization invariants. DOC-18.6 therefore resolves the prior inventory gap by assigning Vault to that governed architecture rather than creating a duplicate custody document.

420 Market's frozen V1 model has been promoted into governed 420Docs architecture with standard front matter and canonical protocol navigation. The promoted model preserves listing revision pinning, finite-inventory reservation, settlement finality boundaries, order-state safety, privacy minimization and external ownership/rights/identity authority. The remaining DOC-18.7 closeout item is the reconciliation-inventory classification update, currently blocked by the connector guard on the full JSON replacement.

## Exit rule

Every entry in the Genesis contract map must map to a governed 420Docs family, an explicit implementation alias, or a documented non-user-facing subsystem. Standalone repository notes do not count as complete governed coverage.

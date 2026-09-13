# DOC-18 — Genesis contract inventory reconciliation

DOC-18 reconciles `config/genesis-applications.json` with `contracts/config/genesis-dapp-contract-map.json` so every Genesis code surface has canonical documentation ownership.

## Plan

- DOC-18.1 — inventory reconciliation and classification — IN PROGRESS
- DOC-18.2 — 420 Launchpad package — NEXT
- DOC-18.3 — 420 Trust package
- DOC-18.4 — 420 Commons package
- DOC-18.5 — 420 Pulse package
- DOC-18.6 — 420 Vault package
- DOC-18.7 — 420 Market package
- DOC-18.8 — Civic/Governance naming reconciliation
- DOC-18.9 — stale Genesis inventory cleanup
- DOC-18.10 — CI coverage enforcement, exact-head qualification and merge

## Exit rule

Every entry in the Genesis contract map must map to a governed 420Docs family, an explicit implementation alias, or a documented non-user-facing subsystem. Standalone repository notes do not count as complete governed coverage.

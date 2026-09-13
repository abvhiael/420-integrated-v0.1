# DOC-18 — Genesis contract inventory reconciliation

DOC-18 reconciles `config/genesis-applications.json` with `contracts/config/genesis-dapp-contract-map.json` so every Genesis code surface has canonical documentation ownership.

## Plan

- DOC-18.1 — inventory reconciliation and classification — COMPLETE
- DOC-18.2 — 420 Launchpad package — COMPLETE
- DOC-18.3 — 420 Trust package — COMPLETE
- DOC-18.4 — 420 Commons package — COMPLETE
- DOC-18.5 — 420 Pulse package — COMPLETE
- DOC-18.6 — 420 Vault package — NEXT
- DOC-18.7 — 420 Market package
- DOC-18.8 — Civic/Governance naming reconciliation
- DOC-18.9 — stale Genesis inventory cleanup
- DOC-18.10 — CI coverage enforcement, exact-head qualification and merge

## Completed reconciliation

Launchpad, Trust, Commons and Pulse now have governed 420Docs ownership in addition to the original frozen implementation models. Pulse coverage preserves public graph/provenance authority, append-only revisions, exact cross-application references, social-only blocking, off-chain large media and non-canonical feed/ranking semantics.

## Exit rule

Every entry in the Genesis contract map must map to a governed 420Docs family, an explicit implementation alias, or a documented non-user-facing subsystem. Standalone repository notes do not count as complete governed coverage.

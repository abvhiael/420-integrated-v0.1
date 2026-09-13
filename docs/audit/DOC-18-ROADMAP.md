# DOC-18 — Genesis contract inventory reconciliation

DOC-18 reconciles `config/genesis-applications.json` with `contracts/config/genesis-dapp-contract-map.json` so every Genesis code surface has canonical documentation ownership.

## Plan

- DOC-18.1 — inventory reconciliation and classification — COMPLETE
- DOC-18.2 — 420 Launchpad package — COMPLETE
- DOC-18.3 — 420 Trust package — COMPLETE
- DOC-18.4 — 420 Commons package — COMPLETE
- DOC-18.5 — 420 Pulse package — COMPLETE
- DOC-18.6 — 420 Vault coverage — COMPLETE
- DOC-18.7 — 420 Market package — COMPLETE
- DOC-18.8 — Civic/Governance naming reconciliation — COMPLETE
- DOC-18.9 — stale Genesis inventory cleanup — COMPLETE
- DOC-18.10 — CI coverage enforcement, exact-head qualification and merge — COMPLETE

## Completed reconciliation

Launchpad, Trust, Commons and Pulse now have governed 420Docs ownership in addition to the original frozen implementation models.

420 Vault is covered by the existing governed `Stake, Governance, Treasury and Grants` architecture family, which already establishes Vault as the canonical custody/release authority behind Treasury and Grants while preserving separate governance, budget and grant workflow authority. The frozen `420Vault V1` model remains the detailed implementation source for lifecycle, accounting, obligation, policy and authorization invariants.

420 Market's frozen V1 model is promoted into governed 420Docs architecture with standard front matter and canonical protocol navigation. The reconciliation inventory classifies Market as a covered protocol and points to that governed source.

420 Governance remains the frozen public Genesis application name. 420 Civic is the implementation family used by the canonical contracts. The inventory records Civic as an implementation alias of Governance, and the Governance application docs explicitly state that `Governance420` is compatibility-only while canonical proposal, voting and execution authority lives in the Civic suite and `GovernanceTimelock`.

`docs/GENESIS-DAPPS.md` now mirrors the authoritative 21-surface frozen public catalog from `config/genesis-applications.json`, including Search, Analytics, AppStore, Verify, Notifications, Gaming Protocol, Arbitration and Token. It also explicitly separates the public Genesis application decision from the broader contract-map inventory so implementation protocols and aliases are not misrepresented as additional public applications.

DOC-18.10 adds deterministic coverage enforcement through `scripts/validate-doc-genesis-contract-inventory.py`. The validator requires every contract-map surface to appear exactly once in the documentation inventory, rejects unknown classifications and documentation gaps, verifies canonical documentation targets exist, validates implementation aliases against frozen public Genesis applications, preserves the Civic/Governance alias and testnet-only Faucet boundary, and proves that every frozen public Genesis surface is represented. The validator is part of `scripts/qualify-documentation.py`, the 420Docs workflow trigger contract and the governed workflow policy.

## Exit rule

Every entry in the Genesis contract map must map to a governed 420Docs family, an explicit implementation alias, or a documented non-user-facing subsystem. Standalone repository notes do not count as complete governed coverage.

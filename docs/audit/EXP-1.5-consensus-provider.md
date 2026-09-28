# EXP-1.5 — Consensus provider integration

EXP-1.5 qualifies the production 420Indexer consensus projection boundary. The canonical consensus authority remains the consensus subsystem; 420Indexer exposes a read-only, non-authoritative projection through `GET /v1/consensus`.

## Qualified implementation

The production `indexer420` command now requires `INDEXER_CONSENSUS_STATUS_PATH`, constructs `indexer/consensusview.Provider`, validates the current consensus status before opening the HTTP listener, and wires that provider into `api.StoreBackend.WithConsensusProvider`.

The provider rejects unavailable state, impossible `finalized <= safe <= head` ordering, duplicate or undersized active-seat sets, scheduled proposers outside the active committee, proposer/fallback collisions, and QCs below the deterministic `floor(2*N/3)+1` threshold. Runtime startup therefore fails closed rather than serving an unqualified consensus view.

Container deployment carries the same contract. The consensus status directory is mounted read-only at `/var/lib/420consensus`; the production path is `/var/lib/420consensus/status.json`.

## Qualification boundary

This step does **not** claim a live consensus deployment. The testnet infrastructure and approved live consensus status source are still unprovisioned. The readiness record therefore keeps live binding false and preserves the existing Genesis blocker until a real deployed source is qualified.

EXP-1.5 exact-head CI must rerun the retained EXP-1.4 gate plus the new EXP-1.5 verifier and Go tests on the same SHA. A green exact head qualifies the repository/runtime integration scope and hands off to EXP-1.6 historical block-producer attribution.

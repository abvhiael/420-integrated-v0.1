# DOC-16.9 — gap remediation and automated matrix qualification

DOC-16.9 closes the blocking defects found by DOC-16.2 through DOC-16.8 and adds deterministic qualification so those defects cannot silently return.

## Remediations

1. **Gaming Protocol matrix evidence path** — `docs/developers/gaming-protocol.md` now exists as a stable compatibility handoff to the canonical `gaming-protocol-integration.md` guide. The compatibility page does not fork authority or substantive guidance.
2. **Genesis dApp contextual IDs** — `genesis-dapp-context-map.json` is now treated as a deterministic materialized CTX namespace by `validate-doc-contextual-dapp-map.py`. For every published dApp, `CTX-<DOMAIN>-001` through `006` must resolve to the declared local documentation target. Faucet remains unresolved while the testnet documentation track is unpublished. Gaming Protocol remains excluded because it is protocol-only.

## Automated qualification

`validate-doc-genesis-matrix.py` now requires:

- exactly 21 frozen audit rows;
- unique `surface_id` values;
- evidence for every required dimension;
- every declared evidence path to exist in the repository.

`validate-doc-contextual-dapp-map.py` now requires:

- exactly the six documented dApp target slots;
- unique synthesized CTX IDs;
- valid target types and local target files;
- publication-aware materialization;
- preservation of the Gaming Protocol protocol-only exclusion.

Both validators are wired into `scripts/qualify-documentation.py`, the 420Docs workflow path triggers and `docs/ci/workflow-policy.json`.

## Result

All blocking gaps discovered before DOC-16.9 are remediated at the documentation-contract level. DOC-16.10 must still run final exact-head qualification and reconciliation before the monolithic DOC-16 phase can merge.

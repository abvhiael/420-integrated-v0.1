# TREASURY-REC-8 — Deployment and Release Materialization

## Exact-head qualification

- Implementation: PR #1231, `70895129b186e98d98e3aa5bb4b02f4d139750a2`, reconciled with main `1b0394c0b8c2074d81907a3f1d8e92646502ff65`.
- [Exact-head deployment workflow 44614034940](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44614034940), job 135877807565: PASS, 6/6 Node tests including parent (5 executed scenarios), zero failures/skips. Two independently compiled exact source closures and complete release bundles were byte-identical. Retained AUDIT-5 event ABI, AUDIT-6 deployment/namespace, and AUDIT-7 documentation verifiers passed.
- [Release executor qualification 44614035061](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44614035061), job 135877810252: PASS, 9/9 actual Anvil tests including parent; executor compiled artifact and runtime template hashes captured in that job.
- [Native asset/Vault qualification 44614034972](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44614034972), job 135877807411: PASS, 48/48 Solidity tests (7+17+13+5+4+2), zero failures/skips.
- [Broader automatic Indexer workflow 44614034927](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44614034927): separate automatically triggered regression; not used to infer REC-8 completion. Its final conclusion was pending at evidence recording.
- Prior implementation run 44613734236, job 135876734491, passed reproducible build and namespace/ABI validation but failed immutable runtime verification. The exact runtime check now independently executes the actual creation input at its historical block and compares the entire resulting runtime, including compiler-transformed immutables, as well as template bytes and exact constructor getters. The corrected workflow passed all affected scenarios. No assertion was waived.

## Release inputs and executable deployment

The exact inventory comprises five core Treasury contracts, the explicitly designated executor candidate and two internal libraries. CapabilityRegistry420 is a separately owned dependency; the candidate reservation 0x0447 is neither deployed nor frozen by this step. GovernanceTimelock 0x0429 and ProtocolRegistry 0x0434 identities are sourced from the retained canonical runtime artifacts. The namespace remains registry-resolved; no CREATE2 or new predeploy, service, grant, authority or custody path was created.

The artifact bundle contains ABIs, compiler creation bytecode, runtime templates, immutable references, storage layouts, source/compiler metadata, SHA-256 artifact identities and Keccak-256 release commitments. The [exact release bundle and rehearsal archive](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44614034940/artifacts/14572913464) was uploaded successfully with archive SHA-256 `75f10b513b212018dc339f09f26291085568fe2ee7933740923b23f4de07cb37`; GitHub reports expiration on November 26, 2026. The source closure and deterministic materializer are retained in the repository, and the aggregate release manifest and independently verified runtime/receipt identities are retained permanently in the accompanying JSON evidence. The archive is not itself a live deployment record.

Local release commitments:
- Manifest: `0xc2d1346c2de4b61018c2e926b124812ae899a21b748336272853665ec94830cc`
- Metadata: `0x056e9670a3ab39effcb8e77ebca965c40a607b49c66d95c87697468e91187b02`
- Router ABI/interface: `0x5d24b8aa20595fc81b44641911393c99e91dab8c1378a17143bdc57abe79157c`
- Dependency root: `0x9d80386d5d4ff6632b90ce90cb949b1c2df73409e6dca3894cb901b3b51d4a9c`

## Local rehearsal evidence and authority boundary

Real signed CREATE transactions went through the same submission and recovery tool used for preparation. Canonical receipts and exact runtime identity were verified for six deployments in the initial release and six in corrective redeployment. Verified actual governed controller initialization before Router creation, capability authority registration, component registration before publication, service revision 1 and corrective revision 2, chain/genesis identity, signed input and nonce, loss of deployment and governed-action receipt results, runtime substitution rejection, wrong irreversible controller rejection, premature publication rejection, and Wallet discovery compatibility. Timelock class delays were exercised on isolated Anvil with the canonical runtime artifacts installed at their reserved addresses; test-only fixture keys and time advancement are not live-network evidence.

The [machine-readable retained rehearsal](420TREASURY-REC-8-REHEARSAL.json) transcribes exact transaction hashes, block hashes and runtime code hashes from the passing workflow logs, explicitly labeled LOCAL_ANVIL_ONLY. The executable [deployment runbook](../apps/treasury/deployment.md) describes reviewed nonce reservation, external signing, recovery without blind retries, governance activation, and corrective redeployment without implicit migration. Actual governance can still use its canonical generic Registry authority; this tooling is a fail-closed release procedure, not a new on-chain governance restriction. Finality, live ABI/receipt correlation, actual CapabilityRegistry identity, approved operator, and approved live release inputs remain AUDIT-8 work. REC-5 security findings were open at REC-8 execution and subsequently reconciled in REC-9.

No production/testnet addresses, transactions, receipts, or operator are populated. Local release scope is complete. REC-9 retains local security/qualification and external review preparation; REC-10 retains final local closeout. PR #1231 subsequently merged at `b3d5e5a7f1e67e1b686eb049fc20aabb595171e4`; the final qualified source and original receipts are unchanged.

# ARB-PRE-09 — Deterministic local Arbitration Genesis deployment runbook

## Scope and non-production boundary

This runbook covers **local-only** Anvil deployment qualification and a reproducible, transaction-ordered manifest. It does **not** assert an active public testnet, a live deployed release, an operational 420Storage endpoint, or a production Genesis address for any Arbitration contract. The existing `REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS` policy and all frozen Genesis parameters remain unchanged.

Canonical source of dependency order and approval: `contracts/config/arbitration/arbitration-audit-4-release-materialization.json`. Local publication metadata is the retained `contracts/config/arbitration/arb-pre-09-local-release-metadata.json`; its bytes are hashed and registered, rather than claiming a production metadata identity. Compiler configuration is the existing `contracts/foundry.toml`: Solidity **0.8.24**, Cancun EVM, optimizer **200**, `via_ir=true`.

## Execute the two-run qualification

From repository root in an environment with Node.js 22+, Foundry (`forge`, `anvil`), npm, and Python 3.11+:

```sh
python3 scripts/verify-reg-audit-4-genesis-address-namespace.py
python3 scripts/verify-arbitration-audit-4-release.py
(cd contracts && forge build src/governance/GovernanceTimelock.sol src/apps/ProtocolRegistry.sol src/arbitration/ArbitrationPolicyRegistry420.sol src/arbitration/ArbitrationCaseRegistry420.sol src/arbitration/ArbitrationRulingRegistry420.sol src/arbitration/ArbitrationRouter420.sol)
npm install --prefix scripts --no-save --no-package-lock --ignore-scripts ethers@6
node scripts/qualify-arbitration-pre09-local-genesis.mjs artifacts/arbitration/arb-pre-09/first.json
node scripts/qualify-arbitration-pre09-local-genesis.mjs artifacts/arbitration/arb-pre-09/second.json
cmp artifacts/arbitration/arb-pre-09/first.reproducible.json artifacts/arbitration/arb-pre-09/second.reproducible.json
python3 scripts/verify-arbitration-pre09-local-genesis.py artifacts/arbitration/arb-pre-09/first.json artifacts/arbitration/arb-pre-09/second.json
```

The dedicated `.github/workflows/420arbitration-pre09-genesis.yml` executes exactly this check on the PR's SHA and retains JSON evidence as CI artifacts.

## Genesis fixture and frozen authority

The test runs a **fresh, nonforked Anvil chain ID 31337**, not a live network. It first executes the real `GovernanceTimelock` constructor and canonical `ProtocolRegistry` constructor. For local Genesis simulation only, it copies their compiled runtime to the **already frozen** addresses `0x...0429` and `0x...0434`. The Timelock's original constructor-populated scheduler storage is copied into the local predeploy, then its immutable bootstrap governor, scheduler, G1 seven-day delay, Registry governanceTimelock and runtime hashes are read back and checked. **This Anvil state seeding is not a deployment procedure for a live chain.** No new Arbitration predeploy slot, fixed Arbitration contract address, CREATE2 salt or unilateral governance authority is created.

Actual one-time binding, component registration, service publication, domain-policy activation, service deprecation and governed recovery use the compiled Timelock's `schedule`/`execute` methods, respecting the frozen G1 seven-day floor through controlled local chain time advancement. Transactions are mined, their receipts verified, and execution/replay state checked. An attempted early execution and incorrect reciprocal/duplicate bindings must revert.

## Canonical 10-stage sequence

1. Verify the compiled GovernanceTimelock dependency and approved local namespace/immutable scheduler.
2. Deploy `ArbitrationPolicyRegistry420` with the timelock.
3. Deploy `ArbitrationCaseRegistry420` with timelock and freshly deployed Policy Registry.
4. Deploy `ArbitrationRulingRegistry420` with the newly deployed Case Registry.
5. Execute G1-governed one-time Case → Ruling Registry binding; incorrect/duplicate bindings must fail.
6. Deploy `ArbitrationRouter420`; read back all three immutable dependencies and reciprocal graph.
7. Execute G1-governed ProtocolRegistry component registration (`420/component/arbitration/v1`, version 1.0.0, ACTIVE).
8. Execute G1-governed `publishRegisteredService` (`420/service/arbitration/v1`, version 1, SERVICE) with runtime bytecode hash, full dependency commitment and source-backed metadata/manifest/interface commitments.
9. Read back service and active component resolution, current revision, immutable binding and registration profile.
10. Recompute deployed code hashes, verify strict ordered transaction receipts and corresponding block hashes, then exercise the full case/ruling/recovery lifecycle.

The negative test also verifies untrusted accounts cannot bind contracts, register components, publish services, file evidence, or act as a resolver; a revoked service fails active resolution, and an incorrect recovery revision is rejected.

## Local case, finalization and governed recovery

An actual local timelock operation creates an active policy with distinct initial and appeal resolvers. A claimant opens a case binding respondent/domain/origin object/claim and remedy, both parties submit distinct evidence commitments, the correct round-zero resolver rules, the respondent appeals, the appeal resolver rules, and a user finalizes only after the appeal window. Both round rulings remain readable, and further finalization fails. The local Registry then executes timelocked service deprecation, rejects active reads, and executes governed version-2 republication; historical v1 stays deprecated while v2 is active. No remedy movement, token custody or live network authority is asserted.

## Manifests and verification

The full `first.json` and `second.json` files capture chain and Genesis hashes, local addresses, compiled runtime code hashes, publication commitments, source compiler settings, case/appeal outcome, negative-case results, and every mined transaction's ordinal, hash, block number, index, block hash, sender, target and deployment address. Corresponding `*.reproducible.json` files retain chain-independent identity/order fields so two **clean Anvil runs** can be compared byte-for-byte without confusing different ephemeral receipt/block hashes with build drift. The verifier rejects a changed address model, compiler configuration, frozen dependency, missing receipt, out-of-order action, missing adversarial test or non-identical reproducibility projection.

All generated addresses and receipts are local testing artifacts. The next independent gate is **ARBITRATION-AUDIT-5**, which owns actual public-testnet deployment and receipts, Registry/Wallet/indexer network verification, finality/reorg behavior, authorized private Storage operation and production-equivalent recovery. No live release claims may be inferred from this runbook.

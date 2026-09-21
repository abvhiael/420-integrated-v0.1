# AI-RECOVERY: main-authoritative Genesis and CI reconciliation

Status: targeted working-branch policy reconciliation only; NOT a completed three-way merge or release qualification.

## Chosen authority

- Retain verbatim the current `main` version of `contracts/config/genesis-canonical-addresses.json`; never import the recovery version's competing fixed AI addresses. `main`'s canonical AI router is 0x0430; the recovery snapshot instead assigns AIModelRegistry to that address. Treat that as a real collision, not a routine YAML/JSON conflict.
- Retain verbatim current `main` `.github/workflows/contracts-foundry.yml` and its 16 required PR shards. Do not restore the recovery branch's older scoped/monolithic PR configuration.
- AI implementation files, AI-specific tests and dedicated AI workflows remain on this working branch; preserving them in source control does not certify compatibility with main's address choices or test coverage.

## AI-specific integration gates still open

1. Reconcile `contracts/config/system-addresses.json`, all AI predeploy/canonical references, Genesis validation scripts, generated manifests and relevant contract tests against the current main Genesis authority. Do not silently alter frozen addresses or assume recovery's `0x042f`–`0x0433` assignments are valid just because AI modules require discovery. AI component addresses not frozen by the authoritative map must remain explicitly registry-resolved until separately approved and validated.
2. Verify AI router/manager/escrow/provider references and injected test fixtures against final addresses and registry lookups. Review any older `vm.etch(0x431/0x432)` fixtures that may now collide with main assignments.
3. Integrate all remaining main changes using a genuine three-way merge; enumerate and resolve every remaining conflict. A targeted replacement of two files is not that merge.
4. Prove `AINativeSettlementRoutes420.t.sol` is exercised by the final CI scope and include new provider reconciliation tests. Run all required shards and AI/provider/API/web/Wallet/Genesis checks on a single reconciled SHA; report actual results, not earlier green runs.
5. Keep PR #348 draft and paid-AI functionality disabled pending separately tracked security, testnet, signer and settlement gates. Do not change main or either backup branch in this targeted step.

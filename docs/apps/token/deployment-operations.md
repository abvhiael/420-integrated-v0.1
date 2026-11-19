# 420 Token deployment and operations

420Token is deployed as a Registry-resolved service. **Do not assign TokenFactory420 a fixed Genesis address.** The frozen Genesis namespace explicitly places `token-factory` in `REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS`; the historical `0x0455` proposal is retired and is not deployment authority.

## Repository-qualified deployment order

1. Identify or deploy the community `AssetVault420` for vault ID `420/treasury/vault/token-creation-community-revenue/v1`.
2. Verify that Vault registration is active, its runtime code matches the qualified release, and its registry/accounting/authorization dependencies are the intended release identities.
3. Deploy `TokenTemplateRegistry420` with the canonical GovernanceTimelock as constructor authority.
4. Deploy `TokenFactory420` with the verified template-registry address and verified community-Vault address.
5. Verify both factory immutables from chain state.
6. Register `420/component/token/v1` in ProtocolRegistry to the factory.
7. Publish `420/service/token/v1` to the same factory using the Genesis-grade registered-service publication path with runtime code hash, manifest, interface and dependency commitments.
8. Verify active resolution and exercise a smoke deployment through the same Wallet/runtime configuration that users will receive.

The declarative authority is `contracts/config/token/token-audit-4-release-materialization.json`. It intentionally contains no invented live Token/Vault addresses. TOKEN-AUDIT-4 implements executable materialization and unsigned deployment/publication preparation in `scripts/token/deployment.py`.

### Reproduce the qualified release

From the repository root at the retained qualified implementation SHA, with Python 3 and Foundry (`forge`, `cast`, `anvil`) installed:

```sh
python3 scripts/token/deployment.py qualify /path/to/new-output-directory
```

The output contains `release-bundle.json`, `local-rehearsal-a.json`, `local-rehearsal-b.json` and `qualification.json`. The command performs two independent builds with solc 0.8.24, via-IR, optimizer 200, Cancun, checks the frozen V3 commitment and retained anchor runtime/storage/ABI, and rehearses twice on chain 31337 with the actual governance timelock, ProtocolRegistry and Vault graph. The exact qualifying workflow and durable hash records are in `docs/audit/420TOKEN-AUDIT-4-QUALIFICATION.json`.

### Prepare unsigned operations

```sh
python3 scripts/token/deployment.py materialize release-bundle.json
python3 scripts/token/deployment.py plan release-bundle.json approved-vault-binding.json unsigned-plan.json --rpc "$RPC_URL"
python3 scripts/token/deployment.py publication release-bundle.json unsigned-plan.json governance-actions.json --rpc "$RPC_URL" --receipts "$TEMPLATE_TX" "$FACTORY_TX"
```

The independently approved binding must state `chainId`, `genesisHash`, `deployer`, `registrationCreator`, the six entries of `vaultGraph` (each with `address` and `runtimeCodeHash`), `policyIds` in authorization/asset/release/accounting order, `beneficiarySetId`, `vaultMetadataHash`, and `vaultManifestHash`. Use the actual approved network and independently verified release records, not the local rehearsal values. The planner rejects reserved/aliased dependencies and wrong chain, genesis, code, registration, policy and constructor bindings. It prepares the two initial ordinary CREATE operations, with explicit nonce/address/creation calldata. After authorized execution, `publication` verifies actual successful canonical deployment receipts, exact creation input, materialized runtime, immutables and active Vault binding. Its output contains the two unsigned Registry actions and the exact dependency, metadata, interface and manifest commitments. This tool does not hold signing keys, transmit live transactions, schedule live governance, or authorize publication. The local rehearsal uses isolated Anvil fixture state and bootstrap timelock scheduling solely to prove execution. Live binding confirmation and governance approvals remain TOKEN-AUDIT-8.

## Required live evidence

TOKEN-AUDIT-8 must retain, for one exact release lineage:

- chain ID, genesis/network identity and evidence block/hash;
- exact GovernanceTimelock and ProtocolRegistry identities;
- TokenTemplateRegistry420, TokenFactory420 and community Vault addresses plus runtime code hashes;
- Vault registration record and the exact canonical Vault ID;
- factory immutable dependency reads;
- component registration and active service publication/resolution;
- transactions, receipts and logs for representative deployments of all eight templates;
- the exact 42-native-420 Vault accounting delta for each successful deployment;
- failed/wrong-fee/disabled-template/Treasury-failure evidence proving atomic rollback;
- Wallet runtime identity verification and SmartAccount transaction handoff against the same deployment;
- indexer/Explorer/Search reconstruction evidence and restart/reorg/RPC-disagreement behavior;
- repository SHA and non-secret deployment/configuration manifest sufficient to reproduce the result.

Repository-local EVM tests, CI and mock Vaults are not live deployment evidence.

## Authority transfer and emergency behavior

The template registry must be deployed directly with the canonical GovernanceTimelock. There is no temporary Token owner to transfer later. The factory has no owner/admin authority.

If a template is compromised, governance may disable that template ID for future factory use. Existing token contracts are not upgraded or rewritten. Replacing factory dependencies or changing the immutable community fee destination requires a new versioned/qualified deployment rather than an in-place redirect.

## Monitoring

At minimum observe `TokenDeployed`, `CreationFeeDeposited`, `TemplateStatus`, community Vault native-deposit/accounting events, and ProtocolRegistry component/service lifecycle events.

Alert on failed Treasury forwarding, unexpected service implementation/code-hash changes, a disabled template still appearing available in clients, Registry/runtime disagreement, or any factory balance unexpectedly remaining after a successful transaction.

## Recovery

A failed deployment transaction is atomic and can be safely retried after the underlying cause is corrected. A deprecated or compromised service release must fail closed in clients until a newly qualified active Registry publication is available. Never recover by hard-coding a replacement address into Wallet or documentation.

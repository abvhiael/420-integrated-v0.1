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

The repository materialization is `contracts/config/token/token-audit-4-release-materialization.json`. It intentionally contains no invented live Token/Vault addresses.

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

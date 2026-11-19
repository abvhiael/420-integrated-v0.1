# 420 Token developer integration

## Canonical identities

Service: `420/service/token/v1`  
Component: `420/component/token/v1`  
Creation fee: exactly `42 ether` native 420  
Community Vault ID: `420/treasury/vault/token-creation-community-revenue/v1`

TokenFactory420 is Registry-resolved and has no fixed Genesis address. Never resurrect or hard-code the superseded historical `0x0455` proposal.

## Runtime discovery

Import the browser-safe SDK from `wallet/web/core/token-app.js`. Supply an independently approved Wallet release binding, not a binding supplied by a dApp. `verifyTokenRuntime420(provider,binding)` checks code and on-chain state on a canonical block, then rechecks the block and chain. It returns frozen template descriptors with current availability.

The binding includes `serviceId`, `componentId`, numeric `chainId`, `version:1`, `genesisHash`, `genesisConfigHash`, `factory`, `templateRegistry`, `communityTreasuryVault`, `communityTreasuryVaultId`, `registry`, `governanceTimelock`, `vaultGraph`, `vaultRegistration` and `release`. Every contract identity is `{address,codeHash}`. The graph includes AssetVault420, VaultRegistry420, VaultAccounting420, VaultAuthorization420, VaultPolicyRegistry420 and CapabilityRegistry420. Registration contains creator, four ordered policy IDs, beneficiary-set ID, metadata hash and manifest hash. Release contains metadataHash, manifestHash, interfaceHash and dependencyRoot. Derive these from independently approved deployment evidence using the TOKEN-AUDIT-4 commitment order; no local rehearsal addresses are production defaults.

The live release process must prove that the factory's immutable dependencies point to the qualified template registry and the actually registered community AssetVault420. The factory constructor's `vaultId()` check is a protocol guard, but by itself is not deployment provenance.

## Write path

Prepare one of the factory entry points:

- `createERC20(templateId,name,symbol,initialSupply,cap,userSalt)`
- `createERC721(name,symbol,baseURI,userSalt)`
- `createERC1155(uri,userSalt)`

Every call carries exactly 42 native 420. Use the structured request builder rather than raw calldata:

```js
import {verifyTokenRuntime420, buildTokenDeploymentRequest420,
  prepareTokenDeploymentHandoff420} from './core/token-app.js';
const runtime = await verifyTokenRuntime420(provider, approvedBinding);
const request = buildTokenDeploymentRequest420(runtime, {
  template: 'ERC20_CAPPED', name: 'Example', symbol: 'EX',
  initialSupply: '100000000000000000000', cap: '200000000000000000000',
  userSalt, // caller-provided exact bytes32
});
const prepared = await prepareTokenDeploymentHandoff420(provider, controller,
  smartAccountState, approvedBinding, request);
// Review prepared.draft, prepared.configHash, prepared.value and simulation.
// Confirmation, execution and receipt tracking remain Wallet-owned.
```

Supply amounts are exact base-unit integer strings or bigint; normalized drafts use decimal strings. ERC20 uses name/symbol/supply/cap (cap zero except for capped profile); ERC721 uses name/symbol/baseURI; ERC1155 uses uri. User salt is bytes32. The codec uses canonical UTF-8 ABI encoding, actual factory configuration-hash semantics and the Wallet calldata limit. The handoff independently re-encodes the draft and checks the supplied target, fee, data and optional commitments. Missing full release proof, disabled templates or changed chain/manifest/registration fail closed. The prepared transaction requires explicit confirmation, never constitutes execution, and adds no signing or submission authority. SDK evidence: `docs/audit/420TOKEN-AUDIT-5.1-QUALIFICATION.json`.

A successful deployment can be correlated using `TokenDeployed` and `CreationFeeDeposited`, then read through `deploymentCount()`, `deployment(index)` and `isFactoryDeployment(token)`.

## Read / indexing integration

Indexers may derive Token deployment views from factory events and token-standard events. Those projections are reconstructable and non-authoritative. 420Registry owns service/component discovery; the token contract owns its balances/ownership; the factory owns its provenance record.

Downstream apps must independently qualify created assets. Do not turn a factory deployment into an implicit Exchange listing, Bridge admission, Pay settlement asset, Launchpad approval or trust badge.

See `contracts/config/token/token-audit-4-release-materialization.json` and [Token deployment operations](../deployment-operations.md) for release/deployment requirements.

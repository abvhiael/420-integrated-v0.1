# 420 Token developer integration

## Canonical identities

Service: `420/service/token/v1`  
Component: `420/component/token/v1`  
Creation fee: exactly `42 ether` native 420  
Community Vault ID: `420/treasury/vault/token-creation-community-revenue/v1`

TokenFactory420 is Registry-resolved and has no fixed Genesis address. Never resurrect or hard-code the superseded historical `0x0455` proposal.

## Runtime discovery

A client should resolve the active Token service/release and verify the implementation code identity and committed dependency graph. For the Wallet path, `token-runtime.js` expects distinct, nonzero, code-bearing factory, template-registry and community-Vault identities, the correct chain/version and exact canonical Vault ID.

The live release process must prove that the factory's immutable dependencies point to the qualified template registry and the actually registered community AssetVault420. The factory constructor's `vaultId()` check is a protocol guard, but by itself is not deployment provenance.

## Write path

Prepare one of the factory entry points:

- `createERC20(templateId,name,symbol,initialSupply,cap,userSalt)`
- `createERC721(name,symbol,baseURI,userSalt)`
- `createERC1155(uri,userSalt)`

Every call must carry exactly 42 native 420. Wallet integration hands the reviewed target/value/calldata to SmartAccount420; Token client code does not add a separate signer or broadcaster.

A successful deployment can be correlated using `TokenDeployed` and `CreationFeeDeposited`, then read through `deploymentCount()`, `deployment(index)` and `isFactoryDeployment(token)`.

## Read / indexing integration

Indexers may derive Token deployment views from factory events and token-standard events. Those projections are reconstructable and non-authoritative. 420Registry owns service/component discovery; the token contract owns its balances/ownership; the factory owns its provenance record.

Downstream apps must independently qualify created assets. Do not turn a factory deployment into an implicit Exchange listing, Bridge admission, Pay settlement asset, Launchpad approval or trust badge.

See `contracts/config/token/token-audit-4-release-materialization.json` and [Token deployment operations](../deployment-operations.md) for release/deployment requirements.

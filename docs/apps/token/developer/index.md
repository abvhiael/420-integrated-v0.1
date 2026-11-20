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

### Wallet runtime configuration and discovery

The Wallet generator takes Token authority from the same independently qualified `wallet/deployment-inventory.json` input used for the network and Wallet deployment. When actual evidence is available, its optional `appAuthority.token420` entry contains `status: "BOUND"`, `deploymentVerified: true`, `environment` matching the inventory/manifest (local, devnet, testnet or mainnet), and `binding` with the complete fields above. These flags describe real verified deployment evidence; they do not grant live approval merely by being set. Without a verified entry the generator emits `token: null` and clears any stale base-config binding. The checked-in runtime deliberately has `token: null`. The approved entry must agree with the Wallet's network chain, canonical ProtocolRegistry and shared CapabilityRegistry addresses. No ecosystem manifest URL or dApp-provided deployment binding may populate this field.

Use `discoverWalletTokenRuntime420(provider, walletConfig, controller, selectedSmartAccount)` for Wallet-owned discovery. This reads the connected selected account without requesting a new account grant, verifies the full release through `verifyTokenRuntime420`, freshly resolves the SmartAccount using the Wallet factory/EntryPoint/CapabilityRegistry bindings, then checks the selected account, chain and verification block again. It returns a frozen discovery-only snapshot, including template availability and current ownership status. Counterfactual and non-owner accounts may be discovered but gain no execution authority. The shared host session in `token-discovery.js` exposes `unconfigured`, `disconnected`, `checking`, `verified`, or `blocked` and discards stale results after disconnect, account/chain change, or a newer refresh. RPC calls are read-only and bounded. The Wallet Apps card reflects this state and never opens an unverified external Token URL. Consumers must not treat a discovery snapshot as a durable authorization or skip re-verification at transaction preparation. Local discovery qualification evidence: `docs/audit/420TOKEN-AUDIT-5.2-QUALIFICATION.json`.

The live release process must prove that the factory's immutable dependencies point to the qualified template registry and the actually registered community AssetVault420. The factory constructor's `vaultId()` check is a protocol guard, but by itself is not deployment provenance.

### Template catalogue and availability

Import `TOKEN_CATALOGUE_PROFILES_420`, `describeTokenCatalogue420(snapshot)` and `createTokenCatalogue420(session)` from `wallet/web/core/token-app.js`. The immutable catalogue contains all eight frozen identities and descriptions, exact creation fee in base units, standard, version and feature semantics. `describeTokenCatalogue420` derives `enabled`, `disabled` or `unknown` only from a complete verified discovery snapshot, including the canonical block; malformed profile sets fail closed. The Wallet host session exposes `refreshCurrent()` and `canRefresh()` without exposing the retained provider/context. Refresh reuses a copied host-approved configuration; disconnect/chain/account invalidation clears it. `createTokenCatalogue420` provides read-only subscription, refresh, selection, snapshot and disposal. `select(key)` succeeds only after fresh verification of the same runtime/account and selected profile; selections are cleared by subsequent discovery updates. A selected profile has authority `DISPLAY_ONLY`; later creation preparation must independently verify runtime, template and canonical calldata and require explicit Wallet confirmation. Rendered UI and SDK evidence: `docs/audit/420TOKEN-AUDIT-5.3-QUALIFICATION.json`.

### ERC20 creation wizard

Use `parseERC20Units420(decimalString)` and `formatERC20Units420(baseUnitInteger)` for exact 18-decimal conversion; never use floating point. `validateERC20WizardFields420(key, fields)` accepts only the six frozen ERC20 keys and name, symbol, supply, cap and userSalt fields. It uses the canonical SDK codec, uint256 and actual uint208 voting-supply bounds, and validates cap only for the capped profile. Wizard-specific nonblank/control-character metadata checks do not change contract behavior. `generateERC20Salt420()` uses cryptographic randomness. `createERC20Wizard420(catalogue, session)` exposes subscription, field editing, salt regeneration, reset, read-only review and disposal; review returns an immutable `DRAFT_ONLY` request only after re-verifying the same approved runtime, account, chain, profile and owner readiness. Request includes canonical calldata and configuration commitments, exact fee, intended SmartAccount owner and verification block. Edits or trust changes invalidate it. This draft is not a simulation or approval; Wallet must independently verify and explicitly confirm. Evidence: `docs/audit/420TOKEN-AUDIT-5.4-QUALIFICATION.json`.

### ERC721 collection creation wizard

`validateERC721WizardFields420('ERC721_COLLECTION', fields)` accepts only `name`, `symbol`, `baseURI` and `userSalt`, and produces the canonical SDK draft/data/config and calldata hashes with immutable collection semantics. `baseURI` is an exact stored string, including an optional empty value: the frozen `tokenURI(id)` checks existence then returns that exact string for every ID, without suffixing or substituting an ID. No URI setter exists. Nonempty URI input is guarded for safe display and syntactic absolute URI form (no raw whitespace, malformed percent escapes or executable schemes; HTTP(S) requires a host without embedded credentials). Metadata is neither fetched nor authenticated. Client safeguards do not modify contract semantics. Creation mints zero NFTs; only the collection owner can subsequently mint unique IDs; holders or approved operators may burn. `createERC721Wizard420(catalogue,session)` uses the shared `token-creation-wizard.js` lifecycle with the existing field/edit/reset/salt/review/disposal interface, binding the verified deployed SmartAccount owner, exact release and fresh selected profile. The immutable `DRAFT_ONLY` result contains the canonical factory request, exact fee and verification block; it is never authorization to execute, mint or sign. ERC20 and ERC721 have isolated state and clear drafts upon switching or invalidation. Qualification evidence: `docs/audit/420TOKEN-AUDIT-5.5-QUALIFICATION.json`.

### ERC1155 multi-token creation wizard

`validateERC1155WizardFields420('ERC1155_MULTI', fields)` accepts only `uri` and `userSalt` and encodes the exact immutable V1 factory draft. `resolveERC1155MetadataURI420(uri,id)` is a pure display helper: it replaces every literal `{id}` with the exact uint256 ID as 64 lowercase hexadecimal digits without `0x`; percent-encoded or differently cased placeholders are not replaced. It neither retrieves metadata nor changes the stored URI. Both on-chain URI getters return the exact shared URI without substitution. Empty URI or a shared URI without `{id}` is valid and carries a warning. The common URI guards are wizard-only input safeguards. `createERC1155Wizard420(catalogue,session)` reuses the verified draft lifecycle, requiring an enabled profile and the same approved release, chain and deployed SmartAccount owner, and clearing drafts on edits or invalidation. Creation has no name, symbol, decimals, IDs, initial quantities, recipient or custom owner fields; deployment creates no balances. Owner minting and safe transfers are later actions, not part of the draft. The canonical immutable request carries exact 42 native 420 and the verified block; `DRAFT_ONLY` is not simulation, signing or approval. Evidence: `docs/audit/420TOKEN-AUDIT-5.6-QUALIFICATION.json`.

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

Supply amounts are exact base-unit integer strings or bigint; normalized drafts use decimal strings. ERC20 uses name/symbol/supply/cap (cap zero except for capped profile); ERC721 uses name/symbol/baseURI; ERC1155 uses uri. User salt is bytes32. The codec uses canonical UTF-8 ABI encoding, actual factory configuration-hash semantics and the Wallet calldata limit. The handoff independently re-encodes the draft and checks the supplied target, fee, data and **mandatory** templateId, configHash and calldataHash commitments. `normalizeTokenDraft420` accepts only own enumerable data fields on plain records (including null-prototype records), with exact uint256 quantities, explicit non-null cap if supplied, uint208 voting supply bound, bytes32 salts, lossless UTF-8 and aggregate calldata length at most 4096 bytes. `decodeTokenCreation420(data)` returns the canonical immutable draft and commitments only for one of the three exact factory entrypoints; malformed offsets, lengths, noncanonical padding and trailing bytes fail closed. `validateTokenCreationEncoding420(draft, {data,templateId,configHash,calldataHash})` verifies all commitments. A configuration hash alone is not a unique deployment identity, because template and salt are intentionally excluded by the frozen Solidity formulas. Independent Foundry Cast parity and adversarial evidence: `docs/audit/420TOKEN-AUDIT-5.7-QUALIFICATION.json`. Missing full release proof, disabled templates or changed chain/manifest/registration fail closed. The prepared transaction requires explicit confirmation, never constitutes execution, and adds no signing or submission authority. SDK evidence: `docs/audit/420TOKEN-AUDIT-5.1-QUALIFICATION.json`.

A successful deployment can be correlated using `TokenDeployed` and `CreationFeeDeposited`, then read through `deploymentCount()`, `deployment(index)` and `isFactoryDeployment(token)`.

## Read / indexing integration

Indexers may derive Token deployment views from factory events and token-standard events. Those projections are reconstructable and non-authoritative. 420Registry owns service/component discovery; the token contract owns its balances/ownership; the factory owns its provenance record.

Downstream apps must independently qualify created assets. Do not turn a factory deployment into an implicit Exchange listing, Bridge admission, Pay settlement asset, Launchpad approval or trust badge.

See `contracts/config/token/token-audit-4-release-materialization.json` and [Token deployment operations](../deployment-operations.md) for release/deployment requirements.

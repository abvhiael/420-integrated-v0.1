# 420 Token architecture

420 Token is the Genesis self-service deployment protocol for a frozen set of qualified ERC asset profiles. It does **not** issue native `$420`, confer downstream approval, or accept arbitrary caller-supplied bytecode.

## Canonical graph

- `TokenTemplateRegistry420` contains the eight version-1 template identities and profile commitments. Its only mutable operation is governance-controlled enable/disable; it cannot replace executable code under an existing template ID/version.
- `TokenFactory420` is the canonical `420/component/token/v1` / `420/service/token/v1` implementation. It is Registry-resolved and has **no fixed Genesis address**.
- Each factory deployment creates one `ERC20Template420`, `ERC721Template420` or `ERC1155Template420` instance with CREATE2. The salt commits the creator, caller-supplied salt, template ID and monotonic creator nonce.
- The factory records creator, token address, template ID/version, configuration hash and deployment time. It retains no token ownership, mint authority or token custody.
- Every successful deployment requires exactly 42 native 420. The factory is immutably bound at construction to a Vault whose `vaultId()` is `420/treasury/vault/token-creation-community-revenue/v1`; the full fee is forwarded with `depositNative()` and the entire transaction reverts if that deposit fails.

## Trust and authority boundaries

`TokenTemplateRegistry420` inherits `SystemAccess`; its governance authority is the canonical GovernanceTimelock for a real release. Repository-local tests may use the test contract as the timelock, but production/testnet qualification must prove the exact deployed timelock identity.

The factory validates the community Vault ID in its constructor. A contract that merely returns the expected ID is not, by itself, proof of live canonical deployment identity. Release qualification therefore must bind the factory constructor to the verified, registered community `AssetVault420` address, runtime code hash and Vault registration/configuration. This is a deployment trust boundary, not permission for clients to accept an arbitrary same-ID contract.

The factory itself has no owner/admin mutation path. Changing its immutable template-registry or community-Vault dependencies requires deploying and qualifying a new factory/release rather than redirecting an existing one.

## Template semantics

The frozen V1 catalog is:

1. ERC20 fixed supply
2. ERC20 owner-mintable
3. ERC20 owner-mintable capped
4. ERC20 fixed-supply burnable
5. ERC20 fixed-supply EIP-2612 permit
6. ERC20 fixed-supply permit + delegated vote checkpoints
7. ERC721 owner-mintable collection
8. ERC1155 owner-mintable multi-token

ERC20 permit domains commit chain ID and verifying-contract address. Canonical signatures require `v` 27/28 and low-`s`; nonces increase monotonically and reverts roll nonce changes back. Vote checkpoints follow delegated balances and expose historical block queries. ERC721/ERC1155 safe transfers require the appropriate receiver callback for contract recipients.

## Discovery and user path

The Wallet Genesis application catalogue exposes `420/service/token/v1`. The shared SDK entry point is `wallet/web/core/token-app.js`: `token-sdk.js` owns frozen template descriptors, typed drafts and canonical ABI/config commitments; `token-runtime.js` owns release binding and read-only verification; `token-handoff.js` owns preparation through the existing Wallet execution boundary. This is a browser-safe application layer, not a second Wallet or standalone service.

Runtime verification requires an independently approved Wallet-owned release binding. It reconciles chain and genesis hash, both canonical Registry records and their commitments, ten dependency code hashes, immutable getters, active community Vault registration and typed policies, all eight template profiles and the canonical verification block. It rejects reserved, aliased or mismatched dependencies. Shape validation alone is not authorization.

`token-discovery.js` connects this SDK to the existing Wallet host. The runtime generator admits an optional verified, bound `appAuthority.token420` inventory entry for the same environment and chain; otherwise generated `token` is null. The runtime config validator reconciles the release with the Wallet Registry and CapabilityRegistry authority. The connected Wallet host resolves the selected SmartAccount afresh, rechecks its controller and chain and the canonical verification block, and publishes an immutable `DISCOVERY_ONLY` snapshot through an internal shared session. Account/chain/disconnect events or newer refreshes invalidate older in-flight reads. The Apps catalogue uses only that session for Token's read-only status; Token is Wallet-integrated and rejects generic navigation and public-manifest launch URLs. No signing, account grants or spending authority are introduced. Actual live configuration remains absent until qualified deployment evidence exists.

`token-catalogue.js` exposes the eight immutable display profiles through `token-app.js`, derives only enablement from the complete verified discovery snapshot, rejects missing/duplicated/substituted profiles, and separates unknown and governance-disabled availability. The actual Wallet Apps page mounts `token-catalogue-ui.js` with keyboard-accessible selection and refresh controls. Opening/refreshing the catalogue or selecting a currently enabled profile rechecks the host-approved runtime; selection becomes a display-only preference bound to the new verification block, never a draft or transaction authorization. Unconfigured/offline states still describe all eight profiles without allowing selection. Counterfactual/non-owner readiness is shown separately. Fee semantics remain exactly 42 native 420 with network gas separate. No new live configuration, external launch URL, or write authority exists.

`token-erc20-wizard.js` and `token-erc20-wizard-ui.js` implement Wallet ERC20 configuration for the six frozen profiles. The form requires a verified deployed SmartAccount owner selecting an enabled ERC20 profile. It uses exact integer conversion of decimal quantities to 18-decimal base units, a positive cap at least equal to supply only for the capped profile, metadata validation, secure random bytes32 salt and the contract's uint208 vote checkpoint supply bound. Draft preparation freshly selects the same profile and checks the same approved release, account and chain, then constructs the canonical SDK request with owner/initial recipient equal to the SmartAccount and exact 42 native 420 fee. Edits or invalidation clear the local draft. No independent signer, submission, gas estimate, simulation, live pin or persistent draft storage.

Preparation re-encodes the typed draft, rejects mismatched or arbitrary calldata and requires the exact 42 native 420 fee. It verifies release and selected-template availability before and after existing SmartAccount420 simulation/estimation. The immutable result explicitly requires confirmation; it does not broadcast or grant signing/spending authority. The application must source the approved binding from trusted Wallet configuration and retain confirmation and submission control in Wallet. Steps 5.1 through 5.4 are qualified; remaining creation interfaces, transaction simulation/review/submission interface wiring and later end-to-end/live gates remain open.

## Downstream integrations

A factory deployment is provenance, not endorsement. 420Registry, Explorer, Search and Analytics may surface the deployment and its indexed events. Swap/Exchange, Pay, Bridge and Launchpad apply their own independent eligibility/qualification rules. 420Token has no authority to manufacture liquidity, bridge backing, legal status, investment quality, or Registry legitimacy.

The Token V1 creation fee is an explicit ecosystem-policy exception: the entire fee is routed to the community Treasury Vault. `DevelopmentCompensationVault420` is not part of this Token V1 fee path.

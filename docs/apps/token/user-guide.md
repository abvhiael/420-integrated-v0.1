# 420 Token user guide

420 Token deploys new ERC assets from a fixed set of versioned templates. It does not create native `$420`, and creating a token does not automatically list it on Swap/Exchange, approve a Launchpad sale, make it bridgeable, or make it endorsed by 420 Integrated.

## Browse templates in Wallet

In 420 Apps, select **Browse Token templates** on the 420 Token card (or expand **420Token template catalogue**). All eight frozen profiles are described even before connection. Availability unverified is not the same as disabled by governance. Connect to the correct Wallet network and use Refresh availability to inspect verified enablement at the displayed block; no profiles are selectable without verification. Selecting an enabled profile performs fresh verification and records only your display preference. If governance disables the template, the account/network changes, or verification fails, the choice is cleared or rejected. A non-owner or undeployed SmartAccount may browse without acquiring execution rights. Creation costs exactly 42 native 420 plus network gas; all creation-fee revenue goes to the community Treasury Vault. All eight profiles have locally qualified creation draft wizards, described below. Transaction simulation, confirmation and submission remain subsequent work.

## Configure an ERC20 token

Select an enabled ERC20 profile while connected as the verified owner of a deployed SmartAccount. Enter token name, symbol, plain decimal initial supply with up to 18 fractional digits, maximum supply only for the capped template, and bytes32 deployment salt (secure random default, editable or regenerable). Amounts are converted exactly; no rounding, commas or scientific notation. The cap must be positive and at least the initial supply; the votes profile has a contract-enforced uint208 supply limit. Zero supply is valid, but a nonmintable template cannot mint additional units. Names and symbols are not unique asset identities.

Choose Prepare ERC20 draft. The wizard rechecks the selected template, approved deployment and account. Review the profile, exact base-unit amounts, intended SmartAccount owner, factory, chain, salt, configuration/calldata hashes and 42 native 420 fee (gas separate and not estimated). Editing, changing profile/account/chain, or a failed refresh invalidates the draft. Clear draft resets the form. A prepared draft has not been simulated, signed, broadcast or created on-chain. Independent Wallet verification, simulation, confirmation and submission remain separate.

## Configure an ERC721 collection

Select the enabled NFT collection (ERC721_COLLECTION V1) profile while connected as the verified owner of a deployed SmartAccount. Enter a collection name, symbol, optional collection base URI and deployment salt (secure random default, editable or regenerable). Empty URI is allowed with a warning. Nonempty URIs must be absolute, with no raw spaces, malformed percent escapes or executable schemes. HTTP(S) addresses need a host and no embedded credentials. The wizard displays URI text without fetching metadata.

**Important:** the frozen V1 contract returns the exact same stored base URI for every minted NFT, does not append IDs or substitute placeholders, and has no URI setter. External content may change or become unavailable. Creation deploys an empty collection owned by your SmartAccount; minting NFTs is a separate owner action. No initial supply, mint recipient, token ID or custom owner is accepted in this creation form.

Choose Prepare ERC721 draft to reverify the template, release and account. Review collection metadata, intended owner, zero initial supply, mint/burn authority, factory, chain, salt, configuration/calldata commitments and exact 42 native 420 creation fee (gas separate, not estimated). Editing, changing selection/account/chain, governance disablement or failed refresh invalidates the draft. Clear collection draft resets the form. A draft has not been simulated, signed, submitted or deployed; no NFT has been minted. Independent Wallet execution and explicit confirmation remain separate.

## Configure an ERC1155 multi-token contract

Select the enabled Multi-token collection (ERC1155_MULTI V1) profile as verified owner of a deployed SmartAccount. Enter an optional metadata URI and secure bytes32 deployment salt. Unlike ERC20 and ERC721, the frozen ERC1155 constructor has no name or symbol. There are no initial IDs, quantities, supply, decimals or custom owner fields. The contract creates zero balances and the SmartAccount owner can mint quantities per ID later.

The stored URI is immutable. Both URI getters return the exact string for every ID, even an unminted ID. To serve separate metadata per ID, use literal `{id}` (for example, `ipfs://example/{id}.json`); compatible clients substitute the ID as a lowercase 64-digit hexadecimal number without `0x`. The wizard shows the resolved example for ID 1 without fetching it. Empty URI and URI without the placeholder are allowed with warnings. External content can change or disappear. Nonempty URI must pass the same safe-text/absolute URI guards as ERC721.

Choose Prepare ERC1155 draft. Review exact stored URI, example resolution, zero initial balances, mint/burn and transfer capabilities, SmartAccount owner, chain, factory, salt, hashes and exact 42 native 420 fee (gas separate, not estimated). Edit, clear, switch profiles/account/chain or failed verification invalidates the draft. Nothing is simulated, signed, submitted or minted by the wizard; further Wallet execution and explicit confirmation are required.

## Before you sign

Use the Wallet-discovered 420 Token service rather than a copied contract address. Confirm the chain, factory identity, template/version, ownership recipient, token metadata and supply/cap settings. The deployment transaction must send **exactly 42 native 420**, in addition to the gas required by the Wallet/account execution path.

Choose the template based on the authority you actually want:

- fixed: no post-deployment minting;
- mintable: creator-owner can mint;
- capped: creator-owner can mint but never above the immutable cap;
- burnable: holders/approved spenders can reduce supply under the template rules;
- permit: supports signed EIP-2612 approvals;
- votes: adds delegated checkpoint voting to permit semantics;
- ERC721 collection: creator-owner mints unique IDs;
- ERC1155 multi-token: creator-owner mints multiple IDs/amounts.

Names and symbols are presentation metadata. The deployed contract address is the canonical on-chain asset identity.

## Deployment flow

1. Open 420 Token from the verified Wallet/Registry application entry.
2. Select a currently enabled template and review its version/profile.
3. Enter the template configuration.
4. Review the creator/owner address and the exact 42-native-420 creation fee.
5. Approve the Wallet transaction only when the verified target is the current TokenFactory420.
6. Wait for a successful receipt. If deployment or Treasury forwarding fails, the whole transaction reverts.
7. Record the deployed token address and provenance: creator, template ID/version and configuration hash.

The factory does not retain post-deployment ownership, mint authority or token custody.

## After deployment

A later governance action may disable a compromised template for **future** deployments. It does not rewrite tokens already deployed from that template.

Explorer/Search/Analytics may display the token from derived/indexed data. If those views disagree with chain state, use the canonical factory deployment record and token contract state. Downstream use in Swap/Exchange, Pay, Bridge or Launchpad requires those protocols' separate qualification rules.

## Current release limitation

Repository qualification can prove code, local integration and Wallet handoff behavior. Until TOKEN-AUDIT-8 is completed on the approved production-equivalent public testnet, there is no repository-authorized live Token factory/Vault address that this guide should tell users to hard-code.

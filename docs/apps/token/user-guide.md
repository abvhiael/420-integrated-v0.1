# 420 Token user guide

420 Token deploys new ERC assets from a fixed set of versioned templates. It does not create native `$420`, and creating a token does not automatically list it on Swap/Exchange, approve a Launchpad sale, make it bridgeable, or make it endorsed by 420 Integrated.

## Browse templates in Wallet

In 420 Apps, select **Browse Token templates** on the 420 Token card (or expand **420Token template catalogue**). All eight frozen profiles are described even before connection. Availability unverified is not the same as disabled by governance. Connect to the correct Wallet network and use Refresh availability to inspect verified enablement at the displayed block; no profiles are selectable without verification. Selecting an enabled profile performs fresh verification and records only your display preference. If governance disables the template, the account/network changes, or verification fails, the choice is cleared or rejected. A non-owner or undeployed SmartAccount may browse without acquiring execution rights. Creation costs exactly 42 native 420 plus network gas; all creation-fee revenue goes to the community Treasury Vault. The current locally qualified catalogue does not yet implement the creation form or submission path below.

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

# 420 Token user guide

420 Token deploys new ERC assets from a fixed set of versioned templates. It does not create native `$420`, and creating a token does not automatically list it on Swap/Exchange, approve a Launchpad sale, make it bridgeable, or make it endorsed by 420 Integrated.

## Browse templates in Wallet

In 420 Apps, select **Browse Token templates** on the 420 Token card (or expand **420Token template catalogue**). All eight frozen profiles are described even before connection. Availability unverified is not the same as disabled by governance. Connect to the correct Wallet network and use Refresh availability to inspect verified enablement at the displayed block; no profiles are selectable without verification. Selecting an enabled profile performs fresh verification and records only your display preference. If governance disables the template, the account/network changes, or verification fails, the choice is cleared or rejected. A non-owner or undeployed SmartAccount may browse without acquiring execution rights. Creation costs exactly 42 native 420 plus network gas; all creation-fee revenue goes to the community Treasury Vault. All eight profiles have locally qualified creation draft wizards and fee review/authorization controls, described below. Wallet submission and canonical receipt tracking are implemented as separate controls; live qualification remains outstanding.

## Configure an ERC20 token

Select an enabled ERC20 profile while connected as the verified owner of a deployed SmartAccount. Enter token name, symbol, plain decimal initial supply with up to 18 fractional digits, maximum supply only for the capped template, and bytes32 deployment salt (secure random default, editable or regenerable). Amounts are converted exactly; no rounding, commas or scientific notation. The cap must be positive and at least the initial supply; the votes profile has a contract-enforced uint208 supply limit. Zero supply is valid, but a nonmintable template cannot mint additional units. Names and symbols are not unique asset identities.

Choose Prepare ERC20 draft. The wizard rechecks the selected template, approved deployment and account. Review the profile, exact base-unit amounts, intended SmartAccount owner, factory, chain, salt, configuration/calldata hashes and 42 native 420 fee (gas separate and not estimated). Editing, changing profile/account/chain, or a failed refresh invalidates the draft. Clear draft resets the form. A prepared draft has not been simulated, signed, broadcast or created on-chain. Continue with the separate fee review, simulation and authorization controls below; submission remains separate.

## Configure an ERC721 collection

Select the enabled NFT collection (ERC721_COLLECTION V1) profile while connected as the verified owner of a deployed SmartAccount. Enter a collection name, symbol, optional collection base URI and deployment salt (secure random default, editable or regenerable). Empty URI is allowed with a warning. Nonempty URIs must be absolute, with no raw spaces, malformed percent escapes or executable schemes. HTTP(S) addresses need a host and no embedded credentials. The wizard displays URI text without fetching metadata.

**Important:** the frozen V1 contract returns the exact same stored base URI for every minted NFT, does not append IDs or substitute placeholders, and has no URI setter. External content may change or become unavailable. Creation deploys an empty collection owned by your SmartAccount; minting NFTs is a separate owner action. No initial supply, mint recipient, token ID or custom owner is accepted in this creation form.

Choose Prepare ERC721 draft to reverify the template, release and account. Review collection metadata, intended owner, zero initial supply, mint/burn authority, factory, chain, salt, configuration/calldata commitments and exact 42 native 420 creation fee (gas separate, not estimated). Editing, changing selection/account/chain, governance disablement or failed refresh invalidates the draft. Clear collection draft resets the form. A draft has not been simulated, signed, submitted or deployed; no NFT has been minted. Continue with the separate fee review and authorization controls below; submission remains separate.

## Configure an ERC1155 multi-token contract

Select the enabled Multi-token collection (ERC1155_MULTI V1) profile as verified owner of a deployed SmartAccount. Enter an optional metadata URI and secure bytes32 deployment salt. Unlike ERC20 and ERC721, the frozen ERC1155 constructor has no name or symbol. There are no initial IDs, quantities, supply, decimals or custom owner fields. The contract creates zero balances and the SmartAccount owner can mint quantities per ID later.

The stored URI is immutable. Both URI getters return the exact string for every ID, even an unminted ID. To serve separate metadata per ID, use literal `{id}` (for example, `ipfs://example/{id}.json`); compatible clients substitute the ID as a lowercase 64-digit hexadecimal number without `0x`. The wizard shows the resolved example for ID 1 without fetching it. Empty URI and URI without the placeholder are allowed with warnings. External content can change or disappear. Nonempty URI must pass the same safe-text/absolute URI guards as ERC721.

Choose Prepare ERC1155 draft. Review exact stored URI, example resolution, zero initial balances, mint/burn and transfer capabilities, SmartAccount owner, chain, factory, salt, hashes and exact 42 native 420 fee (gas separate, not estimated). Edit, clear, switch profiles/account/chain or failed verification invalidates the draft. The draft step does not simulate, sign, submit or mint. Continue with fee review and authorization below; submission remains separate.

## Review fees, simulate and authorize

After preparing any of the eight profile drafts, choose **Simulate and review fees** in the same Wallet form. Review the exact 42 native 420 creation fee paid by your SmartAccount to the verified community Treasury Vault, network gas units and gas-price estimates paid by your connected controller, and the combined estimated cost. The Wallet checks each payer's available balance independently. Gas is an estimate, not a guaranteed final charge. The displayed simulated address is not guaranteed until a deployment succeeds. Review the owner, chain, factory, template and configuration/calldata commitments as well as the simulation and verification blocks.

Choose **Authorize reviewed creation** only after reviewing the displayed request and costs. The Wallet independently re-simulates the exact request; changed costs, creator nonce or simulated address require reviewing the updated quote and authorizing again. Governance disablement, changed account authority, chain changes, reorganization, failed simulation and insufficient balances reject the review. **Cancel authorization**, editing, switching profiles, a refresh or disconnect clears the local approval. The approved cost ceilings are recorded in memory for later Wallet submission; this step never signs, broadcasts or creates tokens. Higher costs require new consent. Pinned simulation estimates must be supported by the connected RPC. Actual submission is a separate Wallet gesture, described below.

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
4. Review the creator/owner address, exact 42-native-420 creation fee and separate gas estimate using the simulation controls.
5. Explicitly authorize the unchanged reviewed creation, then choose **Submit authorized creation** to open the connected Wallet's approval. The Wallet re-simulates and consumes the authorization once; changed costs or context reject the request. Only the verified current TokenFactory420 may be targeted.
6. Check **Token deployment transactions** for pending, reverted, reorganized, unverified or confirmed state. Use **Check deployment confirmation** to revalidate the transaction. The Wallet verifies the exact outer SmartAccount call, factory deployment and Treasury fee events, deployed code and factory provenance against a canonical block. A successful receipt alone is not sufficient. Confirmation indicates canonical inclusion, not finality. If deployment or Treasury forwarding fails, the whole transaction reverts.
7. Record the transaction hash and verified deployed token address. Tracking is retained in the current Wallet page session across draft changes; record the hash before reloading. If the Wallet reports an unknown submission outcome or a transaction is replaced, check the connected Wallet's activity; never automatically resend. A later recheck may withdraw confirmation if the chain reorganizes.

The factory does not retain post-deployment ownership, mint authority or token custody.

## After deployment

A later governance action may disable a compromised template for **future** deployments. It does not rewrite tokens already deployed from that template.

Explorer/Search/Analytics may display the token from derived/indexed data. If those views disagree with chain state, use the canonical factory deployment record and token contract state. Downstream use in Swap/Exchange, Pay, Bridge or Launchpad requires those protocols' separate qualification rules.

## Current release limitation

Repository qualification can prove code, local integration and Wallet handoff behavior. Until TOKEN-AUDIT-8 is completed on the approved production-equivalent public testnet, there is no repository-authorized live Token factory/Vault address that this guide should tell users to hard-code.

## Created-token portfolio and provenance

Open the **Created-token portfolio** within the Wallet catalogue and choose **Refresh created tokens**. The Wallet verifies the approved release and reads canonical TokenFactory420 records for the selected SmartAccount, independently of page-session transaction tracking. The portfolio can be reconstructed after reload; it is not a list of all Wallet holdings. Scan the next deployment page until the independently read creator count is reached. A partial scan is labeled explicitly. All pages refer to one canonical block; account/chain changes, a reorganized block or an incoherent record clear the result. Refresh starts a new block snapshot.

Each entry identifies the original creator, current contract owner (creator, transferred or renounced), token address, frozen template/version, configuration hash, deployment timestamp, factory record index and runtime code hash. ERC20 and ERC721 balances and supply are separate snapshot values; ERC1155 holdings are per token ID and no aggregate supply or balance is claimed. Metadata is displayed as inert text only and may be unavailable. When the connected RPC supports historical indexed log queries and receipts, the Wallet additionally verifies the exact deployment event and corresponding 42-native-420 Treasury fee event against historical code and the canonical receipt. When receipt evidence cannot be verified, the independently verified factory record is explicitly labeled record-only; there is no invented transaction hash or fee receipt. None of these records implies chain finality, verification, Registry endorsement, downstream listing, liquidity or investment quality.

## Template-specific management

From a verified created-token entry, select **Manage**. Owner-only controls are available only for the original creator's SmartAccount when it is still the current contract owner; holder/operator actions are separately checked against on-chain balances and permissions. The fixed ERC20 template cannot mint or burn; mintable and capped profiles can mint (respecting the cap); burnable supports holder burn and allowance burn; votes supports delegation and clearing delegation. All ERC20 profiles support transfer, allowance, allowance transfer, ownership transfer and renunciation as applicable. Permit and votes templates implement EIP-2612 ECDSA permits, not ERC-1271 SmartAccount permits; the SmartAccount uses on-chain approval instead. ERC721 supports owner mint, approved/holder burn, per-ID approval, operator approval, safe transfers and contract ownership transfer. ERC1155 supports owner mint, holder/operator burn, safe single and bounded unique-ID batch transfers, operator approval and ownership transfer. ERC721 mint does not check recipient callbacks; ERC1155 safe operations do. Read the explicit action parameters carefully, especially approval, irreversible ownership changes and recipient addresses.

Simulate the selected operation, inspect its exact parameters and gas bounds, separately authorize, then submit through the connected Wallet. No native creation fee applies. Fresh provenance, owner/holder/operator state, signature-free simulation and cost checks run at every review and before the single-use submission. A canonical exact transaction and expected token event are required for confirmation. No automatic retry. Refresh the portfolio for current state after submission; historical rows are not custody or management authority.

## Ownership, permissions and security controls

Open **Ownership and permissions** within Manage to look up the current contract owner and a specific spender/operator address or token ID. The lookup verifies the canonical factory record, token code and immutable template at a fresh block. It shows ERC20 allowances (including unlimited), ERC721 token holder and specific approval, ERC721/ERC1155 collection-wide operators, and voting delegation or permit nonce where supported. Approval mappings are not enumerable: a targeted lookup is not a complete security inventory. The listed revocation buttons only prepare an exact zero allowance, zero NFT approval, false operator permission or zero voting delegate; simulation, authorization and Wallet submission are still required. Revocation does not undo previous spending or invalidate every other permission, past voting checkpoints or an outstanding ECDSA permit. Local Cancel does not revoke on-chain permissions.

Before high-risk authorization, review the current owner/holder/permission and destination code status, exact action and gas. Type the displayed acknowledgement for owner transfer, irreversible renunciation or burn, new nonzero approval, operator grant, minting, voting delegation or use of another holder's permission. Nonzero allowance replacement carries an old/new allowance race warning; consider confirming a zero revocation first. Destination code presence is not proof of trust or custody. A newer review, editing, cancellation, context change or portfolio refresh invalidates the prior review/approval, including during an in-flight revalidation. Ownership/account and relevant token state are freshly checked before broadcast; changes after broadcast remain subject to the actual frozen contract and chain rules, not a guaranteed state lock. Receipt confirmation proves canonical reviewed operation inclusion, not permanent permission state or finality; refresh to inspect current state.

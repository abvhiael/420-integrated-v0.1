# Token contracts

## TokenIds420

Defines the canonical Token component ID, community Treasury Vault ID and eight frozen V1 template IDs. These preimages are protocol identity and must not be replaced with client-local aliases.

## TokenTemplateRegistry420

Constructor: `TokenTemplateRegistry420(address governanceTimelock)`.

The constructor materializes all eight V1 profiles. `setEnabled(templateId,bool)` is GovernanceTimelock-only. `template(id)` returns version, standard, profile hash and status; `enabled(id)` is the factory admission check.

There is deliberately no post-deployment template-add or implementation-substitution operation in V1.

## TokenFactory420

Constructor: `TokenFactory420(address templateRegistry,address communityTreasuryVault)`.

The factory rejects zero dependencies and requires the Vault to report the exact canonical Token community-revenue Vault ID. Both dependencies are immutable. The creation fee is the constant `42 ether`.

Write methods create only the frozen ERC20/721/1155 implementation classes. CREATE2 salts bind creator, user salt, template ID and creator nonce. Successful deployments are recorded and emit provenance plus fee-deposit events. Failed Treasury deposits revert all deployment state.

## ERC20Template420

Provides standard balance/allowance/transfer primitives plus profile-gated mint, burn, EIP-2612 permit and delegated vote-checkpoint behavior. The domain separator is derived from the active chain ID and verifying contract on every query and permit, including after a chain-ID change. Permit rejects non-27/28 `v`, high-`s`, zero/wrong recovered signers, expired deadlines and replay through the holder nonce.

## ERC721Template420 / ERC1155Template420

Creator-owner minting, ownership transfer and standard approvals/transfers are implemented. Safe contract transfers require receiver callbacks. ERC721 `getApproved(uint256)` rejects nonexistent or burned IDs and approvals clear on transfer/burn. ERC1155 exposes `uri(uint256)` with the standard client-side `{id}` substitution; the legacy `uri()` getter remains available. The factory receives no admin role.

## Registry and generated artifacts

The canonical service implementation is TokenFactory420, registered under `420/component/token/v1` and published as `420/service/token/v1`. Release qualification must bind runtime code hashes, dependency root, manifest and interface commitments.

Generated ABI/reference artifacts must be derived from the exact qualified release. A stale ABI or address copied from an earlier deployment is not authoritative.

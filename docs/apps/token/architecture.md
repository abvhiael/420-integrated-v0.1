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

The Wallet Genesis application catalogue exposes `420/service/token/v1`. A verified runtime binding must contain the chain/version, TokenFactory420, TokenTemplateRegistry420 and community Treasury Vault addresses plus runtime code hashes and the exact canonical Vault ID. `wallet/web/core/token-runtime.js` fails closed on missing, zero, aliased or wrong identities.

Transaction preparation uses `wallet/web/core/token-handoff.js`, which preserves `SmartAccount420` as execution authority. It requires the verified factory target, non-empty factory calldata and exactly 42 native 420. Token client code does not own a private key or acquire an independent transaction broadcaster.

## Downstream integrations

A factory deployment is provenance, not endorsement. 420Registry, Explorer, Search and Analytics may surface the deployment and its indexed events. Swap/Exchange, Pay, Bridge and Launchpad apply their own independent eligibility/qualification rules. 420Token has no authority to manufacture liquidity, bridge backing, legal status, investment quality, or Registry legitimacy.

The Token V1 creation fee is an explicit ecosystem-policy exception: the entire fee is routed to the community Treasury Vault. `DevelopmentCompensationVault420` is not part of this Token V1 fee path.

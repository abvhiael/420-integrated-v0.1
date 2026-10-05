# 420 Token security

## Security model

420 Token reduces deployment risk by allowing only eight frozen V1 template IDs. Callers cannot provide arbitrary bytecode to the factory. Governance can disable future use of an existing template, but the registry has no operation that silently swaps executable code under the same ID/version.

The factory is intentionally non-custodial after creation: it has no token owner role, mint role, seizure function or arbitrary-call path. Template admin rights are assigned to the creator where the selected profile requires them.

## Fee and Treasury safety

Every successful deployment requires exactly 42 native 420. TokenFactory420 forwards the entire fee to its immutable community Treasury Vault dependency and reverts atomically if the Vault deposit fails. Factory state changes, creator nonce increments and the token creation itself therefore do not survive a failed fee deposit.

The expected Vault ID is `420/treasury/vault/token-creation-community-revenue/v1`. Runtime qualification must additionally prove the exact Vault address, code hash and Vault registration; matching an ID string alone is not sufficient live-deployment provenance.

The Token V1 fee does not route through DevelopmentCompensationVault420.

## Permit and voting

The permit template uses an EIP-712 domain containing token name, version, chain ID and verifying-contract address, and it consumes monotonic holder nonces. Canonical `v` and low-`s` requirements reject signature-malleable forms. Expired, replayed or malformed permits fail closed.

Vote power exists only for delegated balances. Transfer, mint and burn paths move voting power between current delegates, while historical checkpoints support past-block queries.

## NFT receiver safety

ERC721 and ERC1155 safe transfers/mints to contracts require the corresponding receiver callbacks. An incompatible contract recipient causes the operation to revert rather than silently locking the asset through a nominally safe path.

## Operational checks

Before signing a deployment, verify the Wallet is on the intended chain and has resolved nonzero, code-bearing identities for the factory, template registry and community Vault. Never trust a copied address, token name/symbol, search result or front-end label as authority.

Template approval means the implementation profile passed the applicable repository qualification; it is not an independent third-party audit, investment endorsement, legal determination, bridge backing or market-listing approval.

## Residual / release-stage risks

Repository-local tests and static analysis cannot prove the correctness of an undeployed production/testnet Registry/Vault binding, governance key custody, RPC integrity, reorg behavior or real transaction operations. Those are explicit TOKEN-AUDIT-8/9 gates.

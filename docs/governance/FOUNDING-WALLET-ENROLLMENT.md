# Founding wallet enrollment, use and claiming

## Address classes — not interchangeable
The reserved `0x041f–0x04ff` range in `contracts/config/system-addresses.json` is exclusively for protocol predeploys and system authority contracts. **Never** publish a private individual's wallet into `assignments` or that reserved range.

The three **named** wallet reservation slots in `contracts/config/founder-wallet-reservations.json`, referenced from the address authorities, are public EVM wallets with no code requirement, no allocated private keys and no wallet custody. They are currently **UNCLAIMED**. The real addresses have not been provided. This is not a token allocation approval.

## Founder workflow — EOA or 420Wallet self-custodial Smart Account
1. Each founder independently creates their personal wallet in 420Wallet (or another compatible EVM wallet), saves its recovery credentials **privately**, and enables recommended local security. There is no on-chain process that can create a private key for Andrew or Janet on their behalf.
2. Each shares **only the public receive address** with the deployment administrators over a verified channel. Check it separately against the address displayed in their wallet, not just a copied message.
3. Pre-Genesis, the deployment process records the three distinct addresses and produces a **chain-/genesis-bound signature challenge**. Founders sign with their own accounts. Mainnet and testnet proof records are separate.
4. The CI Genesis validator refuses `null`, reserved/system addresses, duplicate addresses, missing ownership proof or missing Genesis commitment for live deployment. It must independently verify proof against the actual chain or signing provider; recording a hash alone is not verification.
5. On the target network, the deployed `FoundingWalletClaims420` contract requires each address to call `claimFounderWallet()` from that wallet. Each successful transaction emits `FounderWalletClaimed`; a different address cannot claim the seat. This **attests wallet control**, not human identity. Three distinct claims are required.
6. Once contracts are bound, the founding administrator submits routine Treasury proposals and signs routine releases through 420Wallet; any two named wallets must independently approve an exceptional payment. There is no all-founder shared key.
7. The first-party `DevelopmentCompensationVault420` is configured to pay the `FoundingDeveloperCompensationSplitter420`. Funds accumulate there until each founder connects the same wallet and calls `claimNative()` or `claimToken(token)`. The splitter's immutable 50%/25%/25% entitlements cannot be changed by a Treasury proposal or founding administrator. Founders can send the funds received to another wallet using ordinary wallet transactions.
8. If a founder loses credentials, **no one can simply reset their wallet or seize their allocations**. Recovery and succession need a separately approved constitutional policy before Genesis; do not create an owner-controlled beneficiary-change shortcut.

## Scope and release gates
The public address reservation files do not generate wallets, mint tokens or attest identity. The claim registry and the splitter are **new contract candidates**, neither is included in the immutable 0x04xx predeploy map. They must be deployed/registered as separately resolved services before activation. The existing Development Compensation Vault must be explicitly configured with the splitter address as its immutable `beneficiary` at deployment; redirecting a previously deployed vault is impossible without an approved migration. Testnet and mainnet deployment bindings require separate exact-head audits.

Existing `FounderVestingRegistry` still has **ten 100,000-token grants**; the 50/25/25 *revenue* splitter is independent of those allocations. The 42 million Genesis split remains provisional.

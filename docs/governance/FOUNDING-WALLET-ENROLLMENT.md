# Founding wallet enrollment, use and claiming

## Address classes — not interchangeable
The reserved `0x041f–0x04ff` range in `contracts/config/system-addresses.json` is exclusively for protocol predeploys and system authority contracts. **Never** publish a private individual's wallet into `assignments` or that reserved range.

The three **named** wallet reservation slots in `contracts/config/founder-wallet-reservations.json`, referenced from the address authorities, are public EVM wallets with no code requirement, no allocated private keys and no wallet custody. They are currently **UNCLAIMED**. The real addresses have not been provided. This is not a token allocation approval.

## Founder workflow — EOA or 420Wallet self-custodial Smart Account
1. Each founder independently creates their personal wallet in 420Wallet (or another compatible EVM wallet), saves its recovery credentials **privately**, and enables recommended local security. There is no on-chain process that can create a private key for Andrew or Janet on their behalf.
2. Each shares **only the public receive address** with the deployment administrators over a verified channel. Check it separately against the address displayed in their wallet, not just a copied message.
3. Pre-Genesis, the deployment process records the three distinct addresses and produces a **chain-/genesis-bound signature challenge**. Founders sign with their own accounts. Mainnet and testnet proof records are separate.
4. A live-Genesis proof must be completed **before the chain exists**. The deployment process generates the canonical `420Integrated Founder Wallet Reservation v1` personal-sign message containing the target network, chain ID, exact Genesis plan commitment, role and address. The founder signs this message in their own wallet. `scripts/verify-founder-wallet-reservations.py --require-deployment` uses a pinned `eth-account` to cryptographically recover the signer and fails closed on an absent, wrong-chain, wrong-plan, or duplicate signer. The proof must be separately confirmed with the founder.
5. **After Genesis starts**, on the target network, the deployed `FoundingWalletClaims420` contract requires each address to call `claimFounderWallet()` from that wallet. Each successful transaction emits `FounderWalletClaimed`; a different address cannot claim the seat. This **attests wallet control**, not human identity. Three distinct claims are required.
6. Once contracts are bound, the founding administrator submits routine Treasury proposals and signs routine releases through 420Wallet; any two named wallets must independently approve an exceptional payment. There is no all-founder shared key.
7. The first-party `DevelopmentCompensationVault420` is configured to pay the `FoundingDeveloperCompensationSplitter420`. Funds accumulate there until each founder connects the same wallet and calls `claimNative()` or `claimToken(token)`. The splitter's immutable 50%/25%/25% entitlements cannot be changed by a Treasury proposal or founding administrator. Founders can send the funds received to another wallet using ordinary wallet transactions.
8. If a founder loses credentials, **no one can simply reset their wallet or seize their allocations**. Recovery and succession need a separately approved constitutional policy before Genesis; do not create an owner-controlled beneficiary-change shortcut.

## Scope and release gates
The public address reservation files do not generate wallets, mint tokens or attest identity. The claim registry and the splitter are **new contract candidates**, neither is included in the immutable 0x04xx predeploy map. They must be deployed/registered as separately resolved services before activation. The existing Development Compensation Vault must be explicitly configured with the splitter address as its immutable `beneficiary` at deployment; redirecting a previously deployed vault is impossible without an approved migration. Testnet and mainnet deployment bindings require separate exact-head audits.

Existing `FounderVestingRegistry` still has **ten 100,000-token grants**; the 50/25/25 *revenue* splitter is independent of those allocations. The 42 million Genesis split remains provisional.

### Deployment proof commands

Install `python3 -m pip install -r scripts/requirements-founder-wallets.txt` in the trusted build environment. Populate `contracts/config/founder-wallet-reservations.json` with the three real public addresses, the selected `target_network`, exact chain ID and **approved** `planned_genesis_hash`. Update the mirror slots in both address authorities. Then run `python3 scripts/verify-founder-wallet-reservations.py --print-challenges` to print exact messages for the founders to sign with **personal_sign** (not a spending authorization). Enter the signatures in the proof record and run `--require-deployment`; a hash-only or self-asserted `VERIFIED` state does not pass. Before these inputs exist, strict deployment verification **must fail**, and nothing is reserved as an actual individual's key.

For Smart Accounts relying on EIP-1271/6492 rather than ECDSA EOA signing, a separate code-bound validation process is required; do **not** use a fake EOA signature or invent a private key. Testnet and mainnet challenge records must be independently versioned and validated.

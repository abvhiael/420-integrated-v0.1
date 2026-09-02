# 420 Wallet — Genesis Web + Wallet Core

420 Wallet is the primary user-facing account, authorization and ecosystem-navigation client for 420 Integrated. At Genesis, the wallet is delivered as a web client backed by the existing Genesis Smart Accounts and Capability Registry primitives. It does not introduce a second account system, a second capability authority or a wallet-specific custody contract.

## Wallet Core

Wallet Core binds the user experience to `SmartAccount420`, `SmartAccountFactory420`, `SmartAccountScopes420`, `ECDSA420` and `CapabilityRegistry420`. Protocol discovery is sourced from 420 Registry / `ProtocolRegistry`, with 420 Names and 420 Identity available as optional account-resolution and identity layers.

Ownership, recovery, operators, session keys, scoped capabilities, spending policy, revocation and execution authority remain at the smart-account/protocol layer. This makes the account portable across the Genesis web wallet and future browser-extension, mobile and desktop clients.

## Genesis Web Client

The Genesis web wallet is a replaceable client and is not consensus-critical. It may be built and tested on localhost or staging infrastructure before a final public domain is selected. The production URL must remain configuration-driven. Production HTTPS and WebAuthn/passkey relying-party settings are bound only after the canonical production domain is chosen.

The web client may construct transactions, request signatures and capabilities, display simulation and explain permissions. It must not store user signing keys on a 420-operated server, auto-sign, silently grant capabilities, bypass Smart Account policy or become an authority for balances, ownership, identity or application legitimacy.

## Ecosystem Gateway

420 Wallet must provide clear, verified navigation to core ecosystem services including 420 Search, 420 AppStore, 420 AI, 420 Token, 420 Explorer, 420 Swap, 420 Bridge, 420 Stake and 420 Governance. It must also expose the Developer Hub and first-class links to user guides, developer guides, protocol specifications, white papers, SDK/API documentation, RPC/network configuration, contract addresses and ABIs, testnet faucet, source repositories, and security/audit documentation.

Service destinations are resolved through 420 Registry or a signed/versioned ecosystem manifest. A URL alone is not proof that an application is canonical or safe. Deprecated, compromised or revoked destinations can be warned or blocked without changing the user's underlying account.

## Client Separation

The Genesis web wallet is the first full management client. A later browser extension should optimize dApp connection and signing; mobile should optimize portable authorization, QR/deep-link flows and passkeys/biometrics; desktop should optimize advanced administration and developer/validator tooling. All clients must reuse the same Wallet Core semantics.

## Genesis Invariants

- **WALLET-INV-001** — Web is a replaceable client and has no consensus/canonical-state authority.
- **WALLET-INV-002** — Wallet Core reuses Genesis Smart Accounts and Capability Registry rather than creating parallel authority.
- **WALLET-INV-003** — Ownership, recovery, capabilities, session policy and revocation are portable account-layer state.
- **WALLET-INV-004** — A 420-operated web server never possesses user signing keys and cannot auto-sign.
- **WALLET-INV-005** — Capability grants, spending and high-risk execution always cross the canonical account authorization boundary.
- **WALLET-INV-006** — Core ecosystem destinations are Registry/signed-manifest resolved.
- **WALLET-INV-007** — A production domain is not required to implement the wallet; production WebAuthn RP binding happens after canonical-domain selection.
- **WALLET-INV-008** — Developer Hub and canonical documentation are first-class wallet destinations.
- **WALLET-INV-009** — Unsafe destinations can be revoked/warned without altering wallet-account authority.
- **WALLET-INV-010** — Future extension/mobile/desktop clients reuse the same account, capability, recovery and session semantics.

# 420Wallet Genesis service discovery and dApp handoff (W15.8)

Wallet integration uses **canonical Registry service identities**, not visual catalogue names. Contract source: `contracts/src/libraries/ServiceIds420.sol`. Wallet catalogue: `wallet/web/core/genesis-app-catalog.js`. Protocol: `contracts/src/apps/ProtocolRegistry.sol`.

For approved Genesis services, Wallet's release config supplies one `ecosystemRegistry` address/runtime code hash/chain ID, and each `ecosystemServices` entry supplies the canonical `serviceId`, exact approved HTTPS origin and URL, implementation, codeHash, metadataHash and version. The Wallet checks the actual `getService(bytes32)` registry record and bytecode before listing **and again before navigation**. An inactive, replaced, missing or conflicting service never becomes an approved app. Developer Hub itself is documentation/navigation, not a canonical Registry service ID.

**Important:** A click opens an HTTPS browser tab and grants **zero wallet permissions**. Use the injected EIP-1193 provider and EIP-6963 announcement, then explicitly request `eth_requestAccounts` from the correct origin. Users review every permission/signing/transaction request in 420Wallet. Always validate `eth_chainId`, `accountsChanged` and `chainChanged`, and handle denial, revocation, staleness and account switching. Neither a Registry listing, 420Identity profile, 420Names label nor 420Gas funding offer gives signing or spending authority.

Service policies: recheck Names420 resolved address, expiry and label hash before sends; identity profile/controller and Names↔Identity bilateral claims are on-chain; paymaster offers are funding only; 420Token factory and ERC-20 approvals are separate reviewed transactions. The live Genesis manifest, service implementation proofs, browser/mobile device handoff and real transactions require W15.9 testnet evidence. W15.10 independently audits security and authorizes public release.

Repository qualification: `docs/wallet/W15.8-GENESIS-ECOSYSTEM-INTEGRATION-QUALIFICATION.md`. External execution: `docs/wallet/W15.9-TESTNET-WORK-ROADMAP.md`.

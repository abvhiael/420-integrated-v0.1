# Genesis dApp → 420Wallet connection and authorization

**Use the canonical ID defined in** `contracts/src/libraries/ServiceIds420.sol`, not a product display name or a URL. `420Exchange`, `420Commerce` and `420Grow` do not currently have separate canonical service IDs; use the actual applicable approved Swap/Bridge, Market/Pay or other canonical roles rather than inventing IDs.

## Discovery

The Wallet displays applications only with user-enabled service discovery and trusted chain-specific release metadata matching the live `ProtocolRegistry.getService(keccak256(serviceId))` entry. The entry must be active with the pinned implementation, exact runtime code hash, metadata hash and version. The Registry contract itself must match an approved code hash. A stale, missing, deactivated, contradictory or wrong-chain record is unavailable.

The Wallet config contract uses `ecosystemRegistry` with `{chainId,address,codeHash}`, and `ecosystemServices` entries with `{id,name,serviceId,approved,chainId,version,origin,url,implementation,codeHash,metadataHash}`. Entries must come from the authorized runtime manifest, not dApp self-submitted claims. URLs are HTTPS and exact-origin only; they carry no address/signature/nonce/token or wallet grant parameters. Absent a verified deployment and manifest, the directory stays empty.

## Connection flow

1. A user explicitly chooses an available service. The trusted extension rechecks the current account/chain/network epoch and live Registry publication immediately before opening its HTTPS URL in a separate tab.
2. Opening the URL is **navigation only**. It shares no wallet account and grants no signing, capabilities, session keys, allowances, spend permissions or sponsorship.
3. The dApp discovers the injected EIP-1193/EIP-6963 provider, obtains the chain via `eth_chainId`, and separately requests `eth_requestAccounts`/permissions. Account exposure remains scoped to its exact origin, chain and selected account; account/network/revocation events must be handled.
4. Every `eth_sendTransaction`, `personal_sign`, `eth_signTypedData_v4` or ERC-4337 operation is reviewed in the Wallet against current account/chain, precise intent and authority. No app metadata, Registry legitimacy, service listing, 420Identity profile or Gas quote authorizes signing.
5. The dApp handles declined/revoked requests (`4001`/`4100`), disconnected/changed chain (`4900`/`4901`) and stale approvals. It cannot treat a prior connection, catalogue presence or returned quote as an enduring spending grant.

## Supported service-specific boundaries

- **420Names:** lowercase ASCII `.420`; use the verified chain-specific Names resolver, expiry and owner/recipient/hash checks. Recheck before signing to reject retargeting.
- **420Identity:** on-chain controller/profile and bilateral Names↔Identity claims; a social profile cannot override Wallet's selected controller.
- **420Gas:** paymaster sponsorship is funding only; bind quote to approved chain, EntryPoint, SmartAccount and exact UserOperation digest, then obtain normal Wallet consent.
- **420Token/ERC-20:** factory, template registry, Treasury vault, allowance and transfer authority are on-chain; wallet must review the actual target/value/call data separately from app discovery.
- **420Swap/420Bridge/420Stake:** follow W15.9-M10 live deployment/quote/settlement and genesis staking boundaries. Do not claim public delegation when disabled.

## Release acceptance

Real Genesis Registry/identity/funding deployments, exact manifest signer/origin provenance, user-device/browser handoffs and transaction receipts are deferred to **W15.9**. Independent security and public-release authorization remain **W15.10**. See [W15.8 qualification](../wallet/W15.8-GENESIS-ECOSYSTEM-INTEGRATION-QUALIFICATION.md) and [consolidated testnet work](../wallet/W15.9-TESTNET-WORK-ROADMAP.md).

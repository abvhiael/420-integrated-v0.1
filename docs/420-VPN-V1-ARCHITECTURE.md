# 420VPN V1 Architecture

Status: **FROZEN FOR IMPLEMENTATION**

420VPN is the decentralized encrypted-routing, relay, bandwidth, session-settlement, provider-staking, and privacy-network protocol for 420 Integrated. It is a protocol and node network, not a centrally operated VPN provider. The official 420VPN application is one client of the protocol; third-party clients and providers may participate through the same canonical registries and interfaces.

## Core architecture rule

Encrypted traffic is carried off-chain by dedicated 420VPN nodes. The 420 chain governs provider/node identity, session authorization, route commitments, pricing-policy references, metering receipts, settlement, staking references, dispute evidence, and lifecycle state. Plaintext traffic, browsing history, DNS queries, destination URLs, packet contents, and detailed traffic metadata are never canonical chain state.

## Canonical objects

- `VPNProvider` — economic/operator identity for one or more nodes.
- `VPNNode` — routable service node bound to one provider.
- `VPNEndpoint` — signed, expiring off-chain endpoint manifest reference.
- `VPNSession` — customer-authorized economic session and route commitment.
- `VPNRoutePolicy` — immutable/versioned route constraints and compatibility rules.
- `VPNBandwidthReceipt` — cumulative signed metering checkpoint.
- `VPNSettlement` — canonical payment result for a session or receipt chain.
- `VPNProviderStakeRef` — reference to provider stake/security assurance.
- `VPNSLARecord` — authenticated service evidence suitable for 420Trust.

## Node capability classes

- `ENTRY_RELAY`
- `MIDDLE_RELAY`
- `EXIT_RELAY`
- `PRIVATE_GATEWAY`
- `APP_RELAY`

A provider may operate many nodes. A node identity cannot silently move between providers.

## Route policies

V1 route-policy classes:

- `SINGLE_HOP`
- `MULTI_HOP`
- `REGION_PINNED`
- `NO_EXIT`
- `PRIVATE_GATEWAY`
- `APP_SPECIFIC`

A session binds a route-policy version/semantic hash before activation. A route policy may constrain region, hop count, allowed/excluded providers, reputation thresholds, price ceilings, exit requirements, and application scope. Route-selection software may be replaceable and non-canonical, but must only select routes that satisfy the bound canonical policy.

## Session model

Canonical session fields should include at minimum:

- `sessionId`
- customer account
- route commitment
- pricing policy ID/version
- maximum authorized spend
- funding/escrow reference
- created/start/expiry timestamps
- receipt-chain root/checkpoint
- lifecycle state

Session lifecycle:

`CREATED -> FUNDED -> ACTIVE -> CLOSING -> SETTLED`

Exceptional terminal/intermediate states may include `EXPIRED`, `DISPUTED`, and `CANCELLED` under explicit policy paths. No transition may recreate spend authority after a session is terminal.

## Payments and settlement

Native `$420` is the default settlement asset. A user authorizes a bounded session spend through the shared 420 programmable-account/capability system. The 420VPN client receives only a narrow, expiring capability scoped to the session/route and maximum spend.

Typical economic flow:

`user authorization -> funded session/escrow -> off-chain encrypted traffic -> cumulative signed receipts -> canonical settlement -> provider payment + unused-value return`

420VPN must not create unrestricted wallet authority. A provider cannot settle beyond the user-authorized session ceiling. Unused funded value remains claimable by the customer according to the session policy.

## Metering

Packet-level accounting is not placed on-chain. Providers and clients use cumulative, monotonic signed receipts. A receipt should bind:

- session ID
- node/provider ID
- sequence number
- cumulative bytes or agreed service units
- cumulative charge
- prior receipt hash
- policy/version reference
- signer domain

Only settlement checkpoints, disputes, or other required commitments reach canonical chain state.

## Provider staking and trust

Providers stake `$420` through the shared staking/security architecture or a dedicated scoped adapter. Provider stake is security assurance; it does not prove that a provider cannot observe traffic. Slashing conditions must be objective, evidence-based, versioned, and narrowly defined.

420VPN integrates with 420Trust for authenticated metrics such as completed sessions, uptime, failure rate, settlement disputes, latency bands, availability history, and slashing history. 420VPN does not create a universal reputation or social-credit score.

## Privacy boundary

420VPN must minimize canonical session metadata. The protocol may commit only information necessary for authorization, routing compatibility, settlement, dispute resolution, and reconstructability. Endpoint addresses should generally be distributed through signed, expiring off-chain manifests rather than permanent public chain state when possible.

No protocol administrator, governance role, provider registry, or client has a protocol-level universal traffic-decryption capability.

## Emergency behavior

Emergency authority may halt new sessions, prevent new provider/node activations, or freeze narrowly defined action classes. It may not redirect customer escrow, redirect valid provider earnings, create beneficiaries, reveal traffic contents, or bypass normal settlement ownership.

## Proposed implementation modules

- `VPNIds420.sol`
- `VPNAuthorization420.sol`
- `VPNProviderRegistry420.sol`
- `VPNNodeRegistry420.sol`
- `VPNPolicyRegistry420.sol`
- `VPNSessionRegistry420.sol`
- `VPNReceiptRegistry420.sol`
- `VPNSettlement420.sol`
- `VPNRouter420.sol`
- `IVPN420.sol`
- optional `VPNTrustAdapter420.sol`

Actual encrypted packet transport, endpoint discovery, route construction, encryption handshakes, keepalives, and bandwidth forwarding remain off-chain node/client responsibilities.

## Frozen V1 invariants

- **VPN-INV-001:** VPN traffic contents are never canonical chain state.
- **VPN-INV-002:** session payment authorization never grants arbitrary wallet execution or transfer authority.
- **VPN-INV-003:** no provider or settlement path may charge above the customer-authorized session ceiling.
- **VPN-INV-004:** the same receipt or settlement checkpoint cannot be settled twice.
- **VPN-INV-005:** cumulative receipts are monotonic, chain-linked, domain-separated, and replay-safe.
- **VPN-INV-006:** unused funded session value remains recoverable/claimable by the customer under the bound policy.
- **VPN-INV-007:** provider, node, factory, registry, or deployment status does not imply custody authority.
- **VPN-INV-008:** node identity cannot silently move between providers.
- **VPN-INV-009:** route selection has no hidden privileged operator able to violate the bound route policy.
- **VPN-INV-010:** provider suspension may stop new work but cannot confiscate already-earned valid settlement.
- **VPN-INV-011:** 420Trust evidence is separable from routing or settlement authority.
- **VPN-INV-012:** provider stake can move only through defined staking, withdrawal, or evidence-based slashing paths.
- **VPN-INV-013:** protocol participation never requires plaintext user traffic to be disclosed to chain governance or canonical contracts.
- **VPN-INV-014:** canonical session metadata is minimized to what is necessary for authorization, settlement, dispute handling, and reconstructability.
- **VPN-INV-015:** a route/pricing policy cannot silently broaden or materially change for an already-bound active session.
- **VPN-INV-016:** a customer may independently revoke an active VPN session/spending capability; revocation does not retroactively invalidate already-earned valid receipts.
- **VPN-INV-017:** settlement is reconstructable from canonical session state plus committed receipt/manifest evidence.
- **VPN-INV-018:** emergency authority may halt actions but cannot redirect customer escrow or provider earnings.
- **VPN-INV-019:** exit-node service/liability/usage policy is explicit and discoverable, not hidden in client code.
- **VPN-INV-020:** no VPN administrator or governance actor possesses universal protocol-level traffic decryption capability.
- **VPN-INV-021:** terminal sessions cannot be reopened or regain spend authority.
- **VPN-INV-022:** a provider cannot settle against a session, receipt chain, or route to which it was not validly bound.
- **VPN-INV-023:** session IDs, provider IDs, and node IDs are stable and never reassigned to different canonical entities.
- **VPN-INV-024:** off-chain endpoint-manifest replacement cannot change canonical provider/node identity or economic terms already bound to an active session.
- **VPN-INV-025:** multi-hop settlement cannot allow one hop to consume another hop's committed entitlement.
- **VPN-INV-026:** failed or disputed service cannot create settlement beyond objectively provable committed receipt state.
- **VPN-INV-027:** external protocol roles in Commons, Pulse, Market, Vault, Bridge, Pay, AI, or other dApps do not automatically confer VPN provider, routing, session, or settlement authority.
- **VPN-INV-028:** protocol contracts do not claim that staking or reputation cryptographically guarantees traffic confidentiality; confidentiality is provided by encryption, key separation, and route architecture.

No new frozen predeploy address is allocated by this architecture decision. Discovery should remain through 420 Registry / ProtocolRegistry unless a later explicit Genesis decision allocates one.

# 420Messenger

420Messenger is the private wallet-to-wallet messaging protocol for 420 Integrated. Canonical chain state coordinates endpoint commitments, unilateral blocks, conversation consent/lifecycle, encrypted-envelope commitments and delivery/read receipts. Plaintext, ciphertext blobs, attachments, media, private keys and decryption keys remain off-chain.

## Canonical boundary

420Messenger is authoritative only for the Messenger coordination state defined by `contracts/config/420messenger-genesis.json`. It does not own community channels (420Commons), token custody, payments, governance, bridges, validators or unrestricted smart-account execution. Off-chain delivery/storage may use ordinary providers or 420ResourceProtocol without making those providers message-content authority.

## Contract graph

1. `MessengerAuthorization420` binds capability checks to `420/COMPONENT/MESSENGER/V1`, an exact action ID and an account-derived scope.
2. `MessengerEndpointRegistry420` stores rotatable key-package and transport commitments.
3. `MessengerBlockRegistry420` stores unilateral directional blocks.
4. `MessengerConversationRegistry420` owns deterministic peer/context conversation IDs and `REQUESTED -> ACTIVE -> CLOSED`.
5. `MessengerEnvelopeRegistry420` stores ordered per-sender encrypted-envelope/storage-reference commitments.
6. `MessengerReceiptRegistry420` stores delivery/read acknowledgement timestamps.
7. `MessengerRouter420` exposes read-only request/send eligibility.
8. `MessengerIds420` freezes component/action IDs.

The Genesis contract map lists exactly those eight Messenger files. `MessengerRouter420` is Registry-resolved and intentionally has no fixed Genesis address.

## Authorization model

Actions are account-local and capability-scoped:

- manage endpoint;
- set block;
- manage conversation;
- send message;
- acknowledge message.

A Messenger capability must not become generic Wallet authority. Implementations must continue to call `CapabilityRegistry420.isAuthorized` with the exact Messenger component, action and `scopeForAccount(account)`.

## State machine and invariants

The frozen invariant set is `MSG-INV-001` through `MSG-INV-012` in `contracts/config/420messenger-genesis.json`. The architecture-level equivalents are `MSG-001` through `MSG-010` in `docs/architecture/protocols/messenger-notifications-attention.md`.

Key rules:

- both endpoints must be active to create a conversation;
- the non-requesting peer must explicitly accept;
- either participant may close; closed is terminal;
- a block in either direction prevents new requests and later envelope commits;
- sequence numbers are exact, monotonic and independent per sender/conversation;
- message identity binds conversation, sender, sequence and envelope commitment;
- only the opposite participant or its exact acknowledgement capability may record a receipt;
- read implies delivered.

## Build and test

The Messenger contracts use Solidity `^0.8.24` under the repository Foundry workspace.

Focused qualification:

```bash
cd contracts
forge fmt --check src/messenger test/MessengerGenesis420.t.sol test/MessengerAudit420.t.sol
forge build
forge test --match-path 'test/Messenger*420.t.sol'
```

Shared qualification:

```bash
python3 scripts/verify-genesis-dapps.py
python3 scripts/verify-420messenger-audit.py
```

The dedicated GitHub workflow `420Messenger Audit Qualification` executes exact-head focused contract, shared Genesis and static-analysis gates.

## Deployment

The deployment graph is frozen in `contracts/config/420messenger-deployment-v1.json`. No Messenger-local owner/admin handoff exists because the V1 contracts declare no Messenger-local mutable admin. The deployment must bind the canonical CapabilityRegistry, deploy the dependency graph in order, publish `420/service/messenger/v1` through ProtocolRegistry to the verified `MessengerRouter420`, and retain code hashes plus manifest/dependency/interface commitments.

No fixed Messenger router address may be fabricated. `contracts/config/genesis-address-namespace.json` defines `messenger-router` as `REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS`.

## Off-chain application/runtime requirements

The protocol contracts do not themselves provide encrypted payload transport, attachment retrieval, message-body persistence, device key custody or a standalone Messenger website. A production client must provide end-to-end encryption and authenticated transport/storage while preserving the chain/off-chain privacy boundary. Existing Bong Goggles work is a consumer/integration surface, not a replacement Messenger authority.

## Operations and recovery

Recover in authority order: endpoint state, blocks, conversations, envelopes/sequences, receipts, derived indexes, then off-chain transport/storage. A provider outage must never rewrite canonical history. Loss of an off-chain encrypted payload may make content unavailable but cannot authorize replacement of its canonical commitment.

## Known release gates

Repository qualification can prove contract/build/test/documentation consistency. Testnet readiness additionally requires a real deployed graph, ProtocolRegistry publication, Wallet/client binding and encrypted transport/storage. Genesis/production readiness requires retained live-chain evidence, monitoring/recovery procedures, final exact-release reconciliation and any required independent security acceptance.

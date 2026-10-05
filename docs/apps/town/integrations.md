# 420Town service integrations

TOWN-AUDIT-6 qualifies the repository-side integration boundary between 420Town and its canonical/shared dependencies. This phase does not claim live testnet endpoints.

## Authority model

420Town remains a GEN-SVC replaceable application. It is not promoted into the frozen Genesis application catalog.

### 420Identity

Town actor IDs bind to canonical Identity420 profile IDs for identity-aware workflows. The adapter requires the exact profile ID, a non-empty canonical controller and an active profile. Identity errors fail closed. Town never creates, edits, revokes or infers credentials.

### 420Storage

Large Town content remains off-chain. Town uses the repository `sdk/storage420` client through the canonical Resource Protocol service boundary. Upload preparation is idempotent. Retrieved payload bytes are SHA-256 verified against the Town content anchor before use. Provider substitution or integrity mismatch fails closed and cannot alter Town membership, roles, moderation or entitlement state.

### 420Search

Only explicitly PUBLIC and active Town documents can be projected. Search admits the exact source/domain pair `420Town:public` → `public_town`. Search results remain derived, rebuildable and non-canonical. Restricted/private Town material and encrypted payloads remain excluded.

### 420Notifications

Town produces an explicit notification handoff only after a 420Notifications subscription/consent decision has selected a subscription. Town never implicitly selects recipients. Feed items retain provenance and are non-authoritative.

### 420Messenger / encrypted transport

Town messaging uses canonical Messenger endpoint, conversation, participant and block state. Off-chain transport is encrypted and replaceable. If canonical Messenger authority cannot be read, the send fails before transport. Transport failure cannot rewrite Town membership, roles, permissions, subscriptions, treasury references or entitlements.

The Town adapter carries ciphertext only. Plaintext is not a supported transport field.

### 420Rewards

The existing Town rewards adapter remains optional. Reward publication does not become Town application authority and Town core operation does not depend on rewards availability.

## Registry/service discovery

Registry discovery is optional and bounded to canonical service discovery. A resolved binding must match the exact requested service ID and be active. Discovery does not promote 420Town into the frozen Genesis application catalog.

## Repository qualification boundary

TOWN-AUDIT-6 directly qualifies:

- `town/integrations`;
- affected Town packages;
- `sdk/storage420`;
- 420Search architecture/privacy/result admission affected by public Town projection;
- 420Notifications feed/provenance primitives;
- retained Town Solidity/rewards regressions;
- the Town integration verifier.

Live deployed endpoints, real RPC-confirmed Identity/Messenger contract reads and public testnet service discovery remain TOWN-AUDIT-11 responsibilities.

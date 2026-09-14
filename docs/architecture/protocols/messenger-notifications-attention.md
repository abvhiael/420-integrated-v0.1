---
title: Messenger, Notifications and Attention
audience:
  - developer
  - architect
  - operator
category: architecture
status: development
version: current
---

# Messenger, Notifications and Attention

DOC-7.9 closes the core-protocol documentation phase by documenting three communication and engagement surfaces that intentionally carry different kinds of authority:

- **420Messenger** owns canonical wallet-to-wallet coordination state, but not plaintext message content;
- **420Notifications** is a non-canonical delivery/presentation service derived from canonical or registered sources;
- **420 Cannaseur / Attention** owns canonical consent, campaign, proof, reward and sponsor-liability state while keeping media and raw behavioral telemetry off-chain.

These systems may integrate with one another, but none inherits the others' authority.

## Shared boundary

Communication or engagement infrastructure must never be mistaken for execution authority. A message, alert, campaign, proof or reward record cannot by itself grant arbitrary Wallet capabilities, transfer unrelated assets, modify governance, alter Bridge state, slash validators or bypass the canonical protocol that owns the affected state.

The recurring design rule is **commit the minimum canonical control/evidence needed for interoperability while leaving private payloads and replaceable delivery infrastructure off-chain**.

# 420Messenger

## Purpose

420Messenger is the private wallet-to-wallet messaging protocol. It provides canonical coordination for endpoints, block relationships, conversation state, encrypted-envelope commitments and delivery/read receipts.

It does **not** place plaintext, ciphertext blobs, attachments, media, voice/video payloads, private keys or message-decryption keys on chain.

420Commons remains the authority for community spaces/channels; Messenger is the private peer-to-peer layer.

## Authorization surface

Messenger authority is capability-scoped to an account. The current action domains are:

- manage endpoint;
- set block state;
- manage conversations;
- send messages;
- acknowledge messages.

A delegated Messenger capability therefore does not become generic Smart Account authority.

## Endpoint registry

An active endpoint stores only:

- `keyPackageHash`;
- `transportHash`;
- monotonic revision;
- active/inactive state.

Only the account itself or an exact Messenger capability may update/deactivate that endpoint. Rotating an endpoint increments the revision rather than rewriting historical message commitments.

Transport providers may use the commitment to locate or negotiate delivery, but the provider never becomes canonical message-content authority.

## Blocking

Blocking is unilateral and directional state owned by the blocking account. Either direction is sufficient to prevent a new conversation request or a later envelope commit between the pair.

Blocking does not erase historical message/envelope commitments. It terminates future protocol eligibility.

## Conversation lifecycle

Conversation IDs are deterministic over the two ordered participant addresses plus a nonzero context commitment.

The state machine is:

```text
NONE -> REQUESTED -> ACTIVE -> CLOSED
          |             |
          +-----------> CLOSED
```

A conversation requires:

1. active endpoints for both peers;
2. no block in either direction;
3. an authorized initiator;
4. explicit acceptance by the other participant.

Either participant may close a requested or active conversation. `CLOSED` is terminal; a closed conversation is not reopened.

## Envelope commitments

Messages are represented canonically as encrypted-envelope commitments, not message bodies.

An envelope record binds:

- conversation ID;
- sender;
- strictly increasing per-sender sequence;
- encrypted envelope hash;
- off-chain storage-reference hash;
- commit timestamp.

Canonical message identity domain-separates the conversation, sender, sequence and envelope commitment. This avoids ambiguity if the same encrypted payload commitment appears elsewhere.

A send fails closed if the conversation is inactive, the sender is not a participant, either peer blocks the other, authorization is absent, required commitments are zero, or the sequence is not exactly the sender's previous sequence plus one.

## Receipts

Only the opposite conversation participant, or that participant's exact acknowledgement capability, may acknowledge an envelope.

Receipt state records delivery/read timestamps. Marking an item read also establishes delivery if delivery had not previously been recorded.

Receipts attest only to protocol acknowledgement state; they do not prove human comprehension or external legal notice.

## Off-chain transport and storage

Encrypted payload delivery may use ordinary internet transport or 420ResourceProtocol-backed storage. Neither transport nor storage is canonical message authority.

Loss of an off-chain payload can make content unavailable while its on-chain commitment remains intact. Recovery cannot replace that commitment with operator-selected content.

## Messenger failure and recovery

Recover in authority order:

1. canonical endpoint revisions/state;
2. block relationships;
3. conversation state;
4. envelope commitments and per-sender sequences;
5. receipts;
6. non-canonical indexes;
7. off-chain transport/storage delivery state.

A transport outage must not mutate conversation/envelope history.

# 420Notifications

## Non-canonical by design

420Notifications is a Genesis user service, not a canonical-state protocol. It requires no Notifications-specific Genesis contract and cannot create canonical events.

It derives alerts from canonical or registered sources such as chain/protocol events, Wallet-local watch context, Explorer/Indexer projections, 420Status, 420AppStore and registered application feeds.

A notification therefore answers **what should this user be told about an underlying event?** It never answers **what is the underlying canonical state?**

## Source provenance

Every actionable notification must retain enough provenance to resolve the underlying truth. On-chain events include the relevant network/chain identity and block/transaction/log context where available, together with appropriate confirmation/finality context.

A reorged, reverted, expired or superseded source event may cause presentation state to be retracted or superseded without rewriting finalized canonical history.

## Subscription model

Subscriptions are opt-in and reversible. A user can independently control:

- source;
- topic;
- severity threshold;
- delivery channel;
- mute/unsubscribe state.

Promotional messaging requires separate consent from operational/security alerts.

Watchlists, notification history, delivery tokens and delivery endpoints remain private by default and may remain entirely client-local.

## Delivery reliability

Notification providers implement:

- deterministic deduplication;
- bounded retries;
- rate limiting;
- priority/severity handling;
- provider-neutral handoff;
- replay checkpoints where Indexer event replay is used.

Retry or failover must not create duplicate canonical events or alter the protocol operation being described.

A failed notification must never block a payment, swap, bridge transfer, stake action, governance action or contract interaction.

## Action buttons

A notification action is only a deep link or handoff. It cannot sign, approve spending, grant capabilities or bypass Wallet confirmation.

The origin application/Wallet must perform the ordinary simulation, authorization and signing flow.

## Privacy exclusions

Notification indexing must exclude private Messenger/Commons payloads, encrypted Resource payloads, private Identity fields and raw Attention telemetry.

Delivery infrastructure should minimize address-to-external-endpoint correlation.

# 420 Cannaseur / Attention

## Purpose

The Attention protocol is an opt-in sponsor-funded engagement economy denominated in native `$420`. It makes consent, campaign economics, proof commitments, reward entitlement and sponsor liabilities canonical while keeping advertising media, raw behavioral telemetry and private audience data off-chain.

## Consent is mandatory

Attention proofs require active account consent. Consent may be configured globally or for a specific campaign.

Each consent record contains:

- enabled/disabled state;
- monotonic revision;
- policy commitment.

Campaign-specific consent overrides the global setting once a campaign-specific revision exists.

Only the participant account or an exact account-scoped `MANAGE_CONSENT` capability may change consent.

## Campaign identity and economics

A sponsor creates a campaign with immutable commitments/economic parameters including:

- metadata commitment;
- audience-policy commitment;
- bound verifier;
- declared budget;
- reward per attention unit;
- maximum reward per account;
- start/end window.

The campaign lifecycle is:

```text
DRAFT -> ACTIVE <-> PAUSED -> CLOSED
  |          |
  +------> CANCELLED (from permitted pre-terminal states)
```

Activation requires the sponsor's campaign liability to be funded to at least the declared budget.

Proofs are accepted only while the campaign is `ACTIVE` and the observation timestamp lies inside the committed campaign window.

## Bound verifier and proof commitments

Only the campaign's bound verifier may submit an Attention proof.

A proof binds:

- campaign;
- participant account;
- verifier;
- observation timestamp;
- attention units;
- evidence commitment.

Proof submission additionally requires current consent and a single-use nonzero nullifier. The nullifier is consumed on first successful proof commitment, so replay fails closed.

The evidence hash can commit to external measurement/evidence without publishing raw behavioral telemetry on chain.

## Reward entitlement

Each proof may create at most one reward entitlement. A proof is marked consumed when reward accrual succeeds.

Reward amount is deterministic from:

```text
attentionUnits * campaign.rewardPerUnit
```

Cumulative account rewards for one campaign may not exceed the campaign's immutable `maxRewardPerAccount`.

Reward identity binds the chain, proof, participant account and amount. The resulting reward enters `RESERVED` state before it can be claimed.

## Sponsor-fund segregation

`AttentionTreasury` maintains per-campaign accounting for:

- funded amount;
- reserved rewards;
- paid rewards;
- refunds;
- closed state.

Sponsor campaign balances are segregated liabilities. Generic governance treasury transfers can only spend balance **above** `totalCampaignLiability`.

A reward must be successfully reserved against available campaign funds before it becomes claimable.

## Claiming

A reserved reward can be claimed only for its canonical participant account, either by that account or by an exact account-scoped `CLAIM_REWARD` capability.

Release is single-use. The reward transitions to `PAID`, the reservation decreases, paid accounting increases and the corresponding campaign liability is reduced.

Delegation is intentionally narrow: Attention capabilities do not grant governance, Bridge, validator, generic custody or unrestricted Smart Account authority.

## Closing and refunds

Closing/cancelling a campaign closes its campaign-funding account. A sponsor may recover unused funds only after the campaign is closed **and** all reserved rewards have been cleared.

This prevents refunding funds that are already backing participant reward entitlements.

## Attention privacy boundary

Canonical Attention state should answer questions such as:

- did the account consent under this policy revision?;
- what campaign economics were committed?;
- which verifier was authorized?;
- was this proof/nullifier consumed?;
- what reward entitlement was reserved/paid?;
- what sponsor liability remains?

It should not expose the participant's raw browsing/viewing behavior, private targeting dossier, full media payload, device identifiers or unrelated personal data.

# Cross-system composition

## Messenger + Notifications

A notification service may use Messenger as a delivery transport, but private Messenger payloads are not Notification index input. Messenger delivery does not make Notifications canonical, and Notifications cannot create Messenger conversation/message state without ordinary Messenger authorization.

## Attention + Notifications

A user may opt to receive alerts about campaign/reward state, but Notifications must derive those alerts from canonical Attention state and must not ingest raw behavioral telemetry.

A notification saying a reward is available does not itself reserve or release the reward.

## Messenger + Attention

A sponsor/application may use Messenger for private communications around a campaign, but receipt of a message is not automatically an Attention proof. The campaign's bound verifier, consent rules, time window, evidence commitment and nullifier requirements still apply.

## Wallet boundary

All three systems remain subordinate to Wallet/Capability authorization for the actions they actually expose. None may translate engagement, delivery, message receipt or notification acknowledgement into arbitrary transaction authority.

# Failure behavior

### Messenger transport unavailable

Canonical endpoint/conversation/envelope state remains intact. Retry or replace off-chain transport/storage without rewriting message commitments.

### Notification provider unavailable

Underlying protocol state continues normally. Clients may use another provider or inspect Wallet/Explorer/RPC/origin applications directly.

### Attention verifier unavailable

Do not accept proofs from another verifier merely to preserve liveness. The campaign remains bound to its committed verifier unless an explicit protocol/governance transition permits replacement.

### Attention proof replay

Fail closed when a nullifier or proof has already been consumed.

### Attention treasury shortfall

Do not create an unfunded entitlement. Reservation fails rather than borrowing from unrelated treasury funds.

### Indexer/reorg disagreement

Notifications follow canonical source provenance/finality. Messenger and Attention canonical state follows execution state; derived indexes are rebuilt rather than promoted into authority.

# Recovery order

1. restore canonical execution/finality context;
2. restore Messenger endpoints, blocks, conversations, envelopes and receipts;
3. restore Attention consent, campaign, proof, reward and Treasury-liability accounting;
4. validate reserved/paid/refunded campaign balances;
5. rebuild Indexer/derived projections;
6. restore Messenger transport/storage services;
7. restore Notifications replay checkpoints, subscriptions and provider delivery queues;
8. reconcile user-visible delivery/presentation state against canonical sources.

Private/off-chain payload recovery must never fabricate canonical commitments.

# Protocol invariants

## Messenger

- **MSG-001 — Scoped authority:** endpoint, block, conversation, send and acknowledgement actions require the account or an exact Messenger capability.
- **MSG-002 — Payload privacy:** plaintext, ciphertext blobs, attachments, media, private keys and decryption keys are not canonical chain state.
- **MSG-003 — Explicit peer acceptance:** a conversation cannot become active without valid endpoints, no bilateral block condition and acceptance by the non-requesting peer.
- **MSG-004 — Terminal close:** either participant may close and a closed conversation never reopens.
- **MSG-005 — Block dominance:** a block in either direction prevents new conversation establishment and subsequent message commits.
- **MSG-006 — Ordered envelopes:** envelope sequence is strictly monotonic per sender per conversation.
- **MSG-007 — Replay-resistant message identity:** canonical message IDs bind conversation, sender, sequence and envelope commitment.
- **MSG-008 — Recipient receipts:** only the opposite participant or exact delegated capability may record delivery/read acknowledgement.
- **MSG-009 — No ambient power:** Messenger grants no token, custody, governance, Bridge, validator or unrestricted account authority.
- **MSG-010 — Provider neutrality:** transport/storage providers never become canonical message-content authority.

## Notifications

- **NOTIF-001 — Non-canonical:** Notifications owns no canonical protocol state.
- **NOTIF-002 — Provenance required:** every actionable alert retains canonical/registered source provenance and network identity where applicable.
- **NOTIF-003 — No execution authority:** Notifications cannot sign, spend, grant capabilities, mutate protocols or bypass Wallet confirmation.
- **NOTIF-004 — Opt-in subscriptions:** source/topic/severity/channel controls are reversible; promotional delivery requires separate consent.
- **NOTIF-005 — Retry safety:** retry/fan-out/failover cannot manufacture duplicate canonical events.
- **NOTIF-006 — Privacy:** private communication/resource/identity payloads, raw Attention telemetry, watchlists and delivery endpoints are not public protocol state.
- **NOTIF-007 — Canonicality aware:** reorged/reverted/superseded presentation may change without rewriting finalized history.
- **NOTIF-008 — Non-blocking:** notification unavailability cannot block underlying protocol operations.

## Attention

- **ATTN-001 — Opt-in:** no proof is valid without active account/campaign consent.
- **ATTN-002 — Minimum canonical data:** campaign media, raw behavioral telemetry and private audience data remain off-chain.
- **ATTN-003 — Frozen economics:** campaign economics/audience commitments are immutable after campaign creation.
- **ATTN-004 — Bound verifier:** only the campaign's verifier may commit proofs.
- **ATTN-005 — Replay resistance:** proof nullifiers are single-use.
- **ATTN-006 — Window validity:** proof observation time must lie inside an active campaign window.
- **ATTN-007 — One proof/one reward:** a proof creates at most one reward entitlement.
- **ATTN-008 — Per-account cap:** cumulative campaign rewards cannot exceed the immutable account cap.
- **ATTN-009 — Segregated liabilities:** sponsor campaign funds are protected from generic treasury spending.
- **ATTN-010 — Reserve before claim:** reward funds are reserved before an entitlement becomes claimable.
- **ATTN-011 — Exact recipient/single release:** reward release is single-use and pays only the canonical participant.
- **ATTN-012 — Safe refund:** unused sponsor funds are refundable only after campaign closure and after all reservations clear.
- **ATTN-013 — Narrow delegation:** consent/reward capabilities do not become generic Wallet/custody/governance authority.
- **ATTN-014 — No key access:** sponsors and verifiers never receive wallet keys or arbitrary transaction power through Attention.

# Related documentation

- [Protocol integration model](protocol-integration-model.md)
- [Storage Proof and Resource Protocol](storage-proof-resource-protocol.md)
- [Stake, Governance, Treasury and Grants](stake-governance-treasury-grants.md)
- [420Indexer infrastructure](../infrastructure/420indexer.md)
- [Observability, Status and Operator Services](../infrastructure/observability-status-operator-services.md)
- [Wallet permissions and sessions](../../users/wallet/permissions-and-sessions.md)

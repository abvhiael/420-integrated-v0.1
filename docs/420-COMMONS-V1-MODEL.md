# 420Commons V1 Model

Status: **FROZEN FOR IMPLEMENTATION**

420Commons is the canonical community, organization, membership, permission, and coordination protocol for 420 Integrated. It defines durable community identity, membership, roles, capability authority, channels, invitations, and policy state while keeping high-volume communications and private content off-chain.

## Core distinction

- **420Commons** canonicalizes who belongs to a Space, what authority they possess, which policies apply, and which communication/content areas they are entitled to access.
- Messaging payloads, voice/video media, attachments, and other high-volume content are non-canonical transport/storage data and remain off-chain.

## Canonical V1 objects

### Space
A stable community or organization identity with a globally unique `spaceId`, creator account, optional Identity420/420Names references, treasury smart-account reference, metadata commitment, type, visibility, active policy IDs, revision, and lifecycle state.

### Membership
A historical relationship between a member account and a Space. Membership state transitions are append-only/reconstructable and include PENDING, ACTIVE, SUSPENDED, LEFT, REMOVED, BANNED, and EXPIRED.

### Role
A Space-scoped role definition. Role labels are organizational metadata only; execution authority comes from explicit capability IDs assigned to the role.

### Capability
A canonical ActionId defining one narrowly scoped privileged action. Commons uses default-deny authorization. No role string, creator flag, owner address, or hidden super-admin bypasses capability checks.

### Channel
A logical communication/content area with read/publish policy references, encryption-policy reference, metadata commitment, revision, and active state. Message bodies are not stored in Commons contracts.

### Invite
A replay-safe, expiring, optionally account-bound invitation with limited uses.

## Space classifications

Canonical V1 Space types: COMMUNITY, ORGANIZATION, COOPERATIVE, CREATOR_COMMUNITY, MERCHANT_GROUP, PROJECT, GUILD, PRIVATE_GROUP.

Canonical visibility classes: PUBLIC, DISCOVERABLE_PRIVATE, INVITE_ONLY, HIDDEN.

These classifications are descriptive and never grant authority by themselves.

## Authorization

Privileged mutations resolve through canonical ActionIds and explicit Space capability assignments. Role labels never authorize execution. No creator/owner shortcut bypasses capability checks.

## Policy

`CommonsPolicyRegistry420` defines versioned policy records used by Spaces, memberships, channels, and invitations. Policy semantics are immutable by ID; material semantic changes require a new policy ID/version. Policies carry metadata/specification commitments and active state but no string-based execution logic.

## Membership

Admission modes are OPEN, APPROVAL_REQUIRED, INVITE_ONLY, CREDENTIAL_GATED, SUBSCRIPTION_GATED, and CUSTOM_ADAPTER. External credential/payment/custom checks remain adapter boundaries.

Membership history is never erased. State transitions remain reconstructable from events.

## Channels

Canonical V1 channel types are CHAT, ANNOUNCEMENTS, FORUM, FILES, VOICE, VIDEO, EVENT, and GOVERNANCE_DISCUSSION. Commons stores channel identity/access-policy references only; message/media payloads remain encrypted off-chain.

## Integrations and exclusions

420Commons V1 does not store plaintext private messages on-chain, custody treasury funds, implement an independent payment system, modify Identity420 credentials, create universal reputation scores, equate community polls with 420 Governance, or provide hidden owner/super-admin powers.

Treasuries use 420 programmable smart accounts. Payments/subscriptions route through 420Pay. Objective reputation signals route through 420Trust. Identity/credentials route through Identity420. Naming routes through 420Names.

## Invariants

- **COMMONS-INV-001:** `spaceId` is globally unique and never reassigned.
- **COMMONS-INV-002:** membership transitions remain reconstructable and are never erased.
- **COMMONS-INV-003:** privileged actions require an explicit current capability.
- **COMMONS-INV-004:** role labels never imply execution authority.
- **COMMONS-INV-005:** Space moderation has no automatic cross-Space effect.
- **COMMONS-INV-006:** private message/media payloads are non-canonical off-chain data.
- **COMMONS-INV-007:** Commons contracts do not custody community funds.
- **COMMONS-INV-008:** payment finality originates from 420Pay.
- **COMMONS-INV-009:** membership state cannot create or alter Identity420 authority.
- **COMMONS-INV-010:** Commons cannot create a universal reputation score.
- **COMMONS-INV-011:** invite use cannot exceed maximum uses and cannot occur after revocation/expiry.
- **COMMONS-INV-012:** material decisions bind the policy ID/revision used.
- **COMMONS-INV-013:** no unrestricted owner/admin bypass exists.
- **COMMONS-INV-014:** official messaging/storage/indexing infrastructure is non-canonical.
- **COMMONS-INV-015:** Spaces, memberships, roles, capabilities, channels, invites, and policies are reconstructable from chain history plus published specs.
- **COMMONS-INV-016:** ActionId semantics are stable and versioned when materially broadened.

## Genesis implementation sequence

1. `CommonsIds420`
2. `CommonsPolicyRegistry420`
3. `CommonsSpaceRegistry420`
4. `CommonsMembershipRegistry420`
5. `CommonsRoleRegistry420`
6. `CommonsChannelRegistry420`
7. `CommonsInviteRegistry420`
8. `ICommons420`
9. invariant/unit tests
10. Genesis service-map integration

Subscriptions, events, moderation, polls, and encrypted communications clients follow only after the foundation passes qualification.

No new frozen system/predeploy address is allocated by this suite. Discovery remains through the protocol/application registry layer.

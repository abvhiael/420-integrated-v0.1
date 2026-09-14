---
title: 420 Commons protocol
audience:
  - developer
  - architect
  - operator
category: architecture
status: current
version: current
---

# 420 Commons protocol

420 Commons is the canonical community, organization, membership, permission and coordination protocol for 420 Integrated. It defines durable Spaces, membership state, roles, capability-scoped authority, channels, invitations and policy references while keeping high-volume and private content off-chain.

## Authority boundary

Commons owns community coordination state only. It does not custody community funds, replace 420Pay, alter Identity420 credentials, create universal Trust scores, convert community polls into 420 Governance outcomes, or grant execution authority from labels such as owner, creator or administrator.

Privileged mutations are default-deny and require the shared capability model scoped to the exact `spaceId` and ActionId.

## Canonical components

- `CommonsPolicyRegistry420` owns versioned policy records and immutable policy meaning by ID.
- `CommonsSpaceRegistry420` owns Space identity, metadata commitments, lifecycle and active policy references.
- `CommonsMembershipRegistry420` owns reconstructable membership transitions and expiry state.
- `CommonsRoleRegistry420` owns Space-scoped organizational role definitions and assignments.
- `CommonsChannelRegistry420` owns channel identity and access/encryption-policy references, not message bodies.
- `CommonsInviteRegistry420` owns replay-safe bounded invitation evidence.
- `CommonsRouter420` coordinates bounded protocol actions without becoming independent authority.

## Membership and admission

Membership states are append-oriented and reconstructable. Supported admission modes include open, approval-required, invite-only, credential-gated, subscription-gated and custom-adapter flows. External credential/payment/invite checks remain explicit adapter boundaries and fail closed until the relevant evidence is consumed by the admission path.

Invite redemption is evidence only. It never bypasses membership policy or capability authorization.

## Space deactivation

Deactivating a Space freezes subordinate privileged mutations without deleting history. Existing state remains readable. Only the explicit Space update authority may reactivate the Space; subordinate membership, role, channel or invite components cannot reinterpret or override inactivity.

## Channels and private content

Commons stores channel identity, access-policy references, encryption-policy references, metadata commitments and lifecycle state. Plaintext messages, voice/video, attachments and other high-volume payloads are non-canonical off-chain data.

Transport, indexing and storage services remain replaceable infrastructure and do not gain Commons authority merely because they deliver or index content.

## Security and privacy

Security-critical invariants include globally unique Space IDs, reconstructable membership history, exact Space-scoped capability checks, role/authority separation, bounded invite use, no hidden admin bypass, no custody of community funds, and explicit inactive-Space mutation freeze.

Private communications and sensitive membership metadata should remain off-chain unless a narrowly required commitment or identifier is part of canonical policy state.

## Integration rule

Applications must derive authority from canonical Commons state and the shared capability system. UI role labels, cached membership, off-chain moderation databases and message-service state are presentation/operations evidence only and must not silently replace canonical authorization.

## Source model

The frozen implementation model remains `docs/420-COMMONS-V1-MODEL.md`. This governed page owns 420Docs architecture placement and integration boundaries; contract state and generated reference material remain authoritative for exact interfaces and deployment data.

## Related documentation

- [420 Commons developer integration](../../developers/commons-integration.md)
- [420 Commons troubleshooting](../../troubleshooting/commons.md)
- [420 Trust protocol](trust.md)
- [Registry, Names, Identity and 420-IS](registry-names-identity-420is.md)

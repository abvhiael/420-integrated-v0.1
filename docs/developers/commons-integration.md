---
title: 420 Commons developer integration
audience:
  - developer
category: developer
status: current
version: current
---

# 420 Commons developer integration

Integrations should discover Commons contracts from the selected environment's canonical Registry/release configuration and treat on-chain Commons state plus the shared capability system as authority.

## Read path

Read the exact Space, membership, role, channel, invite or policy object required for the user flow. Do not infer authority from display labels, cached moderation data, message-server state or historical membership without checking the current canonical state.

## Write path

Privileged writes must be scoped to the exact `spaceId` and ActionId expected by Commons authorization. Role names such as owner, admin or moderator are organizational metadata and do not independently authorize execution.

Before submission, confirm selected environment, contract identity, Space activity, membership state, capability scope, relevant policy ID/revision and any expiry/deadline constraints. State-changing retries remain unsafe until the original transaction outcome is reconciled.

## Admission adapters

Invite-only, credential-gated, subscription-gated and custom admission flows rely on explicit adapter evidence. Adapter/provider success by itself is not membership. Treat the request as incomplete until canonical Commons state records the resulting membership transition.

## Messages and media

Do not write plaintext messages, attachments, voice/video payloads or unrelated private profile data to Commons contracts. Off-chain messaging/storage/indexing providers remain replaceable and must not be treated as authorization authorities.

## Failure rules

Fail closed on unknown Space identity, inactive Space, stale/expired membership, missing exact capability, invalid or exhausted invite, unsupported admission adapter, environment mismatch or ambiguous write outcome. Never switch environments or alternate contracts to make a request succeed.

## Verification

After a write, verify canonical receipt/finality and re-read the owning Commons registry. Indexed/Search views may improve UX but remain rebuildable projections.

## Related documentation

- [420 Commons architecture](../architecture/protocols/commons.md)
- [420 Commons troubleshooting](../troubleshooting/commons.md)
- [Capabilities and sessions](capabilities-and-sessions.md)
- [Errors, retries and idempotency](errors-retries-and-idempotency.md)

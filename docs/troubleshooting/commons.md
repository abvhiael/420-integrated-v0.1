---
title: 420 Commons troubleshooting
audience:
  - user
  - developer
  - operator
category: troubleshooting
status: current
version: current
---

# 420 Commons troubleshooting

Use this page when Space membership, roles, channels, invitations or Commons authorization do not match expectations.

## Start with canonical identity

Confirm the selected environment, Commons contract addresses and exact `spaceId`. Do not use another environment or alternate contract because cached UI state appears different.

## Membership mismatch

Re-read canonical membership state and expiry. A previously ACTIVE membership may no longer be effective after expiry, suspension, removal, ban, leave or Space deactivation. Historical membership evidence does not grant current access.

## Role or permission mismatch

Role labels do not grant execution authority. Confirm the exact ActionId and Space-scoped capability required by the attempted mutation. If a UI says `admin` or `moderator` but the capability is absent, the write must remain blocked.

## Invitation failures

Check invite identity, account binding if any, expiry, revocation, remaining uses and Space activity. Invite redemption is evidence only and cannot bypass the membership policy engine. Do not repeatedly redeem an invite after an ambiguous transaction outcome; reconcile canonical state first.

## Inactive Space

An inactive Space intentionally freezes subordinate privileged mutations. Membership, role, channel and invite registries must not reactivate it. Recovery requires the explicit Space update authority.

## Channel or message problems

Commons contracts own channel identity and policy references, not plaintext message delivery. If canonical channel state is correct but messages are missing or delayed, treat that as a transport/storage/indexing incident. Do not mutate canonical Commons state merely to make a messaging UI match.

## Ambiguous writes

A timeout or stale UI is not proof a membership, role, channel or invite mutation failed. Identify the original transaction, verify receipt/finality, and re-read the owning registry before retrying.

## Security and privacy

Never request or disclose Wallet recovery secrets, private signing material, private message content, encryption keys or unrelated personal data when diagnosing Commons issues. Prefer IDs, transaction hashes, policy/capability identifiers and sanitized timestamps.

## Related documentation

- [420 Commons architecture](../architecture/protocols/commons.md)
- [420 Commons developer integration](../developers/commons-integration.md)
- [Wallet/account authorization troubleshooting](wallet-account-authorization.md)
- [Chain/RPC/transaction troubleshooting](chain-rpc-transactions.md)

---
title: 420Town user guide
component: town
audience:
  - user
category: app
status: development
version: v1
---

# 420Town user guide

This guide describes the repository-qualified 420Town browser experience. Live testnet and production endpoints are not yet materialized.

## What 420Town does

420Town provides community discovery, feeds, posts, threads, comments, votes, reporting/moderation workflows, membership, role administration, subscriptions, and entitlements.

PUBLIC discovery is served through 420Search and is non-authoritative. Membership, roles, subscriptions, entitlements, and treasury-reference state come from `TownAuthority420`.

## Connect a wallet

Authority-bearing actions require an EIP-1193 wallet.

The browser checks:

- a wallet account is connected;
- the wallet is on the configured chain;
- `TownAuthority420` is materialized in runtime configuration;
- the transaction target exactly matches that configured contract;
- authority transactions send zero native value.

If any check fails, the action is blocked.

## Discover and open a community

Use Community discovery to search PUBLIC Town entries. Select or enter the application community ID to open its feed.

For existing communities, authority-bearing reads/writes also require the explicit canonical `bytes32` authority community key. The browser does not invent or hash a mapping from the opaque application ID.

## Create or join a community

Community creation prepares a wallet transaction for `TownAuthority420`. After wallet review and chain confirmation, retain the canonical community key for future authority actions.

Joining and leaving are also authority transactions. Owners cannot leave while still owner.

## Publish and participate

The browser supports:

- new posts;
- thread creation;
- comments/replies;
- post voting.

Content mutations require an authenticated API session and an idempotency key. Browser-generated idempotency keys use secure randomness and are kept with the request so retries do not create duplicate writes.

Content body bytes are stored off-chain. Town records a content reference and SHA-256 digest.

## Visibility

Visibility is enforced by the Town content service. Comments inherit the root-post visibility and cannot widen it. Unknown visibility fails closed.

PUBLIC content may be projected into Search. Restricted content must not be exported to the public Search domain.

## Reports, moderation, and appeals

Users can submit reports. Qualified moderators/admins can apply supported actions. An affected subject can appeal where the moderation state permits it.

Moderation history is append-only. Restore releases enforcement but does not erase prior case/decision history.

## Admin actions

The browser exposes member removal and moderator/admin role assignment. These actions are wallet-reviewed authority transactions.

Admin role assignment is owner-only at the contract layer. Leaving/removal clears privileged role bindings so privilege does not resurrect on later rejoin.

## Subscriptions and entitlements

Canonical subscription and entitlement state is read from `TownAuthority420`. Activation/grant actions are authority transactions.

A Town subscription record is application authorization state and is not by itself proof of settled payment.

## Session token and privacy

The API session token is held in memory only. The Town browser does not persist it to `localStorage` or `sessionStorage`.

Messenger integration carries ciphertext only. Search receives only explicit PUBLIC Town projections.

## Common failure states

- **WALLET_NOT_CONNECTED** — connect a wallet.
- **WRONG_NETWORK** — switch to the configured chain.
- **AUTHORITY_UNMATERIALIZED** — the deployment has not supplied a live TownAuthority420 address.
- **UNEXPECTED_TRANSACTION_TARGET** — do not approve; runtime/transaction target mismatch.
- authentication failure — refresh/provision the API session through the deployment's auth layer.
- integrity failure — content retrieved from Storage did not match the Town SHA-256 anchor.
- stale cursor/reorg error — reload the feed so the client obtains a new projection generation.

## Current release boundary

Repository behavior through TOWN-AUDIT-10 is pre-testnet. Live endpoints, live deployed contract addresses, production authentication, operational secrets, wallet receipts, and live reorg/restart evidence are deferred to TOWN-AUDIT-11/12.

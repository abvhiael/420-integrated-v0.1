---
title: 420 Wallet concepts
audience:
  - user
  - developer
category: application
status: development
version: current
---

# 420 Wallet concepts

## Wallet client versus account

420 Wallet is a client. The account it controls is canonical on-chain state. Replacing, reinstalling or changing a qualified client does not create a new account authority model.

## Smart Account

`SmartAccount420` is the portable account boundary used by 420 Wallet. It holds or coordinates the account's executable authority according to canonical account rules. A controller or signing identity may be used to authorize that account without being the same address as the Smart Account itself.

## Controller

A controller is a signing identity authorized by the account. Users must distinguish a controller address from the canonical Smart Account address, especially when receiving assets or administering recovery.

## Capability

A capability is an explicit reusable grant for bounded actions. A connection to a dApp is not automatically a capability. Capabilities should bind the intended target/scope and should be no broader or longer-lived than necessary.

## Session

A session is reusable, usually temporary authority constrained by account policy. Sessions reduce repeated approvals for known bounded actions but do not bypass the account's canonical authorization rules.

## Authorization epoch

The account authorization epoch lets canonical account state invalidate authority derived from an older authorization state. Clients and integrations must not assume an old session or capability remains valid merely because they cached it locally.

## Recovery

Recovery is a canonical account-security transition, not a support reset. The current account model uses a timelocked path and allows appropriate cancellation/defense before recovery completes. A Wallet UI may guide this process but cannot shorten or override the canonical rules.

## Passkeys

Supported WebAuthn/P-256 passkeys are local/device-backed signing mechanisms. Their private material must remain within the authenticator/device boundary. The Wallet server, RPC provider, Indexer and support staff must never require possession of passkey private material.

## Simulation

Simulation predicts supported transaction effects before authorization. It improves review but is not finality, and it cannot guarantee that external state will remain unchanged until execution.

## Finality

Wallet activity should distinguish submitted/pending/canonical/safe/finalized states rather than presenting every observed transaction as irreversible. Canonical chain/finality rules take precedence over UI wording.

## Registry-backed ecosystem discovery

Core application/service destinations should be resolved through canonical Registry state or a signed/versioned ecosystem manifest. A domain name, branding or search result alone is not application authority.

## Replaceable presentation

Balances, labels, history and application metadata may be displayed using RPC/Indexer-derived data. Those views are rebuildable presentation layers. Canonical chain/account/protocol state remains authoritative if derived presentation is stale or inconsistent.

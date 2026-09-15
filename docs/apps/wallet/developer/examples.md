---
title: 420 Wallet integration examples
audience:
  - developer
category: developer-guide
status: development
version: current
---

# 420 Wallet integration examples

These examples describe safe integration sequences without freezing generated ABI/API details that belong in DOC-10.

## Read an account safely

1. validate the intended 420 Integrated network;
2. obtain the selected controller/account context from the qualified Wallet connection;
3. resolve the canonical `SmartAccount420` relationship where applicable;
4. read balance/account state through a qualified RPC/Indexer path;
5. for security-critical authority, verify current canonical account/capability state rather than relying only on cached Wallet UI data.

## Request a one-time transaction

1. resolve the canonical target contract/interface;
2. construct the call with explicit target, calldata and value;
3. provide human-readable action context;
4. request simulation where supported;
5. let the Wallet/account boundary obtain explicit authorization;
6. submit once;
7. track receipt and finality;
8. re-read resulting canonical state.

## Request reusable capability authority

1. identify the exact target/action set needed;
2. choose the narrowest spend/value limits and expiry;
3. bind the request to the intended network/account;
4. present scope clearly to the user;
5. obtain the canonical grant;
6. store only public capability identifiers/metadata needed by the integration;
7. before later use, re-check that the capability remains valid and in the current authorization epoch;
8. handle revocation/expiry as normal expected state.

## Handle a stale session

If a previously working session begins failing, do not silently broaden authority or fall back to owner-level execution. Re-read canonical session/capability state, detect expiry/revocation/epoch change, and ask for a new bounded grant only when the workflow still requires it.

## Handle uncertain submission

If submission returns an ambiguous transport error after signing, first query the known transaction/request identity. Do not create a second economic action until you establish whether the original transaction was accepted or executed.

## Avoid these patterns

- asking users to paste private keys or recovery phrases into a dApp;
- treating `connected=true` as spending authority;
- hard-coding a single frontend URL as canonical application identity;
- trusting a cached capability indefinitely;
- resubmitting a write repeatedly on timeout;
- treating an Indexer event as finalized without finality context;
- requesting owner-level authority for a narrowly scoped recurring action.

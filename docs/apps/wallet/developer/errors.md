---
title: 420 Wallet errors and retries
audience:
  - developer
category: developer-guide
status: development
version: current
---

# 420 Wallet errors and retries

Wallet integrations should classify failures by authority layer so retry behavior does not turn a transient problem into duplicate or unsafe account actions.

## Common error classes

- **network identity mismatch** — wrong chain/network configuration; fail closed and require correction.
- **account discovery failure** — controller/Smart Account relationship cannot be established; do not guess an account.
- **authorization denied** — user rejected or canonical policy refused the action; do not auto-retry as if transient.
- **capability/session invalid** — revoked, expired, wrong scope or obsolete authorization epoch; re-read canonical authority and request a new grant only when appropriate.
- **simulation failure** — explain the revert/constraint where possible; do not submit the same action blindly.
- **RPC/provider failure** — retry reads through a qualified path; avoid duplicate writes.
- **submission uncertainty** — first determine whether a transaction hash/receipt already exists before resubmitting economic intent.
- **execution revert** — transaction was included but failed; present receipt/revert information and gas consequences.
- **reorg/stale projection** — reconcile derived state to canonical chain data.
- **recovery/admin conflict** — surface the canonical recovery/authorization state; never bypass timelocks or competing security transitions.

## Retry rule

Reads are generally retryable. Writes require idempotency-aware handling: preserve request/transaction identity, query canonical state, then decide whether a retry is safe.

## User-visible errors

Errors should tell users what failed, whether anything was submitted, whether funds/gas may have been consumed, and the safest next action. They must not ask users to expose signing or recovery secrets for diagnosis.

Stable ecosystem error identifiers and the cross-product error registry are built in DOC-11; exact machine-generated error selectors/tables belong in DOC-10.

# 420Gas / Paymaster

420Gas is the shared 420 Integrated gas-sponsorship layer for Smart Accounts and other explicitly supported account-abstraction flows.

## Current phase — GAS-6

GAS-1 through GAS-5 established the canonical paymaster interface/payload, EntryPoint validation path, sponsor deposit/reservation accounting, post-operation settlement, and deterministic sponsorship policy commitments.

GAS-6 adds the replaceable authenticated quote/read service boundary used by Wallet, applications, and Developer Hub integrations.

Quotes are short-lived funding offers bound to an exact operation. They never become execution authorization, wallet/session authority, target-protocol permission, canonical chain state, or sponsor-secret exposure.

420Gas reuses:

- chain ID `420` and native `$420` gas;
- `PackedUserOperation420` and `EntryPoint420`;
- canonical Smart Accounts and Wallet Core;
- Capability Registry/session authority;
- Registry/deployment identity;
- 420RPC as replaceable transport;
- Developer Hub off-chain scoped service credentials;
- 420Automation's existing bounded paymaster funding boundary for already-authorized jobs.

It does not create a parallel Wallet/account authority, sign for users, rewrite calls, make invalid operations valid, or turn gas funding into target-protocol permission.

## Core rule

**A sponsor may decide whether to pay for an exact operation. It may not decide what the user is authorized to do.**

## GAS-6 quote service

The initial service module lives in `src/quote-service.mjs` and provides:

- strict quote-request validation;
- exact chain, EntryPoint, paymaster, account, UserOperation hash, policy, replay/authorization ID, cost and validity binding;
- scoped `420gas` service credentials;
- separate `gas:quote` and `gas:read` access;
- short quote TTL enforcement;
- deterministic quote commitments;
- injected signing so sponsor/operator secret material is never stored or exposed by the quote model;
- authority-minimized read views.

The quote service deliberately accepts an injected signer instead of owning sponsor/operator secret material. Transport/authentication implementations may be replaced as long as they preserve the same authority and binding rules.

## Source layout

- architecture: `docs/420GAS-ARCHITECTURE.md`
- roadmap: `docs/420GAS-ROADMAP.md`
- account-abstraction contracts: `contracts/src/accounts/`
- quote service: `420-gas/src/quote-service.mjs`
- quote service tests: `420-gas/test/quote-service.test.mjs`
- 420Gas CI: `.github/workflows/420-gas.yml`
- existing Automation funding boundary: `420-automation/src/funding.ts`

## Next GAS-6 work

Complete the Developer Hub/API transport adapter, authenticated HTTP boundary, quote persistence/read semantics, signer adapter, and integration qualification without moving execution authority or sponsor secrets into Developer Hub.

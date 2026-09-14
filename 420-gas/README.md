# 420Gas / Paymaster

420Gas is the shared 420 Integrated gas-sponsorship layer for Smart Accounts and other explicitly supported account-abstraction flows.

## Current phase — GAS-0

GAS-0 freezes the authority and accounting model before enabling paymaster execution in `EntryPoint420`.

The current canonical EntryPoint remains intentionally fail closed: any non-empty `paymasterAndData` is rejected with `UnsupportedPaymaster()`.

420Gas will reuse:

- chain ID `420` and native `$420` gas;
- `PackedUserOperation420` and `EntryPoint420`;
- canonical Smart Accounts and Wallet Core;
- Capability Registry/session authority;
- Registry/deployment identity;
- 420RPC as replaceable transport;
- 420Automation's existing bounded paymaster quote integration for already-authorized jobs.

It will not create a parallel Wallet/account authority, sign for users, rewrite calls, make invalid operations valid, or turn gas funding into target-protocol permission.

## Core rule

**A sponsor may decide whether to pay for an exact operation. It may not decide what the user is authorized to do.**

## Source layout

GAS-0 is documentation-first because the existing EntryPoint deliberately excludes paymasters. Contract and service implementation starts only after the interface and payload model are frozen.

- architecture: `docs/420GAS-ARCHITECTURE.md`
- roadmap: `docs/420GAS-ROADMAP.md`
- existing account-abstraction contracts: `contracts/src/accounts/`
- existing Automation funding boundary: `420-automation/src/funding.ts`

## Next phase

**GAS-1 — paymaster interface and payload encoding.**

GAS-1 will define the canonical `IPaymaster420` interface plus strict, versioned `paymasterAndData` parsing and binding before any EntryPoint sponsorship execution path is enabled.

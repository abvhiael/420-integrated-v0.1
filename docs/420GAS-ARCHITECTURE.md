# 420Gas / Paymaster architecture

420Gas is shared account-abstraction infrastructure for bounded native `$420` gas sponsorship. It allows an approved sponsor to pay the native execution cost of an otherwise valid Smart Account UserOperation without becoming wallet, application, protocol, governance, oracle, bridge, automation, or consensus authority.

## Core rule

**Paying gas never grants authority to change what the user or owning protocol authorized.**

A paymaster may decide whether it is willing to sponsor an exact UserOperation under a bounded policy. It may not rewrite the sender, nonce, call data, target, value, signature, Smart Account permissions, capability scope, EntryPoint identity, chain identity, or owning-protocol authorization.

420Gas reuses the canonical `EntryPoint420`, `PackedUserOperation420`, Smart Account, Wallet Core, Capability Registry, Registry/deployment identity, and chain-420 fee semantics. It must not create a parallel account or signing layer.

## Current starting point

The existing `PackedUserOperation420` already includes `paymasterAndData`, so the serialization/hash boundary is forward-compatible with sponsorship. `EntryPoint420` V1 deliberately rejects any non-empty `paymasterAndData` with `UnsupportedPaymaster()`.

GAS-0 preserves that fail-closed behavior. Later GAS phases may extend EntryPoint processing only after the sponsorship validation, accounting, deposit, replay, and post-operation rules are specified and tested.

## Authority boundaries

### 420Gas may

- quote sponsorship for an exact operation;
- validate a sponsorship policy against an exact operation hash and chain/EntryPoint identity;
- maintain sponsor deposits and bounded per-policy budgets;
- reserve and settle native `$420` gas costs through the canonical EntryPoint path;
- reject sponsorship for policy, balance, expiry, rate, identity, risk, or resource reasons;
- expose non-authoritative quote/readiness/usage metadata;
- support Wallet, application, and 420Automation sponsorship without changing their underlying authorization.

### 420Gas may not

- sign as a user or Smart Account owner;
- custody Wallet owner/session keys;
- invent or mutate application calls;
- bypass Smart Account validation or Capability Registry restrictions;
- make an invalid UserOperation valid;
- make an unauthorized target-protocol action authorized;
- convert a quote into arbitrary execution authority;
- determine canonical chain state or finality;
- substitute for 420Oracle truth, 420Bridge proofs, Governance approval, or Automation eligibility;
- spend beyond an explicitly funded sponsor deposit/policy limit;
- replay an already-settled sponsorship authorization;
- treat off-chain service approval as sufficient without on-chain EntryPoint/paymaster validation.

## Sponsorship identity

Every sponsorship authorization must be bound to at least:

- chain ID `420`;
- exact `EntryPoint420` address/version;
- exact paymaster address/version;
- exact UserOperation hash or an equivalently complete immutable commitment;
- sponsor policy ID;
- sponsor identity/accounting source;
- maximum sponsored gas/native-cost bound;
- validity window;
- replay nonce or unique authorization ID.

A sponsorship authorization for one operation must not be reusable for a different sender, nonce, call, fee envelope, EntryPoint, chain, paymaster, or policy.

## UserOperation boundary

420Gas treats `paymasterAndData` as sponsorship material, not user intent.

The user/Smart Account authorization remains responsible for the account call. The paymaster validates only whether it will fund the already-formed operation. The final operation hash must bind `paymasterAndData`, as `EntryPoint420.getUserOpHash` already does.

A paymaster rejection must fail the sponsored path without changing the underlying Smart Account's ownership or permissions. Clients may choose to retry as a self-funded operation only by constructing and authorizing the appropriate new operation under normal Wallet rules.

## Deposit and accounting model

The canonical design uses native `$420` deposits controlled by the sponsor/paymaster and consumed only for validated UserOperations.

Required properties:

- no unbounded EntryPoint credit;
- deposit balance cannot go negative;
- reservations are bounded by an exact maximum cost;
- one reservation cannot be double-spent across concurrent operations;
- settlement cannot exceed the reserved/policy maximum;
- unused reservation is released/refunded to the sponsor accounting balance;
- failed account execution may still incur legitimate gas and must be accounted for under the sponsorship terms;
- withdrawals are subject to explicit ownership/authorization and later-phase safety rules;
- service/operator bookkeeping cannot override on-chain deposit truth.

## Policy model

A sponsor policy may narrow sponsorship using deterministic dimensions such as:

- approved Smart Account or account class;
- approved application/protocol identity;
- target address and selector allowlists;
- maximum gas/native `$420` cost;
- per-operation, per-account, per-policy, and time-window budgets;
- validity window;
- required capability/session properties;
- testnet/mainnet environment;
- optional Automation job identity where Automation is the caller context.

Policy evaluation must be fail closed. Missing or malformed policy data never means unlimited sponsorship.

Policies may reduce what the sponsor is willing to fund; they may never broaden Smart Account or target-protocol permissions.

## Replay and concurrency

Sponsorship authorization is replay-sensitive. GAS phases must provide:

- unique authorization identity;
- operation-hash binding;
- expiry;
- single-consumption semantics;
- deterministic handling of concurrent reservation attempts;
- safe recovery after ambiguous submission;
- no automatic re-sponsorship merely because a transaction or UserOperation lookup is temporarily absent.

420Automation sponsorship must additionally preserve AUT-6/AUT-12 replay and ambiguity rules. A paymaster quote cannot authorize Automation to retry an occurrence that Automation itself considers blocked.

## Failure model

420Gas must fail closed under:

- wrong chain or EntryPoint;
- malformed `paymasterAndData`;
- unknown/unregistered paymaster version;
- expired or not-yet-valid authorization;
- exhausted sponsor deposit or policy budget;
- duplicate authorization/replay;
- excessive gas or fee bounds;
- incompatible account/capability/application policy;
- paymaster validation failure;
- post-operation accounting inconsistency;
- reorg/ambiguous execution evidence where safe settlement cannot be established.

A paymaster outage should disable sponsorship, not disable ordinary self-funded Smart Account execution.

## Integration boundaries

- **420 Wallet / Smart Accounts:** Wallet remains the user authorization surface. Sponsorship may improve UX but cannot bypass signing/review/session rules.
- **Capability Registry:** capability restrictions remain authoritative for session/delegated execution; sponsorship cannot widen capability scope.
- **420Automation:** Automation may consume a bounded quote for an already-authorized execution plan. Sponsorship cannot alter job intent or retry rules.
- **420RPC:** transport only; RPC acceptance does not prove sponsorship validity or settlement.
- **420Registry:** canonical discovery/version metadata for approved paymaster deployments; Registry listing does not itself fund operations.
- **420Oracle:** no dependency is required for basic sponsorship. Any future oracle-priced policy remains an external input and cannot become execution authority.
- **420Governance:** governance may define protocol-owned sponsor programs or approved implementations, but ordinary sponsorship remains bounded by the deployed contract rules.

## GAS-0 invariants

- **GAS-001** — sponsorship never creates user/application/protocol authority.
- **GAS-002** — 420Gas reuses `EntryPoint420` and Smart Accounts; no parallel account layer is introduced.
- **GAS-003** — current EntryPoint paymaster rejection remains fail closed until the paymaster execution path is explicitly implemented and qualified.
- **GAS-004** — every sponsorship is bound to chain, EntryPoint, paymaster, policy, operation identity, cost bound, and validity/replay material.
- **GAS-005** — the sponsor can narrow funding eligibility but cannot broaden Smart Account or target-protocol permissions.
- **GAS-006** — deposit/accounting state cannot be inferred solely from replaceable off-chain service records.
- **GAS-007** — ambiguous execution never justifies speculative duplicate sponsorship.
- **GAS-008** — failure of 420Gas degrades to unavailable sponsorship rather than granting free execution or halting self-funded Smart Accounts.
- **GAS-009** — telemetry, quotes, and readiness are non-authoritative operational evidence.
- **GAS-010** — sponsor/operator credentials are distinct from Wallet signing authority.

## Delivery discipline

Each numbered GAS phase is developed on its own branch and pull request, reconciled with current `main`, fully qualified on its exact final head, and merged before the next phase begins.

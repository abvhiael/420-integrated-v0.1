# GEN-11.18 — Genesis ordering and economic-policy contract

Status: implementation committed; exact-head CI and integration qualification required. This document is an operational disclosure, not consensus policy or a transaction-inclusion guarantee.

## Candidate selection

The Genesis Bundler publishes one fixed policy: `fifo-v1`. At each submission cycle it copies the *entire* eligible mempool snapshot, sorts by ascending UTC `AdmittedAt`, breaks exact timestamp ties by ascending lowercase canonical UserOperation hash, then takes at most `BUNDLER_BUNDLE_MAX_OPERATIONS` (default 16) candidates. The builder independently enforces the order even if its pool returns an unsorted snapshot. Entries are revalidated against current chain state before submission. Failed/invalid/ambiguous candidates follow the existing documented submission-intent handling; selection does not itself promise execution.

`AdmittedAt` and expiry are retained on an accepted fee-bump replacement of the same sender+nonce; a replacement therefore does not buy priority or reset the original arrival position. A newly admitted different nonce has its own arrival timestamp. Equivalent timestamps use the canonical operation-hash tie-break; no hidden node-specific tie-breaking is allowed.

## Economic boundary

`gasFees` is used only for canonical execution validation and existing fee-bump replacement checks. It is *not* a sorting key, a paid priority lane, a revenue-sharing entitlement, a chain reward, or a promise of execution. Paymaster sponsorship, wallet identity, sender identity, peer source, operator affiliation, token holdings, 420 Attention, and 420 Governance do not influence ordering. The Bundler does not mint rewards, levy a protocol fee, select validators, or alter execution-layer gas rules.

The current EntryPoint exposes single-operation `handleOp`, so a 'bundle' denotes a bounded deterministic selection submitted as individual transactions, **not** atomic multi-operation settlement. Gas-price dynamics in the execution network and third-party operators' independent policies may affect actual inclusion order; `fifo-v1` only describes this operator's local selection policy.

Unknown or changed `OrderingPolicy` values fail closed at builder initialization; an empty value means `fifo-v1`. Future fee auctions or alternate ordering require a separately documented, versioned, explicitly qualified phase and must not be activated covertly under the Genesis policy name.

## Audit and qualification

`bundler/ordering/policy.go` is the canonical ordering implementation; `bundler/bundle/builder.go` enforces it before truncation. `bundler/ordering/policy_test.go` and `bundler/bundle/ordering_test.go` exercise input permutations, fee/sponsor neutrality, stable ties, bounds, invalid policy overrides, and an intentionally out-of-order pool. Existing mempool replacement tests cover admission-time preservation. Existing persistence audit events and aggregate `/status` counters are operational evidence, not canonical inclusion evidence. No user-operation payload, signature, paymaster secret, or private identity is exposed by the public aggregate status endpoint.

GEN-11.18 is qualified only after exact-head repository workflows pass and operators verify that configured RPC endpoints and wallet paths do not claim prioritization or settlement guarantees. GEN-11.17 hostile-RPC protections remain applicable.

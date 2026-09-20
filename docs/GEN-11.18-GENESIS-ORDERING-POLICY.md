# GEN-11.18 — Genesis bundler ordering and economic-policy boundary

Status: implementation committed; exact-head CI qualification required. This policy governs **local candidate selection**, not canonical chain ordering, inclusion, transaction settlement, transaction fees, or finality.

## Published selection rule (`fifo-v1`)

At each submission cycle the bundler obtains a bounded, expiry-pruned mempool snapshot; the builder independently sorts the entire snapshot by ascending `AdmittedAt` (first local admission timestamp) and then ascending case-normalized canonical UserOperation hash for equal timestamps. The builder takes up to `BUNDLER_BUNDLE_MAX_OPERATIONS` candidates **after** sorting. Each selected operation must pass current-state validation/simulation before its separate EntryPoint `handleOp` transaction is attempted. The existing EntryPoint ABI has no atomic multi-operation `handleOps` entry point; `bundle` is an operational selection term here.

Qualified sender+nonce fee replacements retain the original admission timestamp but receive their own canonical UserOperation hash; their replacement eligibility still requires the independently documented fee-bump rule. Replacement fee is **not** a priority bid. Age does not bypass TTL, sender capacity, reputation, fresh simulation, nonce restrictions, chain and EntryPoint binding, durable pending-submission protection, or operator transaction availability.

## Economic and authority boundaries

There are no Genesis fee auctions, private paid lanes, sponsor-first privileges, operator-affiliate overrides, fee-weighted priority, guaranteed placement, preferential peer ordering, or hidden priority classes. `gasFees` is an immutable signed operation field used for validation and the separately specified sender+nonce replacement threshold, **not** for queue priority. Paymaster sponsorship does not determine priority or grant authorization. An operator cannot change the signed UserOperation, forge account/paymaster authority, force canonical inclusion or supply a finality guarantee. A wallet may choose another compatible bundler. All operations remain subject to chain-native transaction gas fees and external execution-node ordering outside the bundler's control; the local FIFO rule makes no claim about canonical block order.

Only `fifo-v1` (or blank, normalized to `fifo-v1`) is accepted by the builder configuration. Any other policy identifier fails at startup rather than introducing an unqualified mode. The pool's ordering cannot silently override the builder: `ordering.Select` sorts a copy **before** truncation, with time and hash tie-breaks independent of input order, sender, gas fee, sponsor or peer. Changes to this contract require a named version, corresponding tests, disclosure and explicit qualification; operators must not silently reinterpret `fifo-v1`.

## Audit and limits

Durable admission timestamps and canonical hashes are the inputs to the ordering decision. The GEN-11.14 persistence/audit log provides admission and submission state evidence, and GEN-11.16 `/status` provides aggregate operational counters, but neither is a canonical chain witness nor a per-cycle inclusion guarantee. The builder returns the selected/submitted/rejected/failed counts and the recorded submission hashes. Revalidation or explicit RPC rejection can prevent an earlier candidate from inclusion; ambiguous send outcomes remain quarantined under GEN-11.17 to avoid resubmission. The FIFO rule does not promise censorship resistance from an individual operator or a globally shared queue across independent operators.

Regression coverage: `bundler/ordering/policy_test.go` checks stable, fee-neutral and bounded sorting and rejects undisclosed policies; `bundler/bundle/genesis_ordering_test.go` verifies the actual builder ignores fee/sponsorship ranking supplied by a hostile pool and applies truncation after independent selection. Operational acceptance additionally requires all applicable GitHub qualification workflows to succeed on the exact final head.

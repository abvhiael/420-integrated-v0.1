# GEN-11.18 — Genesis Bundler ordering and economic policy

Status: implementation present on `feature/gen11-0-bundler-network-v1`; qualification requires passing the workflows on the exact phase head.

## Published policy: `fifo-v1`

The Bundler selects from the locally admitted, unexpired UserOperation mempool in ascending `AdmittedAt` order, breaking equal-time ties by the lowercase canonical UserOperation hash. Selection sorts the **entire** snapshot before applying `BUNDLER_BUNDLE_MAX_OPERATIONS` (default 16). The timestamp is retained on qualified fee replacement, preventing a replacement from acquiring a new queue position. The policy is implemented by `bundler/ordering/policy.go` and enforced in `bundler/bundle/builder.go`, independent of a mempool implementation's iteration order.

The production Bundler currently uses the fixed `fifo-v1` default; there is **no production environment-variable override for ordering**. The builder configuration accepts only an empty value (normalized to `fifo-v1`) or explicit `fifo-v1` and rejects all other policies. Fee bidding, sponsor identity, operator identity, sender identity, peer source, token holdings, staking or preferential lanes do **not** affect Genesis selection priority. No hidden operator allowlist or private priority lane is part of the Genesis contract.

## Economic and authority boundaries

- A UserOperation must first pass chain/EntryPoint binding, local canonical validation, simulation, nonce/replacement rules and mempool capacity controls. Ordering does not exempt an operation from any of these checks.
- `gasFees` is part of the signed operation and replacement-price validation; this FIFO policy does **not** reorder candidates by max fee or tip. Any economic repricing/replacement still requires fresh UserOperation authorization and all normal validation. A higher fee must not purchase an earlier position under `fifo-v1`.
- Paymaster presence, sponsorship quote or funding mode does not confer priority or allow a Bundler to grant sponsorship. EntryPoint/Paymaster/account authorization is authoritative.
- The Bundler's candidate selection is not canonical transaction ordering, settlement, inclusion, or finality. The execution node and chain decide those matters; receipt evidence is reconciled independently.
- Expiry, revalidation failure, temporary peer-resource protections and unresolved submission intent can make an operation ineligible without fabricating canonical execution. An operator can run another compatible Bundler; `fifo-v1` describes this implementation's local selection, not a network-wide guarantee of equal arrival time.
- The current EntryPoint exposes `handleOp` for one operation per transaction; a bounded selection cycle is *not* an atomic on-chain multi-op bundle.

## Audit and acceptance evidence

`bundler/ordering/policy_test.go` tests independence from the incoming snapshot iteration order, deterministic tie-breaking, fee/sponsorship neutrality, bounded selection, immutable input and rejection of unrecognized economic overrides. `bundler/bundle/ordering_test.go` proves the production builder reorders before truncation and fails closed when configured with an undocumented priority policy. The durable mempool keeps original admission times during fee replacements and restart recovery.

Operators must publish and preserve their configured policy and selection limit alongside their software version. Operational counters and audit records may describe selection and submission, but must not be presented as chain inclusion guarantees. Any future fee auction, stake-weighted priority, paid fast lane, censorship exception or different ordering version requires a separate published, reviewed, versioned policy and new qualification; it must not be silently activated under `fifo-v1`.

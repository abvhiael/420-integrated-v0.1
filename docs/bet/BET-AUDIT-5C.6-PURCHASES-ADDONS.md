# 5C.6 — Funded re-entry, rebuys, late registration and capped add-ons

## Approved frozen rules

A new C6 purchase-policy registry binds one immutable plan to a published base tournament policy before registration opens. Existing C1–C5 deployments, policies, source identities and proof evidence remain unchanged; C6 is a new deployment without an upgrade or migration endpoint.

Re-entry and rebuy retain the original buy-in, 3% fee rounded down once, starting stack, per-person finite cap and earlier hard-time/blind-level cutoff. Rebuys require a genuinely settled zero stack and the existing decision deadline. Re-entry requires authenticated elimination and advances the same verified person's generation; it does not create another finishing position.

The approved optional add-on is one purchase per verified person, at the original buy-in and fee, granting one original starting stack. It requires an existing positive stack at the published break. Its window defaults to 300 seconds and is configurable from one through 3,600 seconds, bounded by recovery grace. The first safe synchronized boundary after the re-entry/rebuy cutoff opens the break. Freezeout policies keep their single-purchase semantics; a new opted-in rebuy/re-entry policy is required for add-ons. Free policies charge zero and retain fully prefunded sponsored prizes.

Only the published break duration pauses blind progression. Late keeper execution does not extend the window or freeze extra playing time. The original emergency-pause budget cannot be reset by a planned break. Recovery is required if the published break plus recovery grace expires.

## Funded admission boundary

A payment accepted before its hard cutoff can activate at a later safe boundary before its immutable readiness deadline. Late entries atomically reserve unique-player capacity. Re-entry and late receipts enter a bounded FIFO (maximum 576 active requests); zero chips are minted until all current-round hands settle and canonical elimination processing removes their genuine zero stacks. Original round membership is frozen, so admission of another table cannot invent an unresolved hand in the closed round.

The canonical host alone activates paid receipts. Queue processing is permissionless and bounded to 32 requests per call. Failed admission retains a fully funded refundable receipt. At readiness expiry, refund credits the original payer with both buy-in and fee, releases any late-entry reservation and unlinks in constant time. It does not reset nonce or gross capability spend. Activated purchases cannot be cashed out. Original prize and fee custody remain segregated until later qualified prize execution.

Identity, capability, operator, policy and emergency authority are checked on payment and activation. Fixed host and payment modules have pinned runtime hashes, fixed delegate targets, identical inherited storage and context guards. There is no arbitrary delegatecall or administrator chip vector.

## Executable qualification

Run `python scripts/bet/qualify-poker-5c6.py --output <fresh-evidence-directory>` with the pinned repository toolchain. The command requires a clean committed scope, binds HEAD and its tree, executes the mandatory native and funded inventory, preserves C1–C5 regression, verifies genuine Groth16 evidence, independently replays cards/pots/purchases/standings, validates deployed verifier identities and code-size bounds, and checks source-bound static dispositions. Acceptance is emitted only after actual execution succeeds; this document is not an acceptance marker.

Both funded fixtures use the real identity and seat-key authority, native-backed $420 escrow, independently funded provider bonds, actual generated seven-key verifiers, encrypted delivery and authenticated NLHE actions, verified reveals and canonical atomic settlement. One exercises re-entry plus late registration; the other exercises zero-stack rebuys. Both buy two capped add-ons and continue through genuine elimination and final-table completion. Each ends with 800 prize units, 24 segregated fee units, eight funded receipts and 8,000 nonredeemable tournament chips.

All original WS8/C5 proving setups are reused. Context-dependent statements receive genuine new proofs; cached proofs are reused only after matching their public inputs and verifying against the unchanged key. The original experimental setup is not a production trusted ceremony. External provider independence, official network deployment and live qualification remain testnet work. Prize execution is outside C6.

The committed evidence manifest lists every required proof/context file by checksum. The independent replay checks chip issuance from escrow receipts before each executed hand, per-person nonce/generation/receipt history, exact fee accounting, once-only add-ons, the host purchase-root chain, seven-card outcomes, pots and final rank bands. The scoped workflow checks out the exact triggering SHA and uploads raw logs, identities, static findings and the acceptance certificate. No unrelated global qualification is requested.

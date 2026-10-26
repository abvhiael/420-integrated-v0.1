# 5C.7 — Prize distribution, cancellation and refunds

## Frozen financial rules

Each new C7 tournament commits a published versioned prize table, its operator and publisher, the full-refund recovery policy, the C7 domain and the bound gameplay host/runtime hash in its event manifest. The table is immutable before registration. Its bands use final unique players, excluding refunded or never-activated entrants. Two-player events are winner-take-all. Buy-ins and sponsored prizes comprise prizes; the previously frozen 3% entry fees remain segregated until completed allocation validates every beneficiary.

Rank prizes are integer floors of the published basis-point weights. Remaining smallest token units go to the highest ranks first. A genuine tied finishing band shares all affected rank prizes, including unpaid places. Its leftover units follow ascending hash(domain, event, manifest, person), with person as collision tie-breaker. No operator supplies winners, prize amounts or recipient vectors. Example fixture weights are test inputs, not approved launch presets.

The payee for a person's final finish is the original payer of their final activated receipt. Permissionless claiming only credits that fixed payee. Credential revocation cannot redirect earned prizes. Withdrawal is by the credited account through the existing exact-balance checked, mutex-protected custody path. Every extra purchase retains its own original payer for refunds.

## Executable boundary

C7 introduces a new immutable successor escrow and fixed, runtime-hash-pinned financial facets. Original C1–C6 contracts, circuits, keys, fixtures and evidence remain unchanged. Existing deployed events are not migrated or upgraded. The host extends genuine C6 gameplay only with read-only observations needed by financial reconciliation.

Prize planning requires canonical COMPLETE phase, the finalized C5 standings certificate, one champion, no open round, no active hand, no queued purchase and no pending rebuy choice. A permissionless keeper loads at most 16 genuine standings rows and allocates at most eight per call. All amounts must sum exactly to held prizes before any fee or prize becomes available. Fees credit the frozen development fund once; prize claims are idempotent and permissionless with fixed payees. Token transfers happen through pull withdrawals.

Pre-start unregister, underfilled cancellation and technical readiness refunds retain qualified C2/C6 rules. Post-start recovery requires the frozen full-refund policy, genuine RECOVERY_REQUIRED phase, an unfinished event and expiry of its original recovery grace. The anchor derives from the original pause, a published break expiry, the authenticated entropy preparation/request deadline, or the actual engine's aborted-hand evidence deadline. Keeper observation cannot extend it; earlier authenticated evidence may shorten it. Active hands must genuinely finish or abort, queued purchases must use the existing refund path, and pending rebuy choices must expire before financial recovery starts.

Recovery freezes the receipt boundary, returns the sponsored remainder to its original funder, and processes at most 32 receipts per call. Every non-refunded activated purchase receives its exact buy-in plus fee at its original payer. Already refunded receipts are skipped. Persistent purchase nonces and gross spending history remain unchanged. Final held prizes, fees and reserved entries must be zero. Completed tournaments cannot be canceled.

## Qualification ownership

Level 1 covers immutable policy publication, deterministic arithmetic, hostile-token custody, access boundaries, bounded allocation, source identities and reviewed static findings. A single cumulative prize table per chunk avoids repeated payout-band scans. Native 576-player arithmetic snapshots with all 576 places paid exercise the same allocation function but cannot authenticate hands or release funds; they do not claim genuine 576-player gameplay.

Level 2 runs funded native-backed $420 tournaments with actual Identity authority, independently funded provider bonds, the retained seven Groth16 proving relations and generated verifiers, authenticated actions, verified cards, independent pot/standing/prize replay and actual beneficiary withdrawals. Owners cover paid re-entry, paid rebuy, free sponsored odd-unit ties and two-player winner-take-all, plus genuine recovery of extra purchases, queued receipts, pending rebuy choices, simultaneous live/aborted tables and sponsored prizes. Every context proof is reused only after its public statement and actual verification match; otherwise a genuine proof is generated using the original setup.

`scripts/bet/qualify-poker-5c7.py` requires a clean exact SHA, actual test execution, every committed proof verification, inherited C1–C6 checks, source-bound static review and checksummed raw evidence. A report is written only after all checks pass. Documentation alone is never acceptance. The scoped workflow binds `github.sha` and uploads execution artifacts. Qualification status and run/SHA evidence belong in the generated report, not success markers in this file.

Level 3, official testnet deployment, real external-provider independence and a production trusted ceremony remain separate. No official network or production approval is asserted here. Unrelated platform workflows and documentation failures are outside this scoped qualification.

## Main reconciliation

Main revision `f22c8463bcdd7cd4031db4a688e07d667e64bb33` adds opt-in persistent randomness requests for other consumers. Poker continues to call the ordinary request API with its existing deadline and void semantics. The shared router source changes transitive runtime identities, so hand-context public statements and genuine proofs for C5–C7 are re-exported and regenerated where they no longer match. The seven circuit relations, verifying keys, generated verifiers and original proving material are retained. Historical qualification and proof bundles remain available at `272b27757fb045f5232296fd6d6810a63f5dc546`; they are not represented as proofs for changed hand contexts. No security assertion or gas limit is relaxed.

Independent replay cross-checks every receipt against the actual purchase event and incoming token transfer, including receipts superseded by re-entry or add-ons. It also matches outgoing token transfers to the fixed prize and fee beneficiaries. The 21 altered-evidence cases retain the original ten and add all eight receipt-payer mutations plus purchase/token-event payer mutations and an actual-withdrawal payee mutation.

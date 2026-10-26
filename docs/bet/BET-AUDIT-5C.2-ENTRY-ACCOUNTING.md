# 5C.2 — Buy-ins, prize pools and entry accounting

## Approved boundary

This step implements real custody for initial tournament entry reservations, sponsored prizes, segregated development fees and full pre-start refunds. It consumes the immutable [5C.1 decisions and policy](BET-AUDIT-5C.1-TOURNAMENT-POLICY.md). The user explicitly approved keeping gameplay-dependent purchases disabled until genuine elimination and safe-hand-boundary integration exists, while qualifying their financial rules separately.

The deployed escrow is deliberately usable only for funded registration qualification, not live tournaments. It has no hand-start, elimination, late-admission, rebuy, re-entry, arbitrary payout, fee-release, migration, upgrade or owner-drain endpoint. It cannot be switched into gameplay mode. A separately qualified future host must integrate these rules with genuine tournament evidence; existing deposits cannot be silently migrated into that host. In this version, an event that locks its roster reaches technical timeout and refunds in full. Do not publish this version as an operational tournament launcher.

## Executable behavior

- `PokerTournamentEntryEscrow420` binds the policy registry's asset and canonical authorization, real `Identity420` credentials, a specific issuer and credential type, and the development vault's immutable beneficiary. The vault must use the same capability registry. Event manifests bind chain, escrow, event, frozen policy digest, asset, identity requirements and fee destination.
- Only the published policy's operator/publisher with an event-scoped CREATE capability may create an event, before registration opens. All advertised sponsorship is pulled from that publisher atomically at creation, separately from each player's deposit. No unfunded sponsor balance or provider bond is counted as prize money. No guarantee, overlay, discount, additional rake or prize interest is implied.
- A purchase requires the active profile controller, a valid VERIFIED credential from the configured issuer/type, a nonzero issuer-attested person claim, an event-scoped ENTER capability covering buy-in plus fee, the exact expected manifest/quote and the next persistent person nonce. Distinct profiles/wallets with the same issuer/person key cannot hold two reservations in an event. This inherits the issuer's responsibility to assign the same canonical person claim to aliases; it does not independently discover real-world identity.
- Each receipt freezes person, subject, original payer, nonce, buy-in, rounded-down 3% fee and original starting-stack allocation. The stack allocation is metadata, never redeemable $420 and never evidence of an admitted live stack. All purchases share the frozen quote. Free entry has zero price and fee. Sponsors may add prefunded prizes; sponsorship itself has no entry fee.
- Whole buy-ins and sponsorship enter the prize bucket; development fees enter a separate held-fee bucket. Nothing can withdraw either bucket during registration or roster lock. Direct token donations remain surplus and cannot inflate a pool, create credits or be swept by an operator.
- Every incoming transfer must debit the payer and credit escrow by exactly the quote. Outgoing transfers must debit escrow and credit the original refund owner exactly. Short, fee-bearing, nonmoving, false-return and callback token behavior is rejected or bounded by the shared reentrancy mutex. Canonical funded positives use actual native-backed Wrapped420, not the hostile-token boundary fixtures.
- Refund/withdrawal does not need an active issuer, credential, profile or capability. Before lock, only the original payer can unregister its exact receipt/nonce. After cancellation, anyone can process a receipt but cannot redirect its full buy-in-plus-fee credit. Credits are pulled by their immutable owner, and failed transfers preserve them atomically. Sponsor credits always go to the original event funder.
- Canonical capability validity includes its `validUntil` second; canonical credential expiry excludes its expiry second. Both semantics are retained and explicitly tested.
- Capability per-call limits include the fee. Event/escrow-scoped gross purchase spending also respects period limits locally, conservatively including canonical registry usage. A refund does not erase gross spending; there is no claim that this contract consumes usage for unrelated modules or implements all future responsible-play controls.
- Scheduled events lock at the original published time if minimum is met; sit-and-go events lock immediately on the target purchase. Underfilled events have one frozen grace, with unchanged thresholds. A later call cannot move an already-due scheduled lock or extend technical readiness. At the exact underfill or technical expiry, cancellation is permissionless. Refund processing is per receipt, so a large field does not require an unbounded refund loop.

## Conservation and audit trail

At every completed monetary operation:

`token balance >= totalLiability = heldPrizes + heldFees + totalCredits`

`totalReceived = totalWithdrawn + totalLiability`

For each event, `received = prize + fees + credited`. `credited` is cumulative refund credits issued, including credits since withdrawn; it is not an outstanding per-event balance. Historical receipts remain addressable after refund, and nonces cannot be replayed. `reservedPlayers` excludes refunded reservations. `admittedUniquePlayers` stays zero because this escrow has no genuine gameplay admission. A later payout engine must count unique actually admitted people, not these reservations or total purchases.

`PokerTournamentPurchaseAccounting420` supplies the identical quote and pure extra-purchase eligibility arithmetic: finite cap, zero chips, safe boundary, hard time/earlier-level cutoff, eliminated re-entry versus a still-live rebuy choice. Its inputs are mathematical facts, not authenticated observations. Unit tests do not fabricate accepted poker proofs or imply that extra purchases are enabled. `purchaseExtra` always reverts and there is no hidden binding setter.

## Focused qualification

`scripts/bet/qualify-poker-5c2.py` requires a clean tracked exact SHA reconciled with main `269262583f86d996935afc8ee1a4a3064123c630`. It fails on unrelated changes or changed inherited policy/cash/crypto source identities. It actually executes:

1. Level 1: all seven new arithmetic tests and seven hostile-token boundary tests; exact quote fuzz, real analyzer execution, compiled/source/runtime identity and code-size checks, with no payable or gameplay escape endpoints. Raw High/Medium analyzer findings retain severity and an exact-source local disposition. This is not independent security review.
2. Level 2: all 46 actual funded entry tests, including 2,500 generated deposit/refund sequences, with canonical Wrapped420, Identity420, capability/operator registries, policy registry and development-fund binding. It exports a successful actual funded receipt trace and deployed escrow runtime hash. These are entry-custody tests, not genuine tournament-hand or prize-execution acceptance.
3. Inherited scoped regression: all 36 5C.1 native policy tests and 43 lifecycle-reference tests, retaining their original sources and evidence. No global suite or unrelated arcade documentation qualification is rerun.

Across these scopes: 139 test methods, 10,000 native fuzz cases and the retained 1,000 randomized nominal model cases. Counts are expected inventory requirements, not success markers. Only a successful actual certificate and CI run establish the pass. Unknown static findings, omitted/skipped tests, insufficient fuzz execution, source drift, unknown ABI methods and compiler or EVM size mismatches fail closed.

Level 3/full platform qualification, genuine tournament gameplay, balancing, finishing ranks and final prize/development-fee execution remain later local Phase C work. Official address/authority binding, deployment, finalized receipts and prospective live acceptance remain the testnet roadmap gates. The testnet being unavailable does not defer local gameplay integration.

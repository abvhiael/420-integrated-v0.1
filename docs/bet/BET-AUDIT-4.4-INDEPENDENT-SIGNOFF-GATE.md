# 420Bet Reference Slot — external authorization gate

**Status: NOT APPROVED.** This is an operational specification, not a third-party sign-off.

Implemented at PR #678:
- `scripts/verify-420bet-reference-slot-integer.py`: pays integer amounts in smallest units, truncates each paytable entry once, enumerates true ways and scatter prizes and caps gross return before computing reserve.
- `scripts/verify-420bet-reference-slot-approvals.py`: verifies detached Ed25519 signatures from three distinct named reviewers for the **same exact candidate payload**, checking against an independently curated trusted reviewer registry. It refuses incomplete, duplicate, untrusted and invalidly signed approvals.
- `.github/workflows/420bet-reference-slot-integer.yml`: reproducible, scoped integer-model checks.

This does **not** complete a mathematical proof of exact expected RTP for all possible random seeds: it is integer-exact **per outcome**, statistically sampled for expectation. It also does not itself publish ABI-encoded reel/paytable hashes matching the Ethereum activation registry. The candidate remains unapproved and off-chain. Prior sampling at 1/80 scale used floating-point prizes and measured 92.996787%; no equivalence to this integer-exact model is presumed without its own successful run.

To grant valid approval, governance must separately establish an authenticated **trusted-reviewer registry** (JSON mapping role -> reviewerId -> public PEM) at a review-controlled repository path, and supply a decision packet with `implementationAuthorId`, `trustedReviewerRegistryPath`, a single `candidate` holding `fixtureSha256`, `stakeSmallestUnits`, `grossCapSmallestUnits`, `maxNetBankrollLiabilitySmallestUnits`, and `approvals` containing the roles below.

Each reviewer signs the UTF-8 bytes of canonical JSON (sorted keys, compact separators) with their independent Ed25519 private key for `{"role":...,"reviewerId":...,"decision":"APPROVED","candidate":...}`. The decision packet contains their public key PEM and base64 signature.

The **three required distinct authorizing roles** are:
1. `target_rtp_policy` — approves a numeric RTP target, tolerance, stake unit and candidate.
2. `independent_rtp_mathematics` — independently recalculates and reviews the actual engine-equivalent model and certifies exact candidate hash and statistical/exact assumptions.
3. `bankroll_liability` — independently signs off gross cap, net liability, correlated risk and sufficient capital coverage.

None may be the implementation author. Roles and keys are not presently provisioned or signed; the verifier must fail closed until they are.

Current hard numerical boundaries of the Solidity **test fixture**: 100 stake, 5,000 maximum gross, 4,900 net reserved liability. They are not permission to conduct live real-money wagering.

**Blockers to full BET-AUDIT-4.4 Level 1 closeout:** definitive production policy and funding approval, three external signatures against immutable terms, verification of a candidate matching the actual on-chain ABI artifact hash, and independent mathematics establishing the approved exact or sufficiently rigorous cap-aware RTP. No such approvals are fabricated here.

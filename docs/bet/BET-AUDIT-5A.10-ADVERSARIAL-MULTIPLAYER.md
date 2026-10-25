# BET 5A.10 — Adversarial security and multiplayer integration

## Scope and authority

This qualification joins the production 5A.2–5A.9 contracts into an executed
nine-player NLHE hand. It preserves the existing genuine heads-up control, its
ten attacks, the single-winner proof bundle and the protected-hand review case.
It does not authorize a live deployment or replace independent security, game
math, trusted setup, operator or legal review. Tournament rules remain separate.

No production contract, generated verifier, circuit, verifying key, storage
layout, security assertion or cashout authority changes in this step. New work
is substantive test, proving-evidence, independent-replay and acceptance-gate
implementation. Capability/environment fixtures retain their existing scope;
cryptographic acceptance always executes real generated Groth16 verifiers.

## Genuine nine-owner funded hand

`BetPokerMultiplayerSecurity610.t.sol` exports 48 actual contract-derived ABI
words before proving. The first 34 retain the established WS8 context format;
the remaining 14 bind the seven additional recipient owners and seat epochs.
Nine owners escrow stacks of 400, 450, 500, 550, 600, 650, 700, 750 and 800 chips.
Player escrow is 5,400; each independent provider separately funds a 5,400-chip
bond, for 10,800 segregated provider collateral. Immutable 5A.9 controls attest
nine distinct control groups and freeze an admission root before the hand.

The actual hand executes:

1. Initial encrypted 52-card admission and both authenticated shuffles.
2. Nine recipient-key possession proofs, aggregate provider-key verification,
   36 encrypted provider shares and all nine owner-authenticated receipts.
3. Nine distinct authorized seat signatures, canonical blinds and turn order,
   full/short all-in raises and calls with unequal contributions.
4. Five public community reveals and eighteen authorized showdown hole reveals,
   each with two genuine partial decryptions and a genuine unmask proof.
5. Eight contested contribution tiers, a distinct main-pot winner, canonical
   capped rake, odd-chip distribution and a 50-chip unmatched-bet refund.
6. Atomic canonical settlement, an immutable nine-seat receipt and release of
   both independently funded provider bonds.

The deterministic final permutation exchanges positions 0 and 24. Position 0
belongs to seat 1; its diamond king beats the shared board in the main pot.
Higher contribution tiers have different eligible contenders. The independent
replay derives balances `[0,3986,50,100,150,200,250,299,345]`, fee 20 and escrow
5,380. These are checked against native events and the canonical settlement
receipt, not supplied as an unverified payout vector to the engine.

## Proof provenance and portable evidence

The seven existing proving setups and generated verifier identities are reused.
The committed `multiplayer/evidence.zip` contains only public qualification
material: context, VKs, public witnesses, genuine proof bytes, Solidity ABI
encodings, encrypted delivery/reveal points, ciphertext decks and checksums.
It contains no proving key or new trusted setup. `bundle.json` pins the archive's
SHA-256. Python preparation checks the archive, expands it within the intended
fixture directory and verifies each manifest digest. Expanded files are ignored
by Git. The Go owner reads the archive directly, so verification works from a
fresh checkout without local expanded files or proving hardware.

All 118 proofs must verify. The verifier owner independently recompiles each
relation, checks its setup identity, regenerates Solidity from the actual VK,
and relates every proof's public witness to its Solidity ABI. Exact public
witness matching is required before reuse. The final permutation generation
reused 12 matching intermediate statements and generated 106 affected proofs;
three final proofs are byte-identical to historical WS8 material. The final
bundle has 115 distinct proofs beyond the pre-5A.10 evidence and seven unchanged
keys. Earlier valid bundle material is never relabelled with different inputs.

## Adversarial and multiplayer matrix

The native owner requires 32 actual cases, including:

| Boundary | Required executed coverage |
|---|---|
| Participant counts | Funded reservation and bounded refund separately for every count 2–9 |
| Actual complete hand | Genuine nine-owner delivery, unequal all-ins, eight tiers and immutable atomic settlement |
| Signature/turn authority | Wrong owner, valid other-seat signature out of turn, stale root, stale action nonce, over-stack bet and revoked ninth player's action |
| Disconnect and exit | Early timeout denial, deterministic disconnected-actor timeout, queued exit preserving the accepted hand and locked escrow cashout denial |
| Provider authority | Locked bond withdrawal denial, known related-provider shuffle denial and selective final-share withholding attributed only to the missing provider |
| Crypto context | Heads-up proof replay into the nine-player context, corrupted initial proof and 2,500 actual generated-verifier corruption fuzz executions |
| Private delivery | Ninth key bound by a wrong owner; eight actual owner receipts with the final receipt missing, followed by bounded refund without penalizing honest providers |
| Reveals/recovery | Actual premature private partial-share denial and bounded missing-public-evidence recovery restoring all nine original stacks |
| Settlement | Duplicate settlement denial and an actual hostile token callback rejected during nine-seat payout |

The 16 additional independent model cases cover every supported participant
count at every button, side-pot differential calculations, and rejection of
forged, revoked, stale, reordered, duplicated, over-stack or unverified inputs.
These models do not confer on-chain signature or cryptographic authority. The
new executed-trace verifier separately consumes the real accepted statements,
actions, card events, admission root and immutable receipt. Missing, duplicated
or substituted proof bytes and mismatched final balances fail closed.

## Qualification gates

The existing three-level model is preserved. The focused Level 2 workflow now
requires all 32 new native cases, the 2,500 corruption fuzz executions, all
inherited mandatory owners, at least 90 successful independent model cases,
the original 40-case funded integration owner and 200 genuine proof
verifications across three bundles (41 + 41 + 118). No skipped or documentation
success marker can satisfy these gates.

The certificate requires a clean exact SHA, 118 accepted multiplayer statements,
nine independently replayed balances, eight tiers, the 50-chip refund, 5,400
player escrow, 10,800 segregated provider collateral and a verified canonical
receipt. It also binds the raw multiplayer trace digest and the crypto/native
execution report digests. Existing runtime/initcode, actual constructor gas,
static severity, protected-hand review and historical provenance gates remain.

The same scoped qualification must pass on the final candidate. Level 3/live
chain, independent provider beneficial control and trusted setup approvals are
separate release evidence. Unrelated global compiler, 420Arcade documentation
and web preview failures remain outside this poker qualification; they must not
be relabelled as passed.

# BET-AUDIT-5A.4 — Phase A security architecture and implementation contract

**Scope:** architecture freeze for cryptographic recipient delivery, canonical deck assignment, authenticated recovery, production proof dependencies. **Level:** 1 (design/specification). **Branch:** PR #743. **Discovery HEAD:** `03deec683e2e11e9faf536ba760f3fb14190eaae`. **Reconciliation:** PR branch diverged from main by 252 ahead / 225 behind at discovery; no main merge attempted as this is an ordinary design step. **Production authorization:** DENIED until actual circuits, adapters, escrow recovery, independent review and all applicable qualification pass.

## 1. Normative invariants

1. Only the completed, verified second shuffle's `PokerPrivateShuffleGate420.recordOf(handId).finalDeckRoot` is a legitimate source for hole-card delivery, constrained to the same hand scope and threshold aggregate public key. Public `PokerDeckDisclosure420` envelopes and receipts alone prove no correctness.
2. Never reveal a hole-card identity, plaintext card or reconstructed share to the chain before authorized showdown. No provider receives the other provider's secret scalar. Providers must not learn the final private card solely by generating delivery evidence.
3. A funded hand is locked **before** any private delivery; no betting until every active seat has exactly two delivery positions, two valid provider share-envelope proofs per position, authenticated recipient ownership, and acknowledgment of the exact accepted commitments.
4. Every proof must bind chain/domain, verifier version, hand ID, final root, position, destination seat, key binding/epoch, source ciphertext, provider identity, proof public-input schema, and delivered-envelope commitment. The same proof cannot be reused for a different hand/seat/key/root.
5. No timeout creates arbitrary settlement authority. Post-betting terminal payouts require provable canonical native rules and card evidence; missing evidence produces the deterministic no-payout recovery transition specified below, not a fabricated winner.
6. No token transfer occurs until the canonical replay-protected ledger operation; cancellation refunds exactly the original locked balances, not the pot or any caller-specified vector. A proof failure cannot grant a controller privileged payout discretion.

## 2. Recipient delivery construction (two-provider encrypted partial shares)

### 2.1 Group and secrets

Use the existing gnark BabyJubJub-compatible twisted-Edwards group over the BN254 circuit scalar field with prime-order subgroup validation and fixed domain-separated MiMC commitments. Denote generator `G`. Providers hold independent nonzero scalars `s_A,s_B`, with registered `P_A=s_A G`, `P_B=s_B G`, aggregate `P=P_A+P_B`. Each final-deck ElGamal ciphertext for position `j` is `(C1_j=r_j G, C2_j=M_j+r_j P)`. Each recipient holds a registered nonzero encryption scalar `t_u` and public key `Q_u=t_u G`. This is an **encrypted threshold-share delivery** protocol, not a claim that ordinary ElGamal rerandomization changes recipient keys.

For each assigned position `j`, provider `i` computes `D_{i,j}=s_i C1_j`; samples secret independent `k_{i,j}`; publishes encrypted share `E_{i,j}=(U=k G,V=D_{i,j}+k Q_u)` into the authenticated recipient-addressed envelope. **Both** share envelopes are required. The recipient locally decrypts `D_{i,j}=V-t_u U` for each provider and reconstructs `M_j=C2_j-D_{A,j}-D_{B,j}`, matching the exact final ciphertext. Neither provider by itself learns `M_j` unless its own scalar or the other share leaks.

### 2.2 Verifiable statement (two positions per recipient)

A genuine gnark circuit `RecipientShareDeliveryV1` must prove knowledge of `s_i,k_{i,j}` and the authenticated ciphertext membership path, with:
- `P_i=s_i G`; `D_{i,j}=s_i C1_j`; `U=k_{i,j}G`; `V=D_{i,j}+k_{i,j}Q_u`.
- `C1_j,C2_j` authenticated with the **same 6-level MiMC leaf/node tree** in `ciphertext_merkle.go`, against `finalDeckRoot`, the exact physical index `j` and hand scope.
- Explicit elliptic-curve/subgroup and scalar range constraints for all untrusted points. Forbid identity/zero keys and malformed points; prover-supplied points are not implicitly valid.
- Hand, seat, position, provider, registered recipient key, verified source deck root, verifier ID and envelope commitment are public values checked again by the Solidity adapter; use a **single, canonical commitment encoding** for the two encrypted share points and transport envelope reference.
- No `s_i`, `k_{i,j}`, `t_u`, plaintext card, `D_{i,j}` or unrevealed rank in public inputs, calldata or events.
- Recipient registers actual `Q_u` and proves key possession via recipient signature/challenge or zero-knowledge possession proof; `keccak256(abi.encode(Qx,Qy,domain,seatEpoch,owner))` is a key fingerprint, not proof of possession. Existing `PokerRecipientKeys420` fingerprint-only API must be extended/versioned with explicit compatibility rules.
- On-chain verifier must validate the circuit public inputs and proof against an immutable deployed verifying key and schema; hashes/receipts cannot substitute for it.

**Exact schema to freeze at circuit implementation:** canonical ordered public inputs must include `handScope`, `finalDeckRoot`, `position`, `seat`, `providerIndex`, source `C1/C2` coordinates, provider public-key coordinates, recipient public-key coordinates, encrypted share `U/V` coordinates, and field-safe domain commitment binding the version/chain/hand/key epoch and envelope. The commitment encoding must be standardized and proven not ambiguous before generating the VK; `keccak256` cannot be assumed equal to field MiMC. No guessed verifier arity is approved in Phase A.

### 2.3 Positions (canonical card layout)

The final shuffled deck is indexed 0..51. For `n=popcount(handSeatMask)` (2..9), **hole positions** are `0..2*n-1`, round-robin through active seats:
- Heads-up: first seat is the button, then next occupied seat.
- 3+ players: first occupied seat after button.
- `seatForPosition(j)` is the `j mod n`-th occupied seat in that circular order; positions `j` and `j+n` belong to the same seat. The button must be derived from authenticated canonical hand initialization before delivery proof authorization; `lastButton` or a caller-chosen button is insufficient.
- Burn/flop/turn/river layout already used by `PokerLiveCardReveals420`: first burn = `2n`; flop = `2n+1..2n+3`; second burn = `2n+4`; turn = `2n+5`; third burn = `2n+6`; river = `2n+7`. Never privately deliver burned or board cards as hole cards.
- The native engine currently computes button in `start()` **after** `allAcknowledged()`: this is a real circular dependency. Implement a pre-start immutable per-hand `dealSeatOrder/button` commitment before delivery, and make `start()` consume that precise commitment. Do not mark the architecture implemented until this is corrected.

### 2.4 Delivery states and transition guards

State path `LOCKED -> SHUFFLE_VERIFIED -> ASSIGNMENT_COMMITTED -> SHARES_PROVED -> ACKNOWLEDGED -> BETTING`. Rejection preserves the prior state. For every active seat, both positions × both providers must have verified share envelopes. Duplicate provider/position, wrong recipient, stale epoch, wrong root, wrong version, key rotation, replay or invalid proof must prevent transition. The recipient acknowledgment authenticates receipt of the exact proof-verified envelope hashes (not an arbitrary receipt string). Do not publicly reveal private ciphertext payloads where doing so would enable unintended recovery; assess metadata leakage in external security review.

## 3. Deterministic disputes and escrow resolution

### 3.1 Terminal policies

- **Pre-betting / no private information released:** a missing shuffle, envelope or acknowledgment past the canonical deadline permits permissionless `VOID_PRE_BET` against the immutable locked escrow snapshot. No rake, no winnings, hand consumed, original chips released exactly once.
- **During betting, authenticated action timeout:** apply existing native `CHECK` (if legal) or `FOLD` transitions; permit ordinary proved settlement. A timeout does not modify the underlying cards.
- **Post-betting missing/invalid shares or card proofs:** freeze immediately on objective authenticated failure/deadline evidence. Permit bounded replacement submission of genuinely valid proofs during challenge/review/appeal. No subjective decision may choose a winner. If no verifiable terminal evidence can be produced, transition deterministically to `VOID_UNPROVABLE` and restore original locked seat balances; flag the hand as aborted and consumed. Do not use the interim post-betting stack vector as a refund.
- **Economic abuse boundary:** refunds after bets can incentivize selective share withholding. Production release requires collateral/stake-backed provable provider accountability, objective slash conditions, and analysis of collusion and griefing. Such penalties are **not yet implemented** in PR #743, so production permission remains blocked even if refund liveness is achieved. Do not pretend void = fair payout.
- **Dispute appeal:** one bounded appeal may submit corrected cryptographic evidence; only an unchanged, reverified canonical result may settle. Appeals cannot indefinitely extend escrow; evidence hashes alone do not change the result.

### 3.2 Required state-machine predicates

Define hand-specific deadlines on-chain; use block time bounds and evidence freshness/nonces. Distinguish `NOT_YET_DUE`, `PROOF_MISSING`, `PROOF_INVALID`, `RECOVERY_PROOF_ACCEPTED`, `PROVED_TERMINAL`, `VOID_PRE_BET`, `VOID_UNPROVABLE`, `SETTLED`. After `SETTLED` or `VOID_*`, every mutation must revert replay. `PokerActionDisputeClock420`, `PokerNLHEBetting420`, `PokerLiveCardReveals420`, `PokerCanonicalSettlement420` and `PokerSeatLedger420` must share the exact hand and state-root identities. Native and legacy canonical settlement mechanisms must not independently consume the same hand. Permissionless termination is allowed only after the objectively provable deadline and final challenge period. The escrow ledger's `cancelReservedHand` must be invoked by its **governance-bound** coordinator, never directly by an untrusted challenger.

### 3.3 Mandatory adversarial cases

Missing either provider share on flop/turn/river/showdown; malformed/mismatched ciphertext; forged provider PK; proof replay on another street, hand, seat or deck; simultaneous settlement vs timeout; cancellation after proved settlement; double cancellation; side-pot and rake conservation; locked-seat alteration; hostile token callbacks during refunds and rake; one-sided and colluding provider withholding; review/appeal exhaustion; timestamp boundaries; no externally authorized payout insertion.

## 4. Proof dependency and authority graph

```text
Authorized table + immutable ruleset/config + funded ledger reservation
  -> two provider commitments and accepted initial-deck Groth16 proof
  -> stage A real 52-card shuffle/re-encryption Groth16 proof
  -> stage B real 52-card shuffle/re-encryption Groth16 proof
  -> final encrypted deck root + pinned aggregate threshold key
  -> canonical hand/button/seat assignment commitment
  -> for each participating seat (2 positions x 2 providers):
       bound verified ciphertext membership + provider share-encryption ZK proof
  -> recipient-key possession + exact-envelope acknowledgments
  -> engine start / signed actions / deterministic timeout
  -> selective authenticated partial share proofs + card-unmask proofs at permitted streets
  -> native ranking + side-pots + immutable rake + final payout computation
  -> bounded dispute resolution (if challenged)
  -> one atomic replay-protected ledger settlement
     OR objectively triggered one-time original-snapshot void
```

## 5. Production proof pins

Each proof family must have: frozen circuit source hash; dependency versions; audited constraint-system/VK digest; setup/ceremony provenance; public-input order and field normalization; generated Solidity runtime hash; immutable `PokerVerifierVersions420` version; threshold/provider key identities; positive real witness and negative tamper fixtures; no mock/test verifiers reachable from funded configuration. Production contract must reject absent/mismatched pin and verifier code replacement. A test-only generated verifier has **no production clearance** until this condition and independent audit are satisfied.

## 6. Current repository gap/ownership matrix

| Requirement | Current owner | Current state | Required engineering step |
|---|---|---|---|
| Final shuffled authenticated root | `PokerPrivateShuffleGate420` + gnark shuffle | Existing proof-path, prior successful evidence | Reuse, validate final-deck-root provenance |
| 52-card ciphertext membership | `ciphertext_merkle.go` | Present | Reuse exact MiMC scheme |
| Provider partial decryption | `PartialDecryptCircuit` | Present for public reveal | Extend private encrypted-share proof, not public share |
| Recipient encryption key | `PokerRecipientKeys420` | Fingerprint-only | Actual proof-compatible public point + key-possession attestation |
| Private recipient share delivery | `PokerDeckDisclosure420` | Hash/acknowledgment-only | Genuine 2-of-2 recipient proof verifier and adapter |
| Hole-card assignment | `PokerLiveCardReveals420._dealSeat` | Post-start logic | Commit immutable assignment **before** delivery |
| Hand start | `PokerNLHEBetting420.start` | Checks acknowledgments | Require full real-proof completion |
| Deadline/appeal | `PokerActionDisputeClock420` | Partial | Authentic evidence + bounded deterministic resolution |
| Funded settlement | `PokerSeatLedger420` / native engine | Replay-protected ledger paths | Integrate unique terminal recovered/settled outcome |
| Production verifier pins | `PokerVerifierVersions420` | Registry functionality present | Generated production artifacts, manifest + external review |
| Scoped static security | 5A.4 Slither owner | Outstanding High/Medium findings | Evidence-backed dispositions, no blanket bypass |

## 7. Phase A exit checks and qualification ownership

- Verify normative key-switching equations against existing ElGamal ciphertext construction and current circuit group parameters.
- Check the physical card layout against `PokerLiveCardReveals420` and reject a post-start derived button as proof of pre-start assignment.
- Confirm every transition is tied to funded ledger lock and immutable hand identity.
- Validate there is no false claim that delivery receipt, simulated proof, static analysis waiver, or internal fixture equals production soundness.
- Level 1 owner for **documentation-only architecture**: scoped spec consistency review and changed-file verification. No global Solidity/Genesis/Docs tests. Do not label circuit implementations or recovery integration PASS from this document.
- Level 2: deferred until cryptographic circuit + Solidity integration milestones converge.
- Level 3: **not authorized** until production artifacts, external review, qualified integration and main reconciliation complete.

## 8. Explicit unresolved assumptions / independent review

This architecture selects threshold-share encryption to recipients, not unproven direct recipient-key reencryption. Still requires independent verification of subgroup security, recipient key-authentication protocol, commitment encoding, MiMC collision assumptions, encrypted-share confidentiality/non-malleability, shared-randomness abuse, provider collusion, availability/slashing economics, key management, and setup ceremony. Key registration must not accept merely self-asserted possession. Real production artifacts require separate review before deploy or funded play.

**Phase A status:** architecture decision recorded. Formal Level 1 qualification is not a substitute for these unimplemented on-chain changes.


## 9. Frozen recovery clock parameters and invariant checks

For the V1 implementation, a missing required proof becomes challengeable only when its canonical `dueAt` passes. `dueAt` is the earlier of (i) the corresponding hand/street proof-delivery deadline and (ii) the protocol's global bounded deadline; both are committed before betting. The required terminal periods are: **1 hour for late evidence after the first objective failure**, **1 day of review**, and **a single 1 day appeal extension**, using the existing `PokerActionDisputeClock420.REVIEW_WINDOW` constant. All elapsed-period tests are strict and specify whether the deadline instant itself is accepted. No further extensions or discretionary pauses are authorized. The execution layer must reject any overflow in timestamp arithmetic, prohibit `dueAt=0`, and implement terminal abort liveness when a provider disappears permanently.

At no point may the engine call `cancelReservedHand` for an already settled hand, and at no point may it pay a terminal winner without fully verified outcome evidence. The original locked seat snapshot remains the only permissible void-refund vector, regardless of wagers already posted. Any provider collateral slash must use a **separate, fully funded and independently qualified collateral vault**; absent that vault, slashing cannot be claimed or simulated. Provider accountability/collateral availability remains a production admission prerequisite, not an implicit side effect of refunds.

### Architecture review result against current code

- **CONSISTENT:** `Reencrypt52` defines `(rG,M+rPK)`; new encrypted-share equations correspond to its same group and ciphertext semantics.
- **CONSISTENT:** `ciphertext_merkle.go` fixes a 52-of-64 tree with six MiMC levels and physical-position leaf binding.
- **CONSISTENT:** `PokerLiveCardReveals420` maps positions `0..2n-1` to round-robin seat indices and uses the stated burn/board positions.
- **IMPLEMENTATION GAP:** `PokerNLHEBetting420.start` currently chooses button after testing acknowledgments, so the pre-start canonical assignment must be introduced rather than presumed to exist.
- **IMPLEMENTATION GAP:** `PokerRecipientKeys420` stores a fingerprint only; it cannot authenticate a curve point or knowledge of a recipient decryption key.
- **IMPLEMENTATION GAP:** `PokerDeckDisclosure420` accepts unproven envelopes and receipts; the true encrypted-share proof is not present.
- **IMPLEMENTATION GAP:** `PokerActionDisputeClock420` and native settlement do not yet implement all failed-share terminal void transitions.
- **EXTERNAL GATE:** cryptographic assumptions, key-subgroup constraints, censorship/availability economics and setup provenance require independent assessment before production.

**Phase A Level 1 verdict:** This document defines a concrete proposed security architecture and identifies all observed contract-design conflicts. It is **not a formally qualified Phase A PASS** until the repository's canonical audit roadmap/exit criteria are reconciled against this design, the finite-state model and public-input encoding are reviewed as a coherent invariant set, and the architecture is formally accepted by the applicable owners. Do not treat the document commit itself as a qualification certificate.

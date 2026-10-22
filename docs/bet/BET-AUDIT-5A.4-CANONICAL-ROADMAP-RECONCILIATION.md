# BET-AUDIT-5A.4 — Canonical roadmap reconciliation and frozen proof interfaces

**Authority inspected:** `docs/bet/BET-AUDIT-5A.1-POKER-ARCHITECTURE.md` on current `main`, `docs/bet/BET-AUDIT-5A.3-LEVEL1-QUALIFICATION.md`, `docs/420BET-TESTNET-WORK-ROADMAP.md`, current source and tests on PR #743. This contract is an implementation-specific elaboration, not a renumbering or replacement of canonical BET-AUDIT-5A.4. **Development branch is draft/unmerged.** No production wager permission is conferred.

## Canonical 5A.1 and 5A.3 requirements carried forward, unchanged

| Original requirement | 5A.4 implementation authority | Hard gate |
|---|---|---|
| Exactly 52 authenticated, distinct encrypted cards | `InitialDeck52` and `Reencrypt52` real gnark circuits; `PokerPrivateShuffleGate420` | Real proof verified against final, hand-bound root |
| Private two-card delivery for 2–9 seats | `PokerNLHEBetting420.prepareDealAssignment`, `PokerDeliveryProofBook420` | Exactly 2 positions x 2 independent providers per seat |
| No controller/dealer discretionary outcome | Native NLHE, `PokerNativeOutcome420`, `PokerSeatLedger420` | Canonical provable settlement only |
| Single writer and chip conservation | Governed immutable ledger coordinator, replay flag and funds lock | Original snapshot refund or fully proved payout, never caller-selected vector |
| Replay and signed-action authority | `PokerActionKeys420`, hand-scoped commitments, fixed public-input schemas | Cross-hand/position/seat/provider/root/epoch proof replays fail |
| Withheld-key recovery, bounded disputes | `PokerActionDisputeClock420`, native missing-proof recovery | Objective deadline, bounded review, no perpetual lock |
| No production permissions from local fixtures | Canonical 5A.1 / testnet roadmap | Independent review, official testnet and risk/legal approval still required |

The successful 5A.3 seating evidence at `9884dbfd5fb28a4b44e0e538fefd381f2d3258ce` remains a historical qualification, not an exact-SHA certificate for 5A.4 changes. Previously successful 5A.4 Level 1 run `39351176585` and Cross-Game Level 2 `39351176426` remain evidence for `50f662efe92537b807f138f40a3871b01b0e84eb`, not for later executable changes.

## Frozen public-input order and proof families (V1)

All public values are BN254 `Fr` elements in canonical range. Scope/context values derive from domain-separated EVM commitments reduced modulo `Fr`, and are validated by the corresponding on-chain adapter before the Groth16 verification call.

### RecipientKeyPossessionV1 — exactly three public fields

0. Recipient key-scope commitment `keccak256(KEY_SCOPE_DOMAIN, chainId, recipientKeyRegistryAddress, tableId, player, seatingEpoch) % Fr`
1. Recipient public key X
2. Recipient public key Y

Private witness: recipient secret scalar `t`. Relation: `Q=tG`; public points on curve, nonidentity. `PokerGnarkRecipientKeyPoPAdapter420` verifies exact arity and pinned VK; `PokerRecipientKeys420.bindVerifiedKey` requires seat ownership and registers `Q` for that epoch.

### ThresholdKeyAggregateV1 — exactly seven public fields

0. Aggregate proof scope `keccak256(AGGREGATE_CONTEXT_DOMAIN, chainId, proofBookAddress, shuffleAddress, providerAdapterA, providerAdapterB, six key coordinates) % Fr`
1–2. Provider A public-key X,Y
3–4. Provider B public-key X,Y
5–6. Aggregate threshold public-key X,Y

Curve relation `P_A + P_B = P` with on-curve/nonidentity constraints. The adapter pins the aggregate key hash to the shuffle's threshold key; the proof book pins both independent provider key commitments. No delivery proof can be accepted before this relation is proven.

### EncryptedShareDeliveryV1 — exactly eighteen public fields

0. Hand scope `uint256(handId)%Fr`
1. Final authenticated deck root
2. Physical deck position, 0..51
3. Recipient seat, 0..8
4. Provider identity, 0 or 1
5. Delivery context `keccak256(DELIVERY_CONTEXT_DOMAIN, chainId, proofBookAddress, handId, position, seat, provider, finalRoot, recipientFingerprint, seatingEpoch, twelve public point coordinates)%Fr`
6–7. Source ElGamal `C1.x,C1.y`
8–9. Source ElGamal `C2.x,C2.y`
10–11. Registered provider public-key `P_i.x,P_i.y`
12–13. Proven recipient public-key `Q.x,Q.y`
14–15. Encrypted share `U.x,U.y`
16–17. Encrypted share `V.x,V.y`

Private witness: provider secret scalar `s_i`, ephemeral nonzero encryption nonce `k`, six-level authenticated ciphertext Merkle path. Relations: `P_i=s_iG`, `D_i=s_iC1`, `U=kG`, `V=D_i+kQ`, and authenticated membership in `finalRoot` using the unchanged six-level MiMC ciphertext tree and physical position. The public proof reveals neither `D_i`, `s_i`, `k` nor plaintext card.

The recipient decrypts each verified `(U_i,V_i)` as `D_i=V_i-tU_i`, then reconstructs `M=C2-D_A-D_B`. The transcript never authorizes a single-provider public decryption. Off-chain point transport is authenticated by the canonical envelope digest, which includes both providers' encrypted shares for both recipient positions, seat, hand, registered key fingerprint and epoch. A key change invalidates all prior ciphertexts; no old proof may be rebound by changing envelope metadata.

## Canonical deterministic seat assignment

For `n=popcount(mask)` participating seats, positions `[0,2n)` are dealt round-robin from the button (heads-up) or first occupied seat left of button (three-plus). Position `j` and `j+n` belong to the same player. `prepareDealAssignment` freezes button and occupied mask against the actual funded hand/epoch/snapshot **before** proof submission; `start` recomputes and checks the frozen button. Burn/flop/turn/river order remains exactly that of `PokerLiveCardReveals420`.

## Native recovery transition model and time windows

- **Prebet invalid/missing commitments, shuffle or delivery:** permissionless original-snapshot void after `handDeadline + 1 hour`; betting never starts and rake is zero.
- **During betting:** authenticated action timeout continues existing deterministic CHECK/FOLD transitions.
- **Required postbet reveal missing:** `evidenceDueAt=phase-transition-time+1 hour`; objective missing proof permits a recovery state only after that deadline.
- **Review/appeal:** `2 days + 1 hour` from recorded recovery opening, with a verified correction/settlement opportunity; an independently opened dispute cannot hold funds longer than its own bounded closeout and must be finalized by its pre-bound native resolver.
- **Finality:** fully proved native payout or exactly original escrow snapshot restored with a consumed hand; no privileged arbitrary balances, no double-close.
- **Refund economics:** postbet refunds can be strategically induced by noncooperating providers; they provide custody liveness, **not** an anti-collusion fairness guarantee.

The abstract bounded checker is `scripts/verify-420bet-poker-5a-4-state-model.py`. It explores an 8-share heads-up model and preserves terminal exclusivity and original refunds. This is formal *model* coverage, **not** a mechanized proof that Solidity behavior is equivalent for all 2–9-seat configurations; that equivalence requires further formal verification or independent review. Corresponding funded-contract tests must also pass.

## Independent assumptions and provider-accountability acceptance

**Assumptions requiring independent review:** BN254 BabyJubJub subgroup and base parameters; scalar range; MiMC input encoding and Merkle proof binding; ElGamal IND-CPA and ephemeral randomness quality; aggregate/provider key noncollusion; recipient key custody; proof-system setup ceremony provenance, trusted setup, and circuit soundness; private share transport authenticity; ability of provider addresses to remain independently controlled; chain censorship/timing; slash dispute evidence and censorship resistance; availability of at least two providers and legal/regulatory operator approval.

**Provider accountability model for independent approval:** every funded hand must bind two independently controlled providers with separately provisioned proof-generating keys, immutable expiry windows, objectively attributable missing-share/invalid-proof events, and collateral sufficient to cover independently risk-approved worst-case incentivized selective withholding. Slashing must not be triggered by an unauthenticated accusation and must not seize user seat escrow; any collateral pot must be segregated with replay-protected arbitration, challenge, and payout policy. Signed independent risk/governance approval must specify collateral-denomination, cap per hand, concurrent exposure, collusion threshold, provider rotation, and censorship outage fallback.

The repository **does not yet have an independently approved production provider collateral and governance record**. This is a **release block** and cannot be self-approved by implementation authors, scripted signatures or a document. The accepted *architectural requirement* is frozen here; actual independent signoff is an external authority/testnet item under `docs/420BET-TESTNET-WORK-ROADMAP.md`.

## Qualification mapping and explicit restrictions

- **Level 1** scoped cryptography: actual gnark prover/verifier, actual generated Solidity proof verification, actual registry-pinned adapter acceptance, funded NLHE authorization/recovery integration, negative/replay/malformed/missing-proof tests, bounded model checker and scoped Slither.
- **Level 2** only at the combined milestone, including full recipient delivery, production-pinned configurations, untrusted-provider adversarial scenarios and funded ledger conservation.
- **Level 3** deferred until one frozen merge candidate reconciles with current main and all mandatory workflow/preflight and independent criteria pass.
- **No mock substitution:** Solidity behavioral integration tests explicitly mark test-only generated-verifier backends; the real cryptographic proof owner separately executes actual generated Groth16 Solidity verifiers/adapters. Neither independently proves complete funded production integration.
- **No production approval:** generated `EXPERIMENTAL-` trusted-setup artifacts are not an independently certified setup, circuit audit or official-testnet proof. Production permissions must remain disabled.

**Phase A reconciliation result:** architecture decisions and exact public-input schemas fixed for implementation. Formal independent acceptance and fully passing exact-SHA end-to-end crypto/recovery security are still mandatory gates, not inferred from this file.

# BET-AUDIT-5A.4 — Confidential-deal implementation and outstanding cryptographic security gates

## Scope implemented

`PokerConfidentialDeal420` introduces a **non-custodial, commitment-only** multiplayer poker dealing envelope. The contract binds prospective hands to chain, verifying-contract address, table configuration/version/ruleset, prior state, monotonic nonce, seat epoch and declared seat mask. It enforces two distinct predefined provider identities with separate table-scoped capabilities, permissioned hand start, active operator and table checks, the `POKER_NEW_HANDS` emergency gate, replay rejection, immutable commitments and a permissionless timeout path. It never accepts card identities, plaintext shuffle seeds, decryption keys or hole-card packets as call arguments, and never exposes them in storage, getters or events. It never transfers chips, settles or declares a playable hand.

## Security boundary — not yet satisfied by this envelope

A pair of hash commitments **does not establish secure shuffling, unbiased permutation, privately delivered hole cards, recipient confidentiality, card uniqueness, secrecy against dealer collusion, or verifiable selective revelations**. Distinct addresses alone are not independent beneficial ownership or separated key custody. The deliberately restricted `COMMITTED` state means *commitments registered*, not `DEALT`, not usable card values and not authorized gameplay.

To complete 5A.4 with substantive confidential-deal assurance, a separate cryptographic implementation and targeted security tests must establish all of the following **locally wherever possible**, without deferring executable work to testnet:
1. A published and independently reviewable protocol using cryptographically authenticated private delivery (prefer verifiable multi-party shuffle plus zero-knowledge permutation proofs, or formally reviewed threshold-encryption/key-release protocol); secrecy must not depend on withholding data already public on-chain.
2. Proofs bind exactly 52 unique cards, table/chain/version, finalized seat snapshot, recipient and per-card domain, deck root and hand nonce; card ownership/visibility follows street progression and authorized showdown.
3. Independently verifiable commitments for the entire deck, ciphertexts and player-specific encrypted hole-card receipts; no plaintext cards in logs, transactions, events, APIs or accessible calldata; no server-side keeper able to unilaterally fabricate outcomes.
4. Adversarial tests for provider/front-runner collusion, selective abort, duplicate cards, altered ciphertext, wrong-player decryption, stolen/revoked keys, withheld shares, equivocation, out-of-order street reveal and cross-hand/table/network replay.
5. Bounded confidential recovery, dispute transcripts, audit commitments, challenge and finality gates, and safe recovery without secret disclosure or unilateral operator payout.
6. A strict consumer interface denying all hand-engine, pot and payout authority until cryptographic acceptance, seat locking and independent policy approval are satisfied. Current 5A.3 `reservedInHand` is not activated by this component.

These are **local implementation gaps**, not merely production/testnet acceptance. No release authorization is implied by local commitment tests. Official network receipts, independent provider/key-custody certification, funded real settlement and legal/operator approval remain tracked under `docs/420BET-TESTNET-WORK-ROADMAP.md`.

**Disposition:** The commitment-envelope subcomponent can receive narrowly scoped Level 1 evidence, but **the complete 5A.4 step must remain OPEN** until the cryptographic shuffle/deal/hidden-card verification requirements above are implemented and qualified. Preserve the 5A.1–5A.3 evidence and prohibit accidental advancement to 5A.5 or Level 3.

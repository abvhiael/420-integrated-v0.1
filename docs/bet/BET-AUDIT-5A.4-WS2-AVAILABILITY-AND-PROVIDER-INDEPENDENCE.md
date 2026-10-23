# BET-AUDIT-5A.4 Workstream 2 — ciphertext availability and provider independence

## Enforcement

A shuffle stage is rejected unless the authenticated initial deck is certified, both operators have valid independently reviewed controller attestations, both complete 52-card ciphertext lists are available and match the canonical MiMC commitment on-chain, and the actual generated Reencrypt52 Groth16 verifier accepts the hand-, stage-, root-, threshold-key-, and transcript-bound proof.

The PokerShuffleCiphertextAvailability420 contract publishes all 208 affine field coordinates for each 52-card encrypted deck in both calldata and CiphertextDeckPublished logs, computes the same 52-of-64 padded six-level domain-separated MiMC Merkle tree as the gnark circuit, and rejects noncanonical inputs. Its 110 MiMC round constants are pinned to the actual gnark-crypto-derived Keccak digest 0x0ccfd8dfcda1a0713073bdce261f0321511e4d8f43d479899d398f64123ed3f8. The gate checks both roots against a recorded publication before calling the genuine proof verifier. Provider B's input must be the previously accepted Provider A output.

The ciphertext coordinates are public, but plaintext card values, provider permutations, and rerandomization witnesses are never emitted. Public archival indexing and redundant full node access are required for usable ciphertext availability after chain-history pruning. Missing history is a live-system DA incident even when a historical publication was once valid.

## Independent-control evidence requirements

Different EVM addresses do not establish provider independence. Admission is based on the PokerShuffleProviderIndependence420 registry, requiring a primary attestor and a separate independent reviewer, each with its own governance-controlled address. Each must publish a nonzero evidence hash, the same canonical controller identifier for a given provider, and an unexpired attestation. The controllers for Providers A and B must differ. Revocation or expiry by either issuer blocks subsequent shuffle submissions.

Production attestations MUST point to independently retrievable signed and content-addressed operator dossiers whose bytes verify against the corresponding evidence hash. Both reviewers must examine beneficial owners, corporate group control, shared officers and service contracts, signing authority, hardware custody, network/control-plane administration, randomness generation, and related-party/conflict-of-interest disclosures. Their evidence must name the reviewer, review date, expiry, methodology, sources, canonical controller identifier, normalized identity policy, and signatures. Neither issuer may accept a self-asserted controller identifier without independent verification.

Reviewers must share a canonical, independently maintained controller registry and consistent identity normalization. Reusing a different salt or identifier for the same beneficial controller to evade separation is prohibited. Dossiers require a public content-addressed discovery record or equivalent external audit index, accessible to unaffiliated parties. Evidence that cannot be independently retrieved or verified must not be used for real-money operator onboarding. The test suite uses synthetic identities and evidence hashes, not live operator certification.

## Honest-provider and collusion assumptions

Privacy requires **at least one independently controlled honest provider** whose private permutation and encryption randomness are not disclosed to the other. If both providers collude, they may reconstruct the final permutation despite perfectly valid Groth16 proofs. Two registry approvals prove only that two authorized reviewer addresses recorded the required attestations, not that the reviewers or providers are incorruptible. Residual risks include hidden shared ownership, coerced disclosures, shared HSMs, side channels, off-chain collusion, malicious auditors, chain data retention failures, governance capture, and compromised trusted setup.

Eligibility is re-evaluated at both shuffle stages. If either reviewer revokes authorization after stage one, stage two fails closed and existing deterministic hand recovery and provider accountability processes must resolve the stalled hand. No unreviewed replacement operator, bypassed verifier, or replayed proof is permissible.

## Reproducible qualification provenance

The dedicated exact-SHA Workstream 2 Level 1 owner inherits unchanged canonical InitialDeck52 genuine proof evidence from SHA 4f16aa1c9e5c08c4327990ba6d381ef09c2885c5 (run 39982033941). For unchanged Go proving inputs it inherits two-stage genuine Reencrypt52 A/B proof evidence from SHA 752712b74306d2f2ce5670edea130dbede7c5f37 (run 39998191650, job 120567115740). Its own generated Foundry acceptance exercises the actual initial-deck Solidity verifier, actual pinned shuffle verifier, Provider A then Provider B, the full native-compatible ciphertext publication, mismatched roots, malformed field inputs, proof substitution, transcript conflicts, replay and provider-control conflicts. Complete exact-SHA Level 1, Level 2 and static qualification is required before merge.

The current Groth16 verifying keys and proofs are generated for a **test ceremony** and are not production-trusted setup. Independent cryptographic audit, trusted setup, actual third-party operator dossiers and a production-equivalent chain qualification remain separate pre-mainnet obligations. They are not waived by this development milestone and must remain fail-closed for live funds.

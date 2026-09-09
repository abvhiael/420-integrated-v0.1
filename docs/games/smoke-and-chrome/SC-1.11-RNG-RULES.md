# Smoke & Chrome — SC-1.11 Canonical RNG Rules

Status: FROZEN for V1 ruleset
Phase: SC-1.11
Depends on: SC-0, SC-1.1 through SC-1.10

## Purpose

SC-1.11 defines the canonical randomness model for Smoke & Chrome V1. Randomness must be deterministic under replay, auditable in competitive play, independent from wallet ownership, and isolated from UI/runtime nondeterminism.

The match engine MUST never use ambient platform randomness such as Math.random(), wall-clock timing, process entropy, client-local RNG, wallet addresses, transaction ordering, block timestamps, or rendering state as gameplay entropy.

## 1. Match RNG state

Every match owns one canonical RNG context:

- rngAlgorithmId
- rngVersion
- matchSeed
- rngCounter

The engine MUST derive every random output from this context.

The canonical V1 generator interface is deterministic:

`R_n = RNG(rngAlgorithmId, rngVersion, matchSeed, n, domainTag)`

where `n` is the monotonically increasing RNG counter and `domainTag` identifies the semantic random operation.

The concrete cryptographic primitive may be upgraded later, but algorithm/version identifiers are part of the authoritative match manifest and replay record.

## 2. Seed construction

The match seed MUST be established before the first random gameplay decision.

For local/offline and bot play, the host may supply a seed directly.

For authoritative online play, the seed SHOULD be derived from independent participant/server contributions so no single participant can unilaterally choose the final seed after observing the other inputs.

Recommended derivation:

`matchSeed = H(protocolVersion || matchId || serverCommitment || playerAContribution || playerBContribution || rulesetHash)`

Any missing/timeout contribution MUST be handled by a deterministic protocol rule and recorded in the match manifest.

The raw seed need not be publicly disclosed before hidden-information risks are over, but the server MUST retain enough commitment/reveal evidence to audit the match afterward.

## 3. Randomness provider boundary

Core gameplay randomness is an engine concern, not an on-chain hot-path dependency.

Smoke & Chrome MAY use the provider-neutral 420Randomness protocol or another approved provider to attest, commit, or derive competitive seeds, but a running match MUST NOT wait for per-action blockchain confirmations.

Any external randomness integration MUST resolve into the same canonical `matchSeed + rngCounter + domainTag` engine interface.

Provider choice MUST NOT change gameplay semantics for the same canonical seed.

## 4. Counter consumption

Every authoritative random operation consumes exactly one RNG counter value unless the operation specification explicitly defines a fixed multi-draw sequence.

The engine MUST increment the counter in one deterministic location only.

Failed validation MUST NOT consume RNG.

Random operations that are prevented before execution MUST NOT consume RNG.

Once an operation begins its authoritative random draw, the counter consumption remains part of the replay even if the resulting effect later fizzles for another reason.

## 5. Domain separation

Each random operation MUST use a stable domain tag.

Examples:

- `deck.shuffle.initial`
- `deck.shuffle.effect`
- `target.random.operatives`
- `discard.random.hand`
- `district.random`
- `coinflip.effect`
- `bot.tie-break`

Different operation classes MUST NOT reuse raw random outputs without domain separation.

Card definitions may reference approved random operation identifiers; they MUST NOT provide arbitrary executable RNG code.

## 6. Canonical shuffle

All deck shuffles MUST use one canonical deterministic shuffle algorithm defined by the engine version.

V1 requires an unbiased Fisher–Yates-style permutation using canonical bounded-integer sampling.

The initial deck order MUST be canonicalized from the validated deck manifest before shuffling so edition/printing metadata, input insertion order, filesystem order, object-map enumeration, or wallet ownership cannot affect shuffle results.

Canonical pre-shuffle ordering is by stable CardDefinition/deck-entry identity and deterministic copy ordinal.

A shuffle event MUST record:

- zone/deck identifier
- pre-shuffle state hash
- post-shuffle state hash
- RNG counter range consumed
- shuffle algorithm/version

Hidden card order MUST remain hidden from unauthorized viewers even though its commitment/hash may be public.

## 7. Uniform bounded selection

Random selection from N eligible objects MUST be uniform across the exact deterministic eligible set.

Modulo bias MUST NOT be introduced by simply calculating `randomWord % N` unless the generator primitive formally guarantees unbiased bounded output.

Use rejection sampling or another documented unbiased mapping.

Eligible-object ordering MUST be canonical before indexing.

Recommended ordering is stable object instance ID ascending unless the operation explicitly defines another deterministic order.

## 8. Random target selection

For effects such as “choose a random enemy Operative”:

1. build the legal candidate set using normal rules;
2. canonicalize candidate order;
3. if zero candidates exist, resolve according to the effect’s no-target semantics without consuming RNG unless the random operation has already begun;
4. draw one canonical bounded index;
5. select that candidate;
6. record candidate-set hash, counter, and selected instance ID.

The UI MUST NOT determine candidate ordering.

## 9. Random discard

Random discard from a hand follows the same candidate-set rules.

The owner’s hidden hand identities remain private to unauthorized viewers, but the authoritative replay stores the exact selection and a verifiable hidden-state commitment.

Public match logs disclose only information that becomes public under the game rules.

## 10. Random District and lane selection

District and Street randomization MUST use their canonical logical IDs from SC-1.2, never screen coordinates or display ordering.

Changing the visual layout MUST NOT change RNG results.

## 11. Multiple random results

Effects requesting multiple distinct random selections MUST define whether they are:

- without replacement; or
- with replacement.

The default for selecting multiple distinct game objects is **without replacement** unless the card definition explicitly says otherwise.

Each draw consumes deterministic RNG counter values in sequence.

The evolving candidate set after each selection MUST be canonicalized deterministically.

## 12. Randomized hidden information

Shuffles and hidden random selections require commitment integrity without leaking hidden information.

The authoritative state SHOULD maintain cryptographic commitments/hashes to hidden zones sufficient to prove that later reveals are consistent with the previously committed state.

Replay exports for players/spectators may redact hidden values while retaining commitment evidence.

A full adjudication replay may contain privileged hidden information under access control.

## 13. Mulligans

Any shuffle caused by mulligan or opening-hand replacement uses the canonical shuffle interface and consumes the documented RNG sequence.

The mulligan protocol MUST NOT allow a client to request repeated reshuffles outside the rules-defined mulligan procedure.

## 14. Procedural randomness versus decisions

Player decisions MUST never be resolved with RNG merely for convenience unless the rules explicitly define random resolution.

Timeout behavior defined in other SC-1 rules remains deterministic and MUST NOT silently substitute random legal actions.

## 15. Bot randomness

Bots may use the canonical RNG service for gameplay-random effects and for explicitly declared AI tie-break randomness.

AI decision randomness MUST use separate domain tags from rules-engine randomness so bot policy changes do not perturb card/shuffle outcomes.

For competitive human matches, bot-policy RNG is irrelevant unless an authorized bot occupies a player seat.

## 16. Replay requirements

An authoritative replay MUST be able to reproduce every random result using:

- ruleset hash/version
- RNG algorithm/version
- match seed or privileged seed material
- deterministic action log
- RNG counter sequence
- domain tags

A replay that produces different random results from the same canonical inputs is invalid.

The engine SHOULD emit periodic state hashes and RNG-counter checkpoints for divergence detection.

## 17. Auditability

Competitive matches SHOULD expose or retain a seed commitment before play and reveal/verification data after the match when safe.

Audit evidence SHOULD allow an authorized verifier to confirm:

- the seed matched its prior commitment;
- the same seed generates the recorded random sequence;
- no RNG draws were skipped, inserted, reordered, or client-selected;
- candidate sets match the authoritative game state.

## 18. Disconnect and reconnect

Disconnecting or reconnecting MUST NOT reseed the RNG.

The authoritative RNG counter is part of server match state.

Clients MUST never infer future authoritative RNG values from local reconnection state.

## 19. Concurrency

Random operations resolve according to the canonical action/Stack order defined in SC-1.3 and SC-1.6.

Two simultaneous-looking UI animations do not imply concurrent RNG consumption.

The authoritative engine serializes all RNG draws into one deterministic counter sequence.

## 20. Wallet and blockchain neutrality

Wallet address, wallet balance, collectible ownership, card edition, printing serial, NFT token ID, transaction hash, validator identity, gas price, block timestamp, block hash, or $420 balance MUST NOT alter a gameplay RNG result unless an explicitly approved external randomness protocol contributes to the pre-match seed under rules identical for all participants.

Even then, wallet wealth/asset holdings MUST NOT influence probability.

## 21. No collectible luck advantage

Different printings of the same CardDefinition MUST have identical random behavior and probabilities.

Foils, founders editions, serial-numbered cards, alternate art, provenance, rarity presentation, wallet-linked cosmetics, and prestige attributes MUST NOT modify draw odds, shuffle placement, random-target weighting, harvest randomness, or any other competitive probability.

## 22. Randomness in cultivation/combat

Baseline SC-1 cultivation and combat rules are deterministic unless a CardDefinition explicitly invokes an approved RNG operation.

There is no hidden ambient chance-to-hit, crit roll, random harvest yield, random District ownership, or random growth failure in baseline V1.

This keeps core strategic systems inspectable and reserves randomness for explicit card/effect design.

## 23. Failure handling

If authoritative RNG state is unavailable, corrupted, counter-desynchronized, or fails integrity verification, the engine MUST fail closed for ranked/competitive play.

It MUST NOT silently reseed or fall back to platform randomness.

Casual/offline modes may terminate and surface a deterministic engine error rather than fabricate a new seed.

## 24. Canonical reason/error codes

Suggested V1 identifiers:

- `SC_RNG_STATE_MISSING`
- `SC_RNG_VERSION_UNSUPPORTED`
- `SC_RNG_COUNTER_MISMATCH`
- `SC_RNG_SEED_COMMITMENT_INVALID`
- `SC_RNG_CANDIDATE_SET_INVALID`
- `SC_RNG_DOMAIN_UNKNOWN`
- `SC_RNG_REPLAY_DIVERGENCE`

## 25. SC-1.11 invariants

**SC-INV-RNG-001 — Deterministic replay**  
Identical canonical seed, ruleset, actions, and engine version produce identical RNG outputs and final state.

**SC-INV-RNG-002 — Single authoritative sequence**  
Every gameplay random draw belongs to one monotonically ordered authoritative RNG sequence.

**SC-INV-RNG-003 — No ambient entropy**  
Gameplay outcomes never depend on runtime/client/UI/platform randomness.

**SC-INV-RNG-004 — Unbiased selection**  
Bounded random selection is uniform over the deterministic legal candidate set.

**SC-INV-RNG-005 — Domain separation**  
Semantically distinct random operations use stable, distinct domain tags.

**SC-INV-RNG-006 — Hidden-state integrity**  
Random hidden-zone operations remain commitment-verifiable without leaking unauthorized hidden information.

**SC-INV-RNG-007 — Wallet neutrality**  
Wallet linkage, wealth, ownership, edition, and printing metadata never confer a probability advantage.

**SC-INV-RNG-008 — No reseed on reconnect**  
Reconnect, retry, rendering, or client restart cannot alter authoritative RNG state.

**SC-INV-RNG-009 — Failed validation does not draw**  
Actions rejected before random execution do not consume RNG state.

**SC-INV-RNG-010 — Fail closed**  
Competitive play never silently substitutes a new seed or insecure fallback randomness after RNG integrity failure.

## SC-1.11 acceptance gate

SC-1.11 is complete when:

- the seed and RNG-state model are frozen;
- canonical shuffle and bounded-selection semantics are defined;
- replay/audit requirements are explicit;
- hidden-state privacy remains compatible with verification;
- external provider/420Randomness integration has a clean pre-match boundary;
- wallet/collectible neutrality is explicit;
- the ten RNG invariants above are accepted as V1 engine requirements.

Next: SC-1.12 — V1 cross-ruleset invariants and SC-1 closeout.

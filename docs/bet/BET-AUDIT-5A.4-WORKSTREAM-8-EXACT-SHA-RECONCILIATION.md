# BET 5A.4 â€” Workstream 8 exact-SHA reconciliation and evidence register

## Candidate and source-of-truth
- Repository: `abvhiael/420-integrated-v0.1`.
- Reconciliation base: `d949b80919f5b904d8e439c18c08695655b241f3` (main at branch creation).
- Prior WS7 implemented SHA: `0bf8aede5ed1675493017d5e054f972abcede24c`, PR #785.
- Prior WS7 workflow pass: [run 40054572031](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/40054572031).
- Qualified job references:
  - 120754573959 (cryptographic-attacks: success).
  - 120754573705 (replay-and-economics: success).
  - 120757802960 (consolidated-gate: success).
- Artifact references:
  - 12545081467 (`ws7-crypto-exact-sha`).
  - 12545048458 (`ws7-native-exact-sha`).
- Prior WS6 Level 1 run 40051693801; WS6 milestone Level 2 run 40051693812. Those are inherited *historical* evidence, not new validation of this branch.

## Local ownership and qualification
The carried change is the scoped WS7 workflow; no betting, cryptography, ledger or verifier contract code is modified in this reconciliation. Re-run the WS7 consolidated Level 1 on the current branch SHA. That workflow requires the real Go cryptographic attacks, independent Node transcript/differential tests and focused Foundry funded-settlement/dispute/reentrancy suites to pass, retaining each individual failure as fatal and producing exact-head-SHA artifact checksums.

The historical WS7 run is genuinely green; its artifacts are immutable references. However, the full 5A.4 Workstream 7 threat model is broader than the selected cryptographic Go tests. No claim of independent cross-component colluding dealer, forged recipient, ciphertext substitution, key revocation or production setup closure is made solely from that run. A fully completed Workstream 8 acceptance certificate requires scenario-by-scenario evidence, verified verifier provenance and an integrated Level 2 check at the reconciled SHA.

## Merge gate (fail closed)
1. Freeze a new candidate SHA after the workflow and this document are committed.
2. Confirm exact SHA for each actual changed owner and passing relevant Level 1 reports.
3. Bind source, actual generated verifier bytecode/proving relation and inherited trusted proof fixture provenance to named job and artifacts; no mock acceptance.
4. Confirm a passing integrated security milestone Level 2 on the candidate, or explicitly record an exact immutable inheritance with a complete source-diff rationale.
5. Confirm required scenario-level attack rejections and genuine valid-game acceptance. Missing evidence blocks final certification.
6. Recheck the branch against current main and merge by expected head SHA only if the approved checks still describe the reconciled contents.
7. Preserve the final merge SHA and complete CI run/job/artifact links. Never relabel the older source SHA as the merge SHA.

## Disposition
Evidence recorded; candidate validation and final exit acceptance remain **OPEN** until the new exact-SHA checks and omitted security scenarios are established. This document is not a passing certificate and grants no new privileged authority.


## Production-equivalent funded integration owner

`BetPokerWS8ProductionFixture54.sol` now deploys the production table, seat ledger,
confidential deal, initial-deck gate, two-stage shuffle, ciphertext availability,
provider independence registry, recipient-key registry, encrypted delivery book,
action keys, native betting engine, live reveals, canonical rake and independent
native outcome calculator. Actual current-seat secp256k1 keys authorize actions.
The native engine exclusively reserves 800 player chips and locks two separately
funded 800-chip provider bonds. The same callback-capable, exactly accounted token
backs the legitimate game and adversarial settlement callback.

Seven actual generated Groth16 verifiers are registered by hashes of their real
serialized VKs, compiled relation identities and actual deployed runtime code.
The archives from WS2 run 40003702620 and WS3 run 40013195917 were downloaded and
matched their GitHub-recorded SHA-256 digests. Their 14 public statements are
preserved in `fixtures/ws8/historical-contexts.json`. They cannot be relabelled for
the production hand. The archives contain no proving keys. New experimental
fixture setup material was persisted, then reused to generate 41 context-specific
proofs. No claim of a production trusted ceremony or Level 3 closure is made.

`TestWS8CommittedCryptographicEvidence` recompiles all seven exact relations,
checks their serialized identities, regenerates Solidity from each actual VK and
verifies all 41 genuine proofs and their exact ABI public witnesses. This check
reuses valid material and does not rerun old expensive proving suites. Committed
fixture checksums use Git-canonical LF for source text and exact bytes for all
cryptographic evidence. The resolved Go module graph is compared to the historical
qualified graph; normalizing go.mod does not silently upgrade cryptography.

`BetPokerIntegratedFundedAdversarial54Test` executes the legitimate funded hand,
all ten named attacks and inherited fixture tests. The legitimate hand reaches
showdown through eight seat-signed actions, all eight encrypted private-share
proofs, both recipient receipts and nine genuinely verified card openings. The
native calculator and atomic ledger settlement produce 399 chips per participant
and 2 chips canonical rake, returning both provider bonds. The independent Node
interpreter replays the actual executed action/reveal events and compares its own
ranking, pot and payoff computation to native settlement. It exports every one of
the 41 accepted proof statements from that same executed hand.

## Exact-SHA acceptance and merge policy

The WS8 context Level 1 and combined security Level 2 workflows are executable
owners. Malformed duplicated YAML/shell tails have been removed. They pin checkout
to the actual PR head, use Solidity 0.8.30 / Foundry 1.8.6, prepare only the scoped
test closure and require machine-readable execution records. Missing, skipped or
failed mandatory tests, zero-test runs, proof/VK/source checksum differences,
context differences and mismatched report SHAs fail closed. The certificate job
requires passing historical provenance, fresh scoped cryptographic verification,
actual funded/adversarial execution and independent executed-hand replay.

A documentation statement is never acceptance. The authoritative final run URL,
qualified SHA, exact execution reports, verifier runtime identities and checksums
are the `ws8-level2-exact-sha-certificate`, `ws8-level1-genuine-cryptography` and
`ws8-level2-funded-hand-execution` artifacts of the final successful Level 2 run.
PR metadata records those immutable references and the actual merge SHA after the
last gate passes. Unrelated 420Arcade documentation checks remain outside this
poker qualification; no global phase or Level 3 rerun is requested.

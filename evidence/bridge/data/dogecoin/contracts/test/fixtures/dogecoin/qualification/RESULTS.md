# BRIDGE-AUDIT-3.V.5 — local qualification, 2026-11-14

Complete local implementation and qualification on main baseline
`bb4bd6374d561bcba65345a1dbc86c0c70d53272`. The single implementation commit
containing this record identifies the qualified tree. `source-sha256.json`
records the exact tested Solidity closure. Existing Bitcoin and separate
Litecoin/Ethereum passing evidence and original SHAs/run IDs are unchanged.

| Scoped owner | Unique passing cases | Evidence |
|---|---:|---|
| Existing Dogecoin adapter regression | 11 | adapter-regression.log |
| AuxPoW identity, branches, parent work, marker/size/nonce, activation and adversarial cases | 6 | auxpow-initial.log, auxpow-parent-qualification.log |
| Work/targets, timestamps, forks/reorgs, gateway parsing, domain substitutions, replay | 10 | consensus.log |
| All legacy retarget clamp regimes, signed DigiShield vectors and LCG wrap | 3 | difficulty.log |
| Genuine genesis-linked work, both pre-DigiShield boundaries, DigiShield activation and merged/standalone chain admission | 4 | history-fixture-correction.log, pre-retarget-correction.log, history-parent-qualification.log |
| Concrete shared router/route/risk/transfer rollback and replay | 1 | shared-correction.log |
| Genuine cached-work stateful ancestry invariant | 1 | invariant.log |
| **Total** | **36** | test-results.json |

Three fuzz owners ran 2,500 inputs each: **7,500 fuzz inputs**. The invariant ran
**128 × 64 = 8,192 handler calls**, zero handler reverts, preserving contiguous
admitted ancestry, greatest work and genesis. Its sixteen genuine Scrypt job
results are computed by the immutable real worker before randomized submission.

The independent Python/OpenSSL oracle passed **531 genuine headers** across
heights 0–480, 144988–145012 and 371325–371349. It verified every Scrypt PoW,
SHA256d identity, target, applicable difficulty, segment ancestry/work and MTP,
**12 complete historical AuxPoW relationships**, and **681 complete source
transactions / full-body Merkle trees**. Source decoded-header responses are
explicitly distinguished from complete serialized blocks. The archive contains
786 original source files, with per-entry SHA-256s. Core's genesis, DigiShield
and AuxPoW checkpoint hashes independently bind the source windows.

Actual Solidity admission runs full Scrypt for genesis-linked headers, historical
pre-DigiShield boundaries, DigiShield activation, and a twelve-header sequence
containing real merged-mining and allowed standalone blocks. High-height parent
context is explicitly seeded; syncing all 371337 predecessors in the EVM is not
claimed. Historical payments are genuine, but controlled gateway deposit/fork
fixtures are not represented as historical 420Bridge deposits or mined synthetic
blocks.

Compiler: solc 0.8.24, Cancun, optimizer 200, via-IR; Forge 1.9.0, deterministic
fuzz seed 0x420. All four production contracts fit EIP-170 runtime and EIP-3860
creation limits; bytecode-sizes.json. Exact Scrypt's high aggregate gas and
persistent scratch cost are documented in README.md. It is bounded on-chain
computation, not an unverified hash/oracle shortcut.

Corrections and original evidence are retained:

- Compile-only fixture errors (bytes1 literals, explicit signed conversion and
  constructor adaptation) were corrected before the affected tests executed.
- A historical fixture filename formatter failed to reduce its integer while
  writing decimal digits. The actual trace showed failure before any header
  read/admission; the helper was corrected and only affected cases reran.
- One historical case assumed every post-activation header carried AuxPoW.
  Actual height 371340 is a permitted chain-ID-98 standalone header. Empty AuxPoW
  transport for that real header corrected the fixture; production already
  implemented Core's correct rule. Only that affected case reran.
- A controlled gateway transaction retained Bitcoin's 22-byte script-length
  prefix after moving to Dogecoin P2PKH (25 bytes). Correcting the local prefix
  qualified that one shared integration case without weakening assertions.
- Core authenticates a parent mining candidate, not full parent transaction
  consensus. The generic parser was corrected to permit zero parent outputs,
  preserving child-deposit output validation. The three affected AuxPoW cases
  and merged historical case were requalified, plus a new compatibility case.
  Unaffected child-only, identity, adapter, arithmetic and invariant evidence was
  preserved.
- The independent oracle initially applied a predecessor rule to the first row
  of a partial historical window. Excluding only its unavailable predecessor
  context completed that qualification. The dependent pre-retarget case then
  reran with its generated oracle. Production rules and assertions were not
  weakened.

No production behavior changed after its applicable passing qualification.
Later work only records fixtures, provenance, documentation, configuration and
workflow filters. Publication uses `[skip ci]` to prevent unrelated and redundant
reruns of already-passing local evidence. **GitHub CI run ID: none launched.**
The named original local logs are actual evidence, not invented remote run IDs.
A scoped workflow is supplied for future relevant changes.

No external blocker remains for local implementation or qualification.
Deployment, full historical header sync, fresh relaying, source custody/withdrawal
signing and route/risk activation retain their existing requirements. None was
performed and no funds were moved.

Next numbered audit item: BRIDGE-AUDIT-3.V.6. Its chain/title is not established
by the checked-in roadmap; no successor title is invented and no next-step work
was begun.

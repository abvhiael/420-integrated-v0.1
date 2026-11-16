# BRIDGE-AUDIT-3.V.4 qualification — 2026-11-14

Local implementation and qualification are complete against main
`bb4bd6374d561bcba65345a1dbc86c0c70d53272`. `source-sha256.json` records the exact
qualified Solidity import closure; the single implementation commit containing
this evidence identifies its qualified tree. Existing Bitcoin passing SHAs/run
IDs and the separate Ethereum PR are untouched.

| Owner | Unique passing cases | Original evidence |
|---|---:|---|
| Exact genesis Scrypt, completion/idempotence and progress gas bound | 1 | scrypt-corrected.log |
| Consensus, compact targets/work, retarget clamps, timestamps, versions, forks, deposits and substitutions | 12 | consensus-initial.log plus consensus-correction.log |
| Existing Litecoin adapter regression | 7 | adapter-regression.log |
| Concrete verifier/adapter/shared router, route, risk and transfer atomic rollback | 1 | shared-router.log |
| Genuine consecutive Scrypt headers, twelve confirmations, historical boundaries and modern transactions | 3 | historical-initial.log plus retarget-correction.log |
| Actual HogEx / MWEB restrictions, partial/wrong/invalid Scrypt, progress fuzz | 3 | restrictions.log |
| Real cached Scrypt chain stateful ancestry invariant | 1 | chain-invariant.log |
| Outpoint replay with changed message ID after rotation, unauthorized calls and MWEB outbound | 2 | replay.log |
| **Total** | **30** | test-results.json |

Three fuzz cases ran 2,500 inputs each: **7,500 fuzz inputs**. The invariant ran
**128 × 64 = 8,192 calls**, zero handler reverts, maintaining contiguous greatest
admitted work and immutable genesis. Its sixteen-header cache is computed by
the actual Scrypt worker before stateful submission; no hash oracle is injected.

Independent Python/OpenSSL verification passed for **every one of 4,033 genuine
mainnet headers**, including both changed difficulty boundaries at 2,016 and
4,032. It recomputed Scrypt, SHA256d IDs, targets, work, cumulative work, MTP and
parent links. Terminal cumulative work is **0xfc4085f0**. Historical transaction
fixtures include a height-448 legacy payment, a height-2,300,000 SegWit payment
and actual HogEx serialization, their output amounts and SHA256d Merkle paths.
Both historical boundary headers run full production Scrypt/admission in the
EVM using clearly labeled seeded historical parent context; all 4,033 jobs are
not claimed to have been executed on the EVM. Controlled local gateway/fork
fixtures do not claim mined synthetic blocks or historical 420Bridge deposits.

All four production contracts fit EIP-170 runtime / EIP-3860 creation limits;
see bytecode-sizes.json. Compiler: solc 0.8.24, Cancun, optimizer 200, via-IR;
Forge 1.9.0; fuzz seed 0x420. Each progress call is bounded to at most 32 ROMix
rounds. The standalone genesis test used 275,981,508 total gas; actual historical
trace maximum progress-call gas was 5,458,532, with a positive <30M bound test.
Gas and persistent 128 KiB scratch per header remain material operational costs,
not an external infrastructure blocker or an unverified-hash shortcut.

Corrections and preserved evidence:

- The initial genesis check found a transcribed Merkle-root constant. The test
  header and header-chain genesis Merkle root were corrected against pinned Core
  and the genuine genesis hash before the successful Scrypt/chain qualifications.
- Initial consensus execution passed 9/12; three owners had snapshotted fixtures
  before headers.bin generation completed. Only those three reran after correct
  fixture generation, all passing.
- Initial historical execution passed 2/3. Its boundary test overflowed a
  Solidity-inferred narrow literal expression when indexing the second fixture
  anchor. The actual trace showed the first real retarget admission succeeded;
  casting the fixture offset to uint256 corrected the test. Only that case reran,
  passing. Production retarget code and assertions were not weakened.

No production source changed after its applicable passing tests. New owners,
reference provenance, documentation and workflow configuration did not trigger
reruns of unaffected passing cases. The complete scoped workflow is provided
for future relevant changes. Publication uses `[skip ci]` to avoid redundant
runs and unrelated workflows. **GitHub CI run ID: none launched**; these are
actual local logs, not fabricated remote run IDs.

No external blocker remains for the local implementation and qualification.
Production deployment, header synchronization, custody/withdrawal signing,
route/risk configuration and live activation retain their existing requirements;
none is claimed to have occurred. No funds were moved.

Next numbered canonical audit item: BRIDGE-AUDIT-3.V.5. Its chain/title is not
established by the checked-in roadmap, so no successor title is invented and
no next-step work was begun.

# BOB qualification evidence

All retained runs are local. No GitHub Actions run ID is claimed.

- `solidity-initial.log`: original 64 passes, including 5,000 fuzz cases.
- `solidity-aux-final.log`: 14 affected AuxPoW passes after removing an unsupported
  parent-branch depth cap; preserves unaffected original owner evidence.
- `adapter-new.log`: six additional destination, rollback and rotation tests.
- `final-bundle-solidity.log`: the completed native replay feeds the SDK root,
  then all 28 genuine records pass the EVM with their actual multi-leaf paths.
- `historical-solidity.log`: two historical owners covering 28 genuine settled
  blocks and authentic transaction inclusion/output parsing.
- `merkle-domain-tests.log`: checkpoint Merkle positions, router domain and minimum
  deposit height tests.
- `acquisition-tests.log`: cached raw bytes must match the pinned archive, even
  when a modified file has the same size.
- `selected-sample.log`: a requested additional record is extracted from the
  qualified corpus without repeating the complete cryptographic scan.
- `access-tests.log`: authority/gateway/verifier access controls.
- `parent-branch-test.log`: the native-compatible 33-level parent branch.
- `python-tests.log`, `bundle-tests.log`, `aux-wire-tests.log`: 29 unique Python
  tests. The latter cover actual serialized native AuxPoW, work-header binding and
  a long parent branch.
- `native-tests.log`: 21 relevant upstream tests, no errors.
- `native-regtest.json`: original controlled native AuxPoW/standalone pass.
- `native-reorg.json`: later targeted fork selection pass, retaining the original
  regtest receipt checksum; passing activation tests were not repeated.
- `bundle-tests-final.log`: eight affected SDK tests after closing the native
  checkpoint-script shortcut, retaining the original six-test evidence.
- `native-identity-tests.log`: retained and newly built native artifacts must
  match their unmodified, pinned-source build identity.
- `native-historical-scripts.log` and its JSON receipt: exactly the skipped
  historical signature/script scope, using the pinned unmodified native library.
- `history.log`: one independent complete canonical mainnet scan, 1,914,746 blocks
  and 2,140,134 transactions.
- `ACQUISITION.json`: authoritative sources, immutable snapshot checksum, raw-file
  checksums, unmodified native source and binary identity.
- `bytecode-final.json`: production EVM init/runtime size checks.
- `fixtures.log`, `offline-fixtures.log`: compact extraction and offline verification.

The two source corrections during qualification were test-harness issues: Foundry
reserves `testFail*`, and native BIP22 returns `inconclusive` for a valid, stored
side-chain prefix that has not become the selected chain. The corrected fork
qualification checks stored ancestry and the final actual selected/rejected tip;
it does not treat an `inconclusive` result as finality or successful execution.
A source audit also identified that native AuxPoW parent branches have no 32-level
consensus limit. Its targeted correction and passing requalification are retained.

The initial interrupted native replay trace remains checksum-qualified lineage.
The final native receipt identifies the fresh raw-only import, assumevalid=0,
offline source identity and selected chain. No archive indexes or chainstate are
promoted to validation evidence. Large raw inputs/traces are reproducible and
checksum-identified; compact receipts and genuine fixtures are retained in git.

# Dobbscoin proof and historical qualification tools

The native replay authority is explicit. These tools do not turn remote RPC status
or a caller-supplied JSON file into cryptographic consensus proof. Authority
operators authenticate the pinned native process and its complete validation
lineage before authorizing a checkpoint; the bundle tool does not sign or publish.

## Reproduce the retained qualification

Use Python 3.12+, Foundry v1.9.0 and solc 0.8.24. Python dependencies:
`python -m pip install -r scripts/dobbscoin/requirements.txt`.

1. `python scripts/dobbscoin/acquire.py --output /path/bob-data`
2. Clone the primary native source or its verified GitHub mirror at
   `1a300eb0f469e5a3cb0d8337f20adbab83a512e3`.
3. Build the unmodified source with
   `python scripts/dobbscoin/build_native.py --source /path/source --build /path/build`.
   The upstream build needs CMake ≥3.22, GCC/C++14, OpenSSL, SQLite and Boost
   system/filesystem/program_options/thread/chrono/test development libraries.
   Optional GUI and port-mapping libraries are disabled. An existing local
   dependency prefix can be passed with `--prefix`; no system installation is
   performed by the script. Record the emitted daemon SHA-256.
4. Run only the relevant upstream tests:
   `/path/build/src/test/test_dobbscoin --run_test=pow_tests,auxpow_tests,lwma3_tests,emergency_diff_tests --log_level=test_suite`.
5. Fresh full replay:
   `python scripts/dobbscoin/native_replay.py --daemon /path/build/src/dobbscoind --sha256 DAEMON_SHA256 --raw /path/bob-data/raw --output /path/replay --height 1914745 --tip c6d2be979323fee26cac4dd88c0e180992d8c62a8901cf6a2faf621f347d2cb8`.
   The harness starts/stops the native process, uses private loopback RPC,
   disables P2P/discovery, assumevalid and checkpoint script-skipping, and copies only raw block files into a
   fresh directory. Never populate it with bootstrap chainstate or indexes.
   A continuation requires an explicit checksum-pinned fresh-replay lineage and
   retained trace. It cannot silently accept arbitrary imported node databases.
   The retained first replay used native built-in checkpoints: source
   `ConnectBlock` skips historical scripts below 1,848,000 even with assumevalid=0.
   Its separate `verify_native_scripts.py` pass uses the same native consensus ABI
   for every skipped historical input, then `qualify_script_coverage.py` binds
   both receipts to the same source and authenticated corpus. This affected-only
   qualification preserves the ongoing consensus replay; it does not repeat PoW.
   Reproduce that affected-only complement with:
   `verify_native_scripts.py --headers /path/independent/headers.bin --index
   /path/independent/raw-index.sqlite --acquisition
   docs/audit/dobbscoin/ACQUISITION.json --library
   /path/build/src/libdobbscoinconsensus.so.0.0.0 --library-sha256 LIBRARY_SHA256
   --build-receipt /path/build/native-build.json --output /path/scripts.json`, then `qualify_script_coverage.py --native
   /path/replay/native-replay.json --scripts /path/scripts.json --history
   contracts/test/fixtures/dobbscoin/historical.json --output /path/qualified-native.json`.
   Fresh runs disable that shortcut directly. The bundle builder rejects a
   checkpoint-assisted replay unless the required script complement is present.
6. Independent history:
   `python scripts/dobbscoin/history.py --blocks /path/bob-data/raw --work /path/independent --height 1914745 --tip c6d2be979323fee26cac4dd88c0e180992d8c62a8901cf6a2faf621f347d2cb8 --workers 2`.
   This checks every canonical header's ancestry, scrypt, expected difficulty,
   MTP, work and every transaction root. It is not a substitute for native scripts
   and UTXO validation. AuxPoW trailers and parent work are handled after activation.
7. Extract compact fixtures with `fixtures.py --history /path/independent/history.json
   --headers /path/independent/headers.bin --index /path/independent/raw-index.sqlite
   --output contracts/test/fixtures/dobbscoin`.
   Add `--sample HEIGHT` to extract any requested block from the already-qualified
   header corpus without repeating the full historical cryptographic scan.
8. Build a checkpoint bundle with `bundle.py --history
   contracts/test/fixtures/dobbscoin/historical.json --native
   /path/replay/native-replay.json --output /path/bundle.json`.
   Native and independent network, tip, height and cumulative work must agree.
   State leaves use the Solidity ABI schema in `fixtures.py`; Merkle nodes use
   SHA-256. Header/transaction trees use SHA256d and native raw digest byte order.
   `signing_digest` binds the checkpoint to its EVM chain, registry, authority
   epoch, predecessor, height, block hash and state root. Keys are not handled here.
9. Controlled forward-rule tests (separate from genuine history):
   `native_regtest.py --daemon /path/build/src/dobbscoind --output /path/regtest`,
   then `native_reorg.py --daemon /path/build/src/dobbscoind --regtest /path/regtest`.

For routine repository changes, use the retained offline fixtures and only affected
owners: `verify_fixtures.py`, relevant `unittest` owners,
`python scripts/qualify-dobbscoin.py`, and
`python scripts/verify-dobbscoin-bytecode.py`. Set `DOBBSCOIN_FORGE` or
`DOBBSCOIN_SOLC` for explicit executable paths; `qualify-dobbscoin.py --solc PATH`
selects the compiler and supports `--match` / `--match-test` for affected owners.
Do not reacquire or replay the complete native history unless relevant source,
consensus, fixture or provenance changes invalidate that retained evidence.

The targeted workflow uses narrow owner paths and retained fixtures. The qualified
publication uses `[skip ci]` to preserve local exact-tree evidence without
launching redundant CI. No branch or approval restriction is added.

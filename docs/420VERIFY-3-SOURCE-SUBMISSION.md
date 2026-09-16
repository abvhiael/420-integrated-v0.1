# 420Verify VERIFY-3 — source/build submission model

VERIFY-3 defines the exact compiler inputs and provenance 420Verify must retain before any build reproduction begins.

Supported submission classes are Solidity Standard JSON Input, multi-file source bundles, and flattened Solidity as compatibility input. Flattened input is not privileged or treated as more canonical than a normal source bundle.

Every submission records the exact compiler version, optimizer enabled flag and runs, EVM version, via-IR setting, metadata hash mode, linked-library source/name/address tuples, and constructor arguments when known. Unknown constructor arguments remain explicitly unknown rather than silently inferred.

Source commitments are deterministic. Multi-file bundles are sorted by path for transport-order independence while preserving every source byte exactly. Standard JSON submissions retain the original submitted JSON bytes as evidence, while their commitment is calculated from a canonical JSON serialization so irrelevant object-key ordering and whitespace do not change the bundle identity. Solidity source strings and compiler-setting values inside Standard JSON remain unchanged; any such value change changes the commitment.

Submission paths must be relative and traversal-free. Library addresses and known constructor arguments must be valid hexadecimal values. Tampered source commitments fail validation.

VERIFY-3 does not compile, verify, endorse, publish, or grant authority to submitted code. It prepares reproducible build evidence for VERIFY-4 and later comparison phases only.

# Architecture

420 Verify is a contract-free Genesis application/service. Deployed bytecode and chain context come from canonical chain state; registered application identity comes from 420 Registry. Verification results are reproducible service output and may be independently recomputed.

## Components

- **RPC evidence acquisition** reads chain ID, deployed runtime bytecode, runtime code hash, observation block, first-code block, and creation context when recoverable.
- **Submission model** preserves Standard JSON or multi-file sources plus exact compiler/build settings and deterministic bundle commitments.
- **Compiler worker** resolves allowlisted compiler binaries, verifies checksums, executes bounded hermetic builds, and records compiler/input/output commitments.
- **Matcher** performs exact runtime and creation-bytecode comparison and emits stable classifications/diagnostics.
- **Evidence store** persists append-only records keyed by `chainId:address:runtimeCodeHash`; indexes are rebuildable and non-canonical.
- **Proxy resolver** handles EIP-1167 and EIP-1967 relationships and preserves separate proxy/implementation status.
- **Public API** exposes exact-binding lookup, history, evidence retrieval, and source/build submission.

## Authority model

420 Verify is never a source of canonical chain state, Registry identity, Wallet permissions, Smart Account authority, or governance power. Explorer and AppStore may consume its evidence, but they must retain the original source and warning semantics.

## Failure model

Wrong-chain observations, unavailable canonical bytecode, malformed submissions, unallowlisted compilers, checksum mismatch, compiler timeout/output limits, store tampering, broken history, and stale proxy implementation state fail closed.

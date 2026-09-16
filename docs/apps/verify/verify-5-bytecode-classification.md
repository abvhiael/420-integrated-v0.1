# VERIFY-5 — bytecode comparison and classification

VERIFY-5 classifies reproducible build evidence against canonical deployment evidence without weakening byte-for-byte comparison.

## Result classes

- `FULL_MATCH`: deployed runtime bytecode matches exactly and, when canonical creation bytecode is recoverable, creation bytecode also matches exactly.
- `PARTIAL_MATCH`: runtime bytecode matches exactly but canonical creation bytecode cannot be recovered, so creation equivalence cannot be proven.
- `MISMATCH`: canonical and reproduced bytecode differ in runtime or in recoverable creation bytecode.
- `UNVERIFIABLE`: required canonical evidence or reproduced build evidence is missing, malformed, or insufficient for a valid comparison.

## Exactness rules

Runtime bytecode is never compared after stripping metadata, masking linked-library addresses, or masking immutable-reference bytes. Creation bytecode is handled the same way when canonical creation input is recoverable. Metadata hash mode, linked libraries and immutable-reference presence are emitted as diagnostic comparison context so differences remain visible instead of being silently normalized away.

A runtime match alone cannot become `FULL_MATCH` when creation bytecode was recoverable but failed comparison. Conversely, an unavailable creation transaction cannot force a false mismatch; it yields `PARTIAL_MATCH` with `CREATION_CONTEXT_UNAVAILABLE`.

## Stable diagnostics

VERIFY-5 emits machine-stable reasons including:

- `EXACT_RUNTIME_MATCH`
- `EXACT_CREATION_MATCH`
- `CREATION_CONTEXT_UNAVAILABLE`
- `RUNTIME_BYTECODE_MISMATCH`
- `CREATION_BYTECODE_MISMATCH`
- `COMPILED_RUNTIME_MISSING`
- `CANONICAL_RUNTIME_MISSING`
- `INVALID_CANONICAL_EVIDENCE`
- `INVALID_BUILD_EVIDENCE`
- `METADATA_DIFFERENCE_RELEVANT`
- `LIBRARY_LINKS_RELEVANT`
- `IMMUTABLE_REFERENCES_RELEVANT`

Every valid comparison remains bound to the VERIFY-2 chain ID + address + canonical runtime-code-hash binding key. Verification remains non-canonical evidence and does not imply audit, safety, endorsement, Registry legitimacy, Wallet authority or immutability.

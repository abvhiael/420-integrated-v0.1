# REG-AUDIT-6 — regenerate catalogue/reference metadata

**Canonical roadmap:** `docs/audit/420REGISTRY-COMPLETE-AUDIT-20260928.md`

## Original definition

After REG-AUDIT-4/5 only:

- regenerate Developer Hub catalogue/manifests;
- regenerate generated contracts/deployment references;
- remove missing-interface references;
- ensure examples are visibly non-canonical unless backed by approved deployment evidence.

**Exit:** no stale Registry address/interface/artifact metadata remains.

## Repository-grounded implementation

REG-AUDIT-5 is merged to `main` and supplies the canonical Registry predeploy identity:

- address: `0x0000000000000000000000000000000000000434`
- artifact: `contracts/artifacts/ProtocolRegistry.json`
- frozen interface: `contracts/src/interfaces/genesis/IProtocolRegistry420.sol`
- runtime code hash: `0x9f9e5f794296cf9faf5f8c8d17cd815f3c19c004a158c15cb61b5a29eaacb330`

REG-AUDIT-6 repairs the active Developer Hub catalogue and SDK fixtures to use that retained artifact/interface identity, replaces the placeholder ABI hash with the SHA-256 identity of the retained ABI, regenerates DOC-10 contract/event/deployment references, and retires active optional dependency references to missing Registry paths.

The local network manifest remains explicitly local and its Registry entry remains versioned `local-example`. The generated deployment reference continues to publish **no canonical network deployment**, because REG-AUDIT-8—not this step—owns production-equivalent testnet deployment evidence.

## Mechanical qualification

`scripts/verify-reg-audit-6-generated-metadata.py` fails closed on:

- Registry address drift from `0x...0434`;
- artifact/interface paths that do not exist or disagree with retained REG-AUDIT-5 evidence;
- ABI hash mismatch;
- stale `0x...0420` or retired `0x...0448` Registry metadata in active catalogue/generated references;
- the removed missing paths `contracts/out/ProtocolRegistry.sol/ProtocolRegistry.json` and `contracts/src/interfaces/IProtocolRegistry.sol`;
- accidental promotion of the local example into a canonical deployment.

The dedicated REG-AUDIT-6 workflow additionally runs deterministic DOC-10 regeneration checks, Developer Hub tests, SDK tests, and a write-then-clean drift check on the exact PR head.

Historical audit snapshots may retain superseded addresses/paths when explicitly documenting past proposals or findings; they are provenance records, not active catalogue/reference metadata.

## Status

**EVIDENCE RECORDED — final evidence-head exact-SHA requalification pending.**

Substantive implementation SHA `1e7d591b00f54e9827fefc680c53bf6f971f3de3` passed the exact-head retained qualification set:

- REG-AUDIT-6: run `36745494895`;
- 420Docs Qualification: run `36745494968`;
- 420 Developer Hub: run `36745494775`;
- 420 Integrated Qualification: run `36745411136`;
- 420Indexer: run `36745494795`;
- REG-AUDIT-4: run `36745494881`, which mechanically reran retained REG-AUDIT-1/2/3 coverage.

REG-AUDIT-5 is the already-qualified merged prerequisite at base `da148f2a05b09e6566cc35235646b21dd97d30fd`. REG-AUDIT-6 does not alter Registry Solidity, the retained artifact, or predeploy state; the REG-AUDIT-6 verifier independently rechecks their address/interface/artifact/runtime-hash consistency on the exact candidate.

Because this evidence record itself changes the branch SHA, the complete retained qualification set is rerun on the resulting evidence-recording head. The final exact SHA and final run IDs are retained in PR #414 metadata after that rerun, following the repository's anti-recursion evidence convention.

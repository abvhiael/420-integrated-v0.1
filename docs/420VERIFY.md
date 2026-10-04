# 420Verify

420Verify is the contract-source verification application for the 420 Integrated blockchain. It answers one narrow question: **do these published source/build inputs reproduce the code deployed at this address on this network?**

## Historical Genesis closeout and current audit state

GEN-10.5 / VERIFY-0 through VERIFY-10 was historically qualified and merged through PR #303 at merge commit `1f937b7ef641980cc118336763ba50ffc8f3cc5a`. Those records are retained as historical evidence, but their blanket implementation-complete claim is **superseded by the current repository-grounded VERIFY-AUDIT remediation in PR #503** wherever current repository evidence contradicts it.

- Genesis phase: `GEN-10.5`
- Service ID: `420/service/verify/v1`
- Historical qualified feature head: `e723037ca7cd09e530035577d7eb41319f387e75`
- Historical 420Docs Qualification: `#1418` — passed
- Historical 420 Integrated Qualification: `#3678` — passed
- Historical phase merge PR: `#303`
- Current audit branch: `audit/420verify-20261003`
- Current audit PR: `#503`
- VERIFY-AUDIT-6 exact-head Level 1 qualification: implementation SHA `868095783962370149e685f6145c0163b84ba5e8`, run `37175301638`, job `111356576146` — passed
- Current audit phase closeout: **pending VERIFY-AUDIT-8**
- Public testnet endpoint deployment: **pending**

Implementation qualification and public deployment remain separate states. No production/testnet URL may be claimed until an actual deployment exists and the testnet readiness checks pass.

## Trust boundary

420Verify is a contract-free Genesis application/service. Canonical deployed bytecode and deployment context come from chain state. Registered application/service identity comes from 420Registry. Verification records are reproducible, non-canonical evidence and may be recomputed by independent verifiers.

420Verify cannot grant Registry legitimacy, Wallet/Smart Account permissions, transfer authority, governance power, audit status, or application endorsement.

## Verification pipeline

A verification request flows through these stages:

1. acquire canonical deployment evidence from the configured 420 RPC;
2. bind the subject to chain ID, contract address, and runtime code hash;
3. validate the submitted source bundle and exact build settings;
4. resolve an allowlisted compiler and reproduce the build in a bounded worker;
5. compare runtime bytecode exactly and creation bytecode when recoverable;
6. classify the result and emit stable diagnostics;
7. persist append-only reproducible evidence in the non-canonical evidence store;
8. expose lookup/history/evidence views for Explorer, AppStore, developers, and independent reproduction.

## Verification result classes

- **FULL_MATCH** — runtime bytecode matches exactly and creation bytecode also matches when canonical creation evidence is recoverable.
- **PARTIAL_MATCH** — runtime bytecode matches exactly, but a required comparison such as canonical creation bytecode is unavailable.
- **MISMATCH** — reproduced bytecode differs from canonical deployed evidence.
- **UNVERIFIABLE** — required canonical evidence, compiler evidence, or submitted build information is invalid or unavailable.

420Verify never reduces these states to a misleading binary “verified/unverified” badge.

## Recorded evidence

Verification is bound to `chainId:address:runtimeCodeHash`. Published evidence preserves the source-bundle commitment, exact compiler version, optimizer status/runs, EVM version, via-IR setting, metadata-hash mode, linked libraries, constructor arguments or an explicit unknown marker, compiler input/output commitments, runtime/creation bytecode, diagnostics, canonical chain provenance, and record content hash.

Solidity Standard JSON Input and multi-file bundles are first-class inputs. Flattened source is compatibility-only because flattening can discard build context.

## Evidence store and history

Published evidence is append-only and keyed by the exact deployed-code binding. The store is intentionally non-canonical and rebuildable. On restart, indexes are reconstructed by scanning persisted records. Tampered records, broken bindings, unsupported schemas, invalid source commitments, and non-contiguous history fail closed.

A changed runtime code hash creates a separate evidence history rather than overwriting prior records.

## Proxies and upgrades

420Verify detects EIP-1167 minimal proxies and EIP-1967 implementation/admin/beacon relationships where canonical state permits resolution. Proxy shells and implementations remain separate verification subjects.

Historical proxy relationship evidence remains bound to its canonical observation block. A new implementation must be independently verified against its own address/runtime-code binding.

The current production entrypoint does not run a continuous proxy-upgrade tracker. Downstream consumers must revalidate canonical proxy state before presenting a persisted implementation relationship as current; historical evidence must not be silently promoted to current status.

## Public API

The implemented public surface includes:

- `GET /v1/verify/{chainID}/{address}/{runtimeCodeHash}` — latest exact-binding evidence;
- `GET /v1/verify/{chainID}/{address}/{runtimeCodeHash}/history` — append-only verification history;
- `GET /v1/verify/evidence/{recordHash}` — evidence lookup by record content hash;
- `POST /v1/verify/submissions` — source/build submission to the configured verification processor; public source publication requires explicit `publishSource: true`;
- `GET /healthz` and `GET /readyz` — service health/readiness without claiming canonical authority.

Consumer responses explicitly preserve `canonical: false`, `registryAuthority: false`, and `walletAuthority: false` semantics.

## Adversarial hardening

The Genesis implementation rejects secret-bearing payload fields, malformed/trailing JSON, invalid hex identifiers, oversized request bodies, excessive source-file counts, oversized individual/aggregate sources, unallowlisted compilers, compiler checksum mismatches, compiler timeouts, excessive compiler output, wrong-chain bindings, stale proxy implementation state, and tampered evidence records.

The service fails closed when canonical chain evidence, compiler execution, or persisted evidence cannot be trusted.

## What “verified” means

A successful result means the published source/build inputs correspond to deployed code under the recorded verification rules. It does **not** mean the contract is audited, secure, endorsed, official, immutable, non-malicious, legally compliant, or authorized to access a user's wallet.

420Registry remains authoritative for registered protocol/application identity. 420Wallet and Smart Accounts remain the authorization boundary for user permissions and transactions.

## Ecosystem integration

420Explorer may display published source, compiler settings, diagnostics, history, proxy/implementation relationships, and direct verification evidence. 420AppStore may consume verification state as sourced security context alongside publisher, version, permission, and security metadata. Neither application may promote a 420Verify result into Registry identity or Wallet authority.

420Verify is intentionally replaceable: independent verification services and local reproducible builds should be able to reproduce the same result from the same evidence.

## Further documentation

The app-specific documentation lives under [`docs/apps/verify/`](apps/verify/index.md). Deployment/operations are documented in [`docs/apps/verify/deployment.md`](apps/verify/deployment.md). The historical Genesis implementation roadmap is retained in [`docs/420VERIFY-ROADMAP.md`](420VERIFY-ROADMAP.md), the active audit roadmap is [`docs/audit/420VERIFY-AUDIT.md`](audit/420VERIFY-AUDIT.md), and deployment readiness is tracked in `testnet/public-services/verify/readiness.json`.

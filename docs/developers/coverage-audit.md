---
title: DOC-9 developer documentation coverage audit
audience:
  - developer
  - maintainer
category: developer
status: development
version: current
---

# DOC-9 developer documentation coverage audit

DOC-9 closes the task-oriented developer-documentation layer for the current 420 Integrated Genesis ecosystem. This audit records what the phase covers, what authority boundaries were checked and what remains deliberately deferred to later documentation phases.

## Audit result

**DOC-9 coverage: COMPLETE, pending final exact-head qualification and monolithic PR merge.**

The phase contains the developer landing page plus **38 task-oriented developer guides** spanning DOC-9.1 through DOC-9.10. `docs/DOCS-ROADMAP.md` remains the phase tracker.

## Coverage matrix

| Phase | Required coverage | Result |
| --- | --- | --- |
| DOC-9.1 | integration model, source-of-truth/finality, prerequisites/tooling, DOC-10 boundary | PASS |
| DOC-9.2 | clean setup, local real15/devnet lifecycle, project/starters, first canonical read + Wallet write | PASS |
| DOC-9.3 | manifests/network identity, testnet/Faucet, RPC/WSS/420RPC boundary, health/failover | PASS |
| DOC-9.4 | contracts/interfaces, deployment, 420Verify evidence, Registry/AppStore handoff | PASS |
| DOC-9.5 | canonical-vs-derived reads, Indexer API, cursor/replay/reorg, fallback/reliability | PASS |
| DOC-9.6 | Wallet/Smart Account, intent/simulation, capabilities/sessions, passkeys/recovery | PASS |
| DOC-9.7 | SDK/CLI, events/finality, errors/retries/idempotency, diagnostics/correlation | PASS |
| DOC-9.8 | provider model, Storage/Resource, AI/Compute, Bridge | PASS |
| DOC-9.9 | Gaming Protocol, guest/Wallet play, entitlements/migration, cross-game/session boundaries | PASS |
| DOC-9.10 | end-to-end workflows, production/security checklist, phase coverage audit | PASS |

## Developer journey audit

A developer can now follow one documentation path from a clean environment through release:

1. establish prerequisites and explicit environment binding;
2. bootstrap the local real15 development network;
3. resolve network, RPC and canonical contract/service identity;
4. choose canonical RPC versus Indexer projections correctly;
5. prepare bounded transactions without handling user signing secrets;
6. hand authorization/signing to Wallet/SmartAccount420;
7. handle events, finality, retries, reorgs and diagnostics;
8. deploy contracts through non-custodial planning/external signing;
9. publish reproducibility evidence through 420Verify;
10. prepare governance-authorized Registry publication and optional AppStore projection;
11. integrate Storage/Resource, AI/Compute, Bridge and Gaming Protocol while preserving their domain boundaries;
12. assemble exact-head developer qualification and production-readiness evidence without promoting Developer Hub into protocol authority.

## Authority audit

The phase consistently preserves these boundaries:

- **chain/owning protocol** — canonical execution and protocol state;
- **Registry** — canonical registered service/version legitimacy within its domain;
- **Wallet/SmartAccount420/CapabilityRegistry420** — user signing, account and reusable session/capability authority;
- **420Indexer** — rebuildable derived projections only;
- **420Verify** — reproducibility evidence only, never security certification or Registry legitimacy;
- **Developer Hub / CLI / SDK** — discovery, orchestration, validation and diagnostics only;
- **AppStore** — non-canonical discovery/catalogue presentation;
- **Storage/AI/Bridge providers** — provider-scoped off-chain execution/evidence, never ambient chain authority;
- **Gaming Protocol** — provenance-sensitive interoperability only, not routine game-state or Wallet authority.

No DOC-9 page intentionally grants an operational convenience layer authority that belongs to another component.

## Canonical versus derived-state audit

DOC-9 distinguishes:

- canonical RPC/contract reads from Indexer projections;
- submitted/included/safe/finalized transaction states;
- provider evidence from protocol acceptance/settlement;
- bridge foreign proof validity from local route/risk/replay eligibility;
- game query/indexer responses from finalized entitlement/claim/attestation state;
- verification evidence from deployment and Registry state;
- CI qualification evidence from production launch approval.

Security-sensitive decisions are directed back to the canonical owning source when derived or provider state disagrees.

## Signing and secret-handling audit

The developer path never requires a dApp or Developer Hub to acquire raw user signing secrets. Documentation explicitly rejects storage/exposure of:

- private keys and seed phrases;
- passkey/session signing material;
- validator/Engine secrets;
- bearer tokens/API secrets/passwords in tracked evidence;
- private storage plaintext/decryption keys;
- private AI prompts, datasets and outputs where only commitments/references belong on-chain.

State-changing user actions cross the Wallet/Smart Account boundary, while project deployment signatures remain with the declared qualified signer.

## Replay, retry and failure audit

Coverage includes:

- transaction/protocol replay identities;
- bounded retries and deadline handling;
- uncertain-submission reconciliation before a second write;
- opaque Indexer cursors/checkpoints and replay;
- event deduplication and reorg handling;
- provider failure/replacement without rewriting historical evidence;
- Bridge source finality/risk/replay checks;
- target-bound single-consumption gaming migration claims;
- fail-closed behavior for stale, revoked, mismatched or unavailable high-risk state.

## Privacy audit

The docs preserve the principle that only the minimum provenance/authorization/settlement commitments belong in canonical state. Large/private payloads, routine game saves and operational telemetry remain off-chain unless a separate protocol explicitly requires otherwise.

Gaming documentation specifically prohibits a canonical wallet-wide activity/history enumeration surface; cross-game interoperability uses known, exact-scope objects.

## Testnet and production-scope audit

DOC-9 does not fabricate public testnet/mainnet deployment values. The repository currently provides a local example manifest; deployment-specific public endpoints and identities must come from official environment manifests when available.

The testnet Faucet is treated as testnet-only and testnet `$420` as having no monetary value.

Developer documentation completion must not be confused with network launch readiness. At DOC-9 closeout the independent `release/readiness.json` still reports `public_testnet_ready: false` because production dependency/live-engine/real-node/partition-restart/production-soak evidence remains blocked. Developer Hub qualification cannot override that evidence.

## Navigation and cross-link audit

The canonical developer entry point is `docs/developers/index.md`. Every DOC-9 subphase is linked from that landing page and the end-to-end/security/audit closeout pages cross-link back into the owning task guides.

DOC-9 deliberately keeps machine-generated reference out of handwritten task pages. Later generated ABI, NatSpec, RPC/API/SDK, event/error and deployment-registry reference should link into these task flows rather than replacing them.

## Deliberate exclusions

The following are not DOC-9 gaps:

- machine-generated ABI/NatSpec/event/error/RPC/API/SDK/deployment reference — **DOC-10**;
- ecosystem-wide searchable troubleshooting/error registry — **DOC-11**;
- additional automated documentation policy/coverage CI — **DOC-12**;
- versioned docs renderer policy — **DOC-13**;
- deep links from runtime applications — **DOC-14**;
- Ask 420 documentation assistant — **DOC-15**;
- final Genesis-wide documentation matrix audit — **DOC-16**;
- production 420Docs publication/runtime integration — **DOC-17**.

## Phase closeout gate

DOC-9 may merge only when all of the following are true on one exact branch head:

- DOC-9.1 through DOC-9.10 are complete;
- the phase branch is reconciled with current `main`;
- `420Docs Qualification` succeeds for that exact head;
- `420 Integrated Qualification` succeeds for that exact head;
- PR #228 still points to that qualified head at merge time.

After merge, DOC-10 becomes the next documentation development phase.

## Related documentation

- [Developer landing page](index.md)
- [End-to-end developer examples](end-to-end-examples.md)
- [Production and security checklist](production-security-checklist.md)
- [Developer integration model](integration-model.md)
- [Source of truth and finality](source-of-truth.md)

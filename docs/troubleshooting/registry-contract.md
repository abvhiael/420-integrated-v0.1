---
title: Troubleshooting registry contract
audience:
  - user
  - developer
  - operator
category: troubleshooting
status: current
version: current
---

# Troubleshooting registry contract

This document defines the canonical DOC-11 troubleshooting entry contract for 420 Integrated. Every troubleshooting entry must use stable documentation identifiers, preserve protocol and chain authority boundaries, state retry safety explicitly, and avoid collecting secrets.

## Stable troubleshooting IDs

Documentation IDs use this form:

`TRB-<DOMAIN>-<NNN>`

- `TRB` identifies the ecosystem troubleshooting registry.
- `<DOMAIN>` is an uppercase stable domain token.
- `<NNN>` is a zero-padded three-digit sequence within that domain.

Examples:

- `TRB-WALLET-001`
- `TRB-RPC-004`
- `TRB-CONSENSUS-012`
- `TRB-BRIDGE-003`

IDs are permanent once published. Titles, prose and recovery guidance may evolve, but a published ID must not be silently reassigned to a different condition. If one condition is split into multiple distinct troubleshooting cases, retain the original entry as an index/deprecation pointer where practical and allocate new IDs for the narrower cases.

### Reserved domain tokens

DOC-11 uses these initial stable domains:

- `WALLET` — Wallet, account discovery, signing, passkeys, capabilities and recovery.
- `CHAIN` — chain identity, blocks, receipts, finality and canonical-state interpretation.
- `RPC` — public RPC/WSS, gateways and request/transport failures.
- `TX` — transaction submission, nonce, gas, replacement and execution outcomes.
- `CONSENSUS` — validator, proposer, attestation, QC, finality and quorum issues.
- `NODE` — `fourtwentyd`, `node420`, Engine and node-process operations.
- `INDEXER` — 420Indexer ingestion, projections, replay and readiness.
- `EXPLORER` — Explorer presentation and derived-view discrepancies.
- `SEARCH` — 420 Search indexing/query issues.
- `ANALYTICS` — Analytics derived-data interpretation.
- `STATUS` — health/readiness/status presentation.
- `PAY` — 420Pay payment/settlement issues.
- `TOKEN` — 420Token deployment/usage issues.
- `SWAP` — Swap/Exchange routing and settlement issues.
- `BRIDGE` — cross-chain route, proof, replay, finality and settlement issues.
- `STAKE` — validator stake/bond/reward issues.
- `GOV` — governance proposal/vote/execution issues.
- `TREASURY` — governed-fund and treasury issues.
- `GRANTS` — grant lifecycle issues.
- `REGISTRY` — Registry service discovery/version issues.
- `NAMES` — `.420` name resolution and ownership issues.
- `IDENTITY` — 420 Identity/420-IS issues.
- `RANDOM` — randomness provider/request/verification issues.
- `ORACLE` — oracle freshness/provider/attestation issues.
- `STORAGE` — storage-proof/resource-provider issues.
- `AI` — 420AI provider/job/SLA issues.
- `RIGHTS` — rights/licensing/provenance issues.
- `VERIFY` — verification/reproducibility evidence issues.
- `ARBITRATION` — dispute/evidence/outcome issues.
- `MESSENGER` — message transport/delivery issues.
- `NOTIFY` — notification delivery/subscription issues.
- `ATTENTION` — attention/consent/proof/reward issues.
- `APP` — application-specific issues that cannot be represented safely by a shared domain entry.

New domain tokens require documentation review before use so aliases and near-duplicates do not fragment searchability.

## Required entry fields

Every troubleshooting entry must provide:

1. **ID** — stable `TRB-<DOMAIN>-<NNN>` identifier.
2. **Title** — plain-language condition or symptom.
3. **Audience** — one or more of `user`, `developer`, `operator`.
4. **Surface** — affected product/protocol/service/process.
5. **Symptom** — what the person can actually observe.
6. **Severity** — `info`, `degraded`, `blocked`, `value-risk`, or `security-critical`.
7. **Authority source** — which source can establish truth for the condition.
8. **Likely causes** — bounded list of plausible causes, ordered where possible.
9. **Diagnostic evidence** — safe evidence to collect before recovery.
10. **Retry safety** — `safe`, `conditional`, `unsafe`, or `not-applicable`.
11. **Recovery steps** — ordered actions, including stop conditions.
12. **Escalation** — when self-service should stop and what non-secret context to provide.
13. **Cross-links** — canonical task guidance, architecture, generated reference and related troubleshooting entries.

Optional fields may include environment scope, finality requirement, value-at-risk note, known provider dependency, expected recovery time class, and related runtime error identifiers.

## Severity semantics

- **info** — informational state or expected transient behavior; no functional impairment.
- **degraded** — feature or derived service is impaired, but canonical state or safer fallback remains available.
- **blocked** — the requested action cannot proceed until the underlying condition changes or is corrected.
- **value-risk** — funds, rewards, settlement, cross-chain assets or replay/double-submit risk may be affected.
- **security-critical** — signer compromise, secret exposure, unsafe recovery, equivocation, unauthorized authority or similarly sensitive conditions.

Severity describes recovery risk, not user frustration.

## Authority rules

Troubleshooting must identify the highest relevant authority source before recommending recovery.

Preferred authority order depends on the domain, but the following distinctions are mandatory:

- canonical chain state outranks Explorer, Search, Analytics, notification or Indexer presentation;
- finalized or protocol-defined canonical state outranks local caches and projections;
- contract/protocol state outranks application UI assumptions;
- approved network/deployment/Registry evidence outranks examples, localhost defaults and planned addresses;
- runtime-emitted errors outrank prose descriptions of those errors;
- generated DOC-10 reference may describe machine-derived surfaces, but it does not create protocol authority;
- provider availability or provider claims do not override canonical settlement, proof, freshness or verification rules.

If the authoritative source cannot be reached, the entry must say that the condition is unresolved rather than promoting a lower-authority source to canonical truth.

## Retry safety

Every state-changing troubleshooting entry must say whether repeating the action is safe.

### safe

The operation is read-only or explicitly idempotent and can be repeated without creating duplicate state or value movement.

### conditional

A retry is allowed only after checking specified evidence, such as transaction hash, nonce, canonical receipt, payment ID, bridge message ID, job ID or protocol object state.

### unsafe

Blind retry can create duplicate submissions, payments, settlements, bridge messages, governance actions, jobs or other unintended state. The entry must require canonical-state inspection before further action.

### not-applicable

No user-controlled retry exists for the condition.

A timeout is never, by itself, proof that a write failed.

## Diagnostic evidence contract

Troubleshooting should request the minimum evidence needed to distinguish causes. Safe examples include:

- chain ID and environment name;
- transaction hash, block number or receipt status;
- public address or contract address when appropriate;
- RPC method and non-secret error response;
- stable troubleshooting/runtime error ID;
- protocol object ID, payment ID, bridge message ID, proposal ID or job ID;
- public service health/readiness response;
- timestamps and finality state;
- software version or build identifier;
- sanitized logs with authentication material removed.

Do not request seed phrases, private keys, raw passkey secrets, recovery secrets, signing-device secrets, bearer tokens, API secrets, session credentials or unredacted authentication headers.

## Secret-safety and support rules

Every DOC-11 flow follows these rules:

- support never needs a seed phrase or private key;
- no troubleshooting step asks a user to paste signer or recovery secrets into chat, tickets, logs or issue reports;
- credentials, cookies, bearer tokens and private endpoint secrets must be redacted before sharing diagnostics;
- recovery should prefer revocation, re-enrollment, replacement or canonical recovery mechanisms over secret disclosure;
- suspicious signing or authorization activity is a stop condition, not a prompt to keep retrying;
- security-critical entries must direct the reader toward containment first, diagnosis second.

## Entry structure

Each troubleshooting page or registry entry should use this order:

1. ID and title.
2. What you see.
3. What this usually means.
4. Authority to check.
5. Before you retry.
6. Safe diagnostics.
7. Recovery steps.
8. Stop/escalate when.
9. Related documentation.

This order keeps the visible symptom and retry risk ahead of deeper implementation detail.

## Canonical versus derived diagnosis

A derived service can be wrong, stale, unavailable or mid-rebuild while canonical chain/protocol state remains healthy. When symptoms disagree across surfaces:

1. identify the domain authority;
2. query the canonical source where available;
3. determine the relevant finality level;
4. compare the derived service cursor/version/provenance;
5. recover or rebuild the derived layer without mutating canonical state solely to make the presentation match.

Examples include Explorer/Indexer lag, stale Search results, delayed Notifications and Analytics discrepancies.

## Cross-linking contract

Troubleshooting entries should link outward rather than duplicate authoritative material:

- task/how-to guidance → DOC-6, DOC-8 and DOC-9;
- architecture/authority → DOC-2 through DOC-7;
- exact generated methods/events/errors/selectors → DOC-10;
- this registry → symptom diagnosis, retry safety and recovery order.

DOC-11 may summarize enough context to make recovery safe, but canonical technical definitions remain in their owning documentation.

## Registry change rules

A registry change must preserve:

- global ID uniqueness;
- stable domain meaning;
- explicit audience and severity;
- authority source;
- retry classification;
- secret-safe diagnostics;
- ordered recovery and escalation;
- working cross-links.

DOC-11.10 will audit these invariants ecosystem-wide before phase closeout.

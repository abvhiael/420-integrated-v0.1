---
title: Search, diagnostics and support workflow
audience:
  - user
  - developer
  - operator
category: troubleshooting
status: current
version: current
---

# Search, diagnostics and support workflow

DOC-11.9 turns the troubleshooting registry into an operational support surface. It defines how readers find entries by stable ID or symptom, how they collect copy-safe diagnostics, how incidents are escalated, and how applications can deep-link to stable troubleshooting anchors without duplicating recovery logic.

## Search by stable troubleshooting ID

Every published troubleshooting entry has a permanent `TRB-<DOMAIN>-<NNN>` ID. Search the exact ID first when Wallet, a dApp, CLI output, monitoring, support material or a prior incident already provides one.

Examples:

- `TRB-WALLET-006`
- `TRB-TX-003`
- `TRB-CONSENSUS-006`
- `TRB-BRIDGE-004`
- `TRB-AI-002`

The ID remains stable even when explanatory text evolves.

## Search by symptom

When no ID is available, search using observable symptoms rather than inferred causes. Prefer phrases such as:

- wallet will not connect;
- wrong network;
- transaction pending;
- transaction timed out;
- transaction reverted;
- finality not advancing;
- validator not active;
- Indexer stale;
- Explorer missing transaction;
- swap output differs;
- bridge destination not settled;
- oracle stale;
- AI job not completing;
- notification not delivered.

Do not start by assuming a specific root cause. The troubleshooting entry determines the relevant authority source and recovery order.

## Browse by audience

### User

Start with Wallet, application, value movement, application-specific and presentation-layer symptoms. User flows should prioritize visible state, value risk, signing risk and safe escalation.

### Developer

Start with chain/RPC/transaction, contract/application, provider, Indexer and generated-reference cross-links. Developer diagnostics should preserve request, transaction and object identity across retries.

### Operator

Start with consensus/node, RPC ingress, Indexer readiness, Status and provider-health entries. Operator recovery must preserve signing safety, canonical ordering, checkpoints and evidence.

## Browse by severity

- `info` — expected or informational state.
- `degraded` — feature/service impaired but safer fallback remains.
- `blocked` — requested action cannot proceed.
- `value-risk` — funds/rewards/settlement/replay risk exists.
- `security-critical` — signer, authorization, equivocation or compromise risk.

When multiple entries appear relevant, start with the highest severity that matches the observed evidence.

## Browse by surface

Use the domain token as the primary surface filter:

`WALLET`, `CHAIN`, `RPC`, `TX`, `CONSENSUS`, `NODE`, `INDEXER`, `EXPLORER`, `SEARCH`, `ANALYTICS`, `STATUS`, `PAY`, `TOKEN`, `SWAP`, `BRIDGE`, `STAKE`, `REGISTRY`, `NAMES`, `IDENTITY`, `RANDOM`, `ORACLE`, `STORAGE`, `AI`, `RIGHTS`, `VERIFY`, `ARBITRATION`, `MESSENGER`, `NOTIFY`, `ATTENTION`, `APP`.

## Copy-safe diagnostic bundle

A support-ready diagnostic bundle should contain only the minimum non-secret evidence necessary to distinguish causes.

Recommended fields:

- stable troubleshooting ID, if known;
- environment/network name and chain ID;
- application/client/service name and version/build;
- UTC timestamp or time window;
- public account, contract or protocol object address/ID where relevant;
- transaction hash, block number, receipt state and finality state where relevant;
- payment/invoice/swap/bridge/job/proposal/object identifier where relevant;
- RPC method or route and sanitized response/error;
- service health/readiness result;
- canonical head/safe/finalized heights when relevant;
- Indexer cursor/checkpoint/rebuild state when relevant;
- concise reproduction steps;
- whether the action was read-only, signed, submitted, included, finalized, retried or replaced;
- sanitized logs with credentials and private payloads removed.

## Never include in diagnostics

Do not include:

- seed phrase or private key;
- raw passkey material;
- recovery secret;
- validator signing key or remote-signer secret;
- Engine JWT;
- bearer token, API secret, authentication cookie or unredacted authorization header;
- encrypted/private Messenger payload;
- private AI prompt, dataset or output unless disclosure is explicitly required and authorized outside ordinary support;
- unrelated Identity/private-profile data;
- full browser secure-store or credential exports.

If a diagnostic cannot be useful without one of these secrets, stop and escalate rather than disclose it.

## Support workflow

1. **Identify the symptom or stable ID.**
2. **Confirm environment/chain identity.**
3. **Identify the authoritative source** named in the relevant registry entry.
4. **Classify retry safety** before repeating any write.
5. **Collect the minimum copy-safe diagnostic bundle.**
6. **Follow ordered recovery steps and stop conditions.**
7. **Reconcile canonical state after recovery.**
8. **Escalate with the stable ID and sanitized evidence if unresolved.**

## Escalation paths

### User support

Escalate when the user cannot establish canonical state, an action may have moved value, recovery authority is unclear, suspicious approval/compromise is possible, or retry safety remains unresolved.

Provide the stable ID, environment, public identifiers, transaction/object identifiers and exact visible error text. Never provide secrets.

### Developer debugging

Escalate when RPCs disagree, transaction submission is ambiguous, runtime and generated reference disagree, contract/protocol behavior cannot be reconciled from canonical evidence, or a provider integration violates documented authority/retry rules.

Include reproducible inputs that are safe to disclose, relevant hashes/IDs, exact method/route, software version and canonical state observations.

### Operator incident

Escalate immediately for equivocation/signing uncertainty, quorum loss that persists beyond expected conditions, consensus/execution divergence, deep-reorg fail-closed state, remote-signer ambiguity, corrupted persistence/checkpoints, or evidence that canonical state cannot be established safely.

Do not restore liveness by lowering safety thresholds or deleting protection state.

## Stable deep-link contract for DOC-14

Later contextual documentation links may point directly to stable troubleshooting anchors. The preferred target shape is:

`/troubleshooting/<registry-page>/#trb-domain-nnn`

Each published entry should therefore expose a heading/anchor whose visible text contains the exact stable ID. IDs must never be reassigned.

Applications should deep-link to the shared registry entry rather than maintain a separate copy of retry/recovery guidance.

## Search/index expectations

420Docs search should make the following discoverable:

- exact `TRB-*` IDs;
- entry titles;
- common symptom phrases;
- affected application/protocol/service names;
- severity terms;
- relevant identifiers such as transaction, nonce, finality, bridge, passkey, quorum, Indexer, oracle and provider.

DOC-12 will add automated documentation validation around link integrity and required documentation structure. DOC-11 defines the content contract and discovery vocabulary.

## Quick routing table

| Symptom family | Start here |
| --- | --- |
| Wallet/account/signing/recovery | `wallet-account-authorization.md` |
| Chain/RPC/transaction/finality | `chain-rpc-transactions.md` |
| Validator/consensus/node/Engine | `consensus-validator-node.md` |
| Indexer/Explorer/Search/Analytics/Status | `indexer-explorer-search-analytics-status.md` |
| Payments/token/swap/bridge/stake | `value-movement-economics.md` |
| Shared protocols/providers/AI/storage/oracles | `shared-protocol-provider.md` |
| Genesis application-specific routing | `genesis-application-coverage.md` |

## Related documentation

- [Troubleshooting registry contract](registry-contract.md)
- [Troubleshooting entry template](entry-template.md)
- [DOC-11 roadmap](DOC-11-ROADMAP.md)
- [Developer documentation](../developers/index.md)
- [Generated reference](../reference/index.md)

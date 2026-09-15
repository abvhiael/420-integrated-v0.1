---
title: Genesis application troubleshooting coverage
audience:
  - user
  - developer
  - operator
category: troubleshooting
status: current
version: current
---

# Genesis application troubleshooting coverage

DOC-11.8 maps every frozen Genesis/testnet application manual to the shared troubleshooting registry built in DOC-11.1 through DOC-11.7. Application manuals remain task-oriented. Shared troubleshooting entries remain the canonical recovery surface where symptoms cross application boundaries.

The mapping rule is simple:

- reuse a shared `TRB-*` entry whenever the condition is fundamentally Wallet, chain/RPC/transaction, consensus/node, derived-service, value-movement, or shared-protocol/provider behavior;
- allocate `TRB-APP-*` only when the application introduces a distinct troubleshooting condition that cannot be represented safely by an existing domain;
- never create a second recovery procedure that conflicts with the owning application/manual or protocol documentation;
- keep 420 Gaming Protocol protocol-only and 420 Faucet testnet-only.

## Frozen application mapping

| Application | Primary troubleshooting coverage | Application-specific gap | Result |
| --- | --- | --- | --- |
| 420 Wallet | `TRB-WALLET-*`, `TRB-TX-*`, `TRB-CHAIN-*` | none | COVERED |
| 420 Explorer | `TRB-EXPLORER-*`, `TRB-INDEXER-*`, `TRB-CHAIN-*` | none | COVERED |
| 420 Search | `TRB-SEARCH-*`, `TRB-INDEXER-*` | none | COVERED |
| 420 Analytics | `TRB-ANALYTICS-*`, `TRB-INDEXER-*`, `TRB-CHAIN-*` | none | COVERED |
| 420 AppStore | `TRB-APP-001`, plus `TRB-REGISTRY-*`, `TRB-VERIFY-*` | catalogue/Registry disagreement needs an explicit app-level pointer | COVERED |
| 420 Verify | `TRB-VERIFY-*` | none | COVERED |
| 420 Notifications | `TRB-NOTIFY-*`, `TRB-STATUS-*` | none | COVERED |
| 420 Registry | `TRB-REGISTRY-*` | none | COVERED |
| 420 Names | `TRB-NAMES-*`, `TRB-REGISTRY-*` | none | COVERED |
| 420 Identity | `TRB-IDENTITY-*` | none | COVERED |
| 420 Arbitration | `TRB-ARBITRATION-*` | none | COVERED |
| 420 Swap | `TRB-SWAP-*`, `TRB-TX-*`, `TRB-ORACLE-*` where freshness applies | none | COVERED |
| 420 Bridge | `TRB-BRIDGE-*`, `TRB-ORACLE-*`, `TRB-TX-*` | none | COVERED |
| 420 Stake | `TRB-STAKE-*`, `TRB-CONSENSUS-*` | none | COVERED |
| 420 Governance | `TRB-APP-002`, plus `TRB-TX-*`, `TRB-REGISTRY-*` | proposal/vote/execution UI disagreement benefits from an application-specific index entry | COVERED |
| 420 AI | `TRB-AI-*`, `TRB-ORACLE-*`, `TRB-PAY-*` where escrow/settlement applies | none | COVERED |
| 420 Attention | `TRB-ATTENTION-*`, `TRB-NOTIFY-*`, `TRB-PAY-*` where rewards apply | none | COVERED |
| 420 Token | `TRB-TOKEN-*`, `TRB-REGISTRY-*`, `TRB-TX-*` | none | COVERED |
| 420 Status | `TRB-STATUS-*`, plus the owning service domain | none | COVERED |
| 420 Faucet | `TRB-APP-003`, `TRB-RPC-*`, `TRB-TX-*` | testnet-only cooldown/rate-limit/no-value semantics need an app-level entry | COVERED |

## Application-specific entries

### TRB-APP-001 — AppStore listing disagrees with canonical Registry or verification state

- **Audience:** user, developer
- **Surface:** 420 AppStore
- **Severity:** degraded
- **Authority source:** canonical 420 Registry state plus applicable 420 Verify evidence; AppStore catalogue/curation is presentation only.
- **Retry safety:** safe for read/refresh operations; state-changing publication retries are conditional on the original publication transaction/object state.

**What you see:** an application appears missing, stale, deprecated, differently versioned, or differently verified in AppStore than expected.

**Likely causes:** catalogue lag, Indexer lag, stale curation metadata, Registry version/deprecation change, or verification evidence updated independently.

**Safe diagnostics:** application/service ID, Registry version, AppStore entry/version, verification result, transaction hash if a publication/update was submitted, environment/chain ID.

**Recovery:**

1. establish canonical Registry state;
2. inspect relevant 420 Verify evidence;
3. treat AppStore metadata as derived catalogue state;
4. refresh/rebuild the catalogue or wait for index reconciliation;
5. do not change Registry state merely to make AppStore presentation match.

**Escalate when:** AppStore continues to present a version/deprecation/verification state that conflicts with current canonical Registry/evidence after catalogue/index recovery.

### TRB-APP-002 — Governance proposal/vote/execution display disagrees with canonical governance state

- **Audience:** user, developer, operator
- **Surface:** 420 Governance application
- **Severity:** degraded; `value-risk` when execution/treasury movement is involved
- **Authority source:** canonical governance contract/protocol state and canonical transaction/finality evidence.
- **Retry safety:** conditional for reads; unsafe for blind re-voting, proposal creation or execution retries.

**What you see:** the UI shows a proposal, vote, quorum, timelock or execution status that differs from another view or from the expected lifecycle.

**Likely causes:** derived/indexed lag, reorg/finality differences, stale electorate/proposal projection, pending transaction, or execution not yet final.

**Safe diagnostics:** proposal ID, voter/public address, transaction hashes, canonical proposal state, relevant block/finality level, UI/indexer cursor/version.

**Recovery:**

1. read canonical governance state directly;
2. reconcile vote/proposal/execution transaction receipts and finality;
3. treat the application view as derived presentation;
4. refresh/rebuild the derived view;
5. do not cast another vote or execute again solely because the UI appears stale.

**Escalate when:** canonical governance state is ambiguous, value-moving execution may have occurred, or multiple canonical endpoints disagree.

### TRB-APP-003 — Faucet request rejected, delayed, or appears inconsistent

- **Audience:** user, developer, operator
- **Surface:** 420 Faucet
- **Environment:** testnet only
- **Severity:** blocked
- **Authority source:** Faucet policy/state plus canonical testnet transaction state.
- **Retry safety:** conditional.

**What you see:** a Faucet request is rejected, rate-limited, accepted without an immediately visible balance, or appears to have succeeded twice/failed ambiguously.

**Likely causes:** 24-hour per-address cooldown, IP-rate limit, daily operator cap, abuse-control failure, Faucet hot-wallet depletion/unavailability, RPC delay, pending transaction, or derived balance/index lag.

**Safe diagnostics:** testnet chain ID, public recipient address, Faucet request/result ID if exposed, transaction hash if issued, request timestamp, public cooldown/rate-limit reason, Faucet/status health.

**Recovery:**

1. confirm this is the supported testnet, never mainnet;
2. check the documented cooldown/rate-limit/daily-cap condition;
3. if a transaction hash exists, reconcile canonical testnet transaction state before requesting again;
4. refresh balance through canonical testnet RPC when derived views lag;
5. retry only after the original request is known not to have produced a transfer and policy permits a new request.

**Stop/escalate when:** a request appears to have transferred value more than once, the Faucet exposes mainnet credentials/endpoints, or policy state cannot establish whether another request is safe.

Testnet Faucet `$420` has no monetary value and never participates in mainnet economics.

## Protocol-only exclusion

420 Gaming Protocol remains a `GENESIS_PROTOCOL`, not a standalone user application. Its troubleshooting stays in protocol/developer integration documentation and shared Wallet/capability/session/transaction domains. DOC-11 does not invent a `TRB-APP-*` Gaming application entry merely to make the matrix look symmetrical.

## Manual cross-link rule

Each Genesis application troubleshooting page should point into the appropriate shared registry rather than re-specifying the same recovery procedure. Application pages may summarize the first safe action, but the `TRB-*` entry owns the stable symptom/retry/recovery identity.

Where a symptom spans layers, cross-link in authority order. Examples:

- AppStore mismatch → Registry/Verify first, catalogue second;
- Explorer/Search/Analytics mismatch → canonical chain/RPC first, Indexer second, presentation third;
- Swap/Bridge mismatch → canonical transaction/protocol settlement/finality before UI status;
- AI/Attention provider issue → protocol job/proof/settlement state before provider dashboard;
- Notifications/Status issue → owning canonical protocol state before delivery/health presentation.

## DOC-11.8 result

All 20 frozen Genesis/testnet application manual targets have an explicit DOC-11 troubleshooting path. Three application-specific index entries (`TRB-APP-001` through `TRB-APP-003`) cover the only gaps that are better represented at the application layer than in an existing shared domain. 420 Gaming Protocol remains correctly protocol-only, and 420 Faucet remains explicitly testnet-only.

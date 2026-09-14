---
title: DOC-11 troubleshooting coverage audit
audience:
  - user
  - developer
  - operator
  - architect
category: troubleshooting
status: current
version: current
---

# DOC-11 — Troubleshooting coverage audit

DOC-11.10 audits the ecosystem-wide troubleshooting registry after completion of DOC-11.1 through DOC-11.9.

## Audit result

**PASS, pending final branch reconciliation and exact-head qualification before merge.**

The DOC-11 branch now contains the registry contract, reusable entry template, seven domain/application registry surfaces, Genesis-application coverage mapping, and the search/diagnostics/support workflow. All 20 frozen Genesis/testnet manual targets have an explicit troubleshooting route. The protocol-only 420 Gaming Protocol remains outside the standalone application matrix and 420 Faucet remains explicitly testnet-only/no-value.

## Stable-ID coverage

Published troubleshooting IDs use the locked `TRB-<DOMAIN>-<NNN>` format. The registry uses the reserved domain namespaces established by DOC-11.1, including Wallet, Chain, RPC, Transaction, Consensus, Node, Indexer, Explorer, Search, Analytics, Status, Pay, Token, Swap, Bridge, Stake, Registry, Names, Identity, Randomness, Oracle, Storage, AI, Rights, Verify, Arbitration, Messenger, Notifications, Attention and application-specific `APP` cases.

The phase audit found no intentional ID reassignment: an ID identifies one condition and is not reused as an alias for another condition. Application-specific IDs are limited to cases that are not safely represented by a shared domain entry.

## Entry-contract coverage

Registry entries consistently expose the fields required by the DOC-11 contract:

- stable ID and title;
- audience and affected surface;
- observable symptom;
- severity;
- authority source;
- likely causes;
- retry safety;
- safe diagnostic evidence;
- ordered recovery;
- escalation/stop conditions;
- cross-links or owning documentation context where applicable.

The registry remains descriptive. It does not invent runtime errors, ABI selectors, contract addresses, RPC methods, protocol authority, provider attestations or deployment evidence.

## Authority audit

**PASS.** The troubleshooting system preserves canonical-versus-derived authority throughout:

- canonical chain/protocol state outranks Explorer, Search, Analytics, Status, Notifications and Indexer presentation;
- contract/protocol state outranks Wallet/dApp assumptions;
- approved network/deployment/Registry evidence outranks localhost examples, plans and unverified configuration;
- runtime-emitted errors outrank prose descriptions;
- DOC-10 generated reference describes machine-derived surfaces but does not create authority;
- provider-local success/failure remains operational evidence until accepted by the owning protocol.

Derived-service recovery repairs or rebuilds the derived layer rather than mutating canonical state to make presentation agree.

## Retry and idempotency audit

**PASS.** State-changing and value-changing cases explicitly classify retry safety or require canonical reconciliation before retry. The registry repeatedly enforces the core rule that a timeout, disconnect or stale UI is not proof that a write failed.

High-risk flows preserve original identities such as transaction hashes, nonces, payment IDs, swap intents, bridge message IDs, protocol object IDs and AI/provider job IDs before any resubmission or compensating action.

Blind retries are prohibited where they could duplicate payments, settlements, bridge messages, governance actions, jobs, signed transactions or other state transitions.

## Finality and value-risk audit

**PASS.** Chain, payment, swap, bridge, stake and derived-service entries distinguish submission/inclusion from safe/finalized state where relevant. Cross-chain recovery requires source/destination identity, proof and finality checks rather than UI completion alone.

Value-risk and security-critical entries introduce explicit stop/escalation conditions instead of encouraging repeated writes.

## Consensus/operator safety audit

**PASS.** Validator/node troubleshooting preserves safety over liveness:

- quorum thresholds are not lowered to restore progress;
- signing/slashing-protection state is not deleted to clear conflicts;
- duplicate signer identity is a stop condition;
- suspected equivocation stops signing;
- Engine or consensus/execution divergence is reconciled against canonical evidence rather than force-synchronized to a preferred view.

## Secret-safety audit

**PASS.** Troubleshooting and support workflows prohibit collection or disclosure of seed phrases, private keys, passkey private material, recovery secrets, validator signing keys, Engine/JWT credentials, bearer/API secrets, session credentials and unredacted authentication headers.

The DOC-11.9 diagnostic bundle is copy-safe by design and requests only the minimum non-secret identifiers needed to distinguish causes.

## Genesis application coverage

**PASS.** All 20 frozen Genesis/testnet application manual targets map to shared troubleshooting entries or the limited `TRB-APP-*` cases:

- shared registries own stable recovery identity;
- application manuals may summarize first actions but do not fork recovery procedures;
- AppStore catalogue disagreement, Governance presentation disagreement and Faucet request-policy ambiguity use the dedicated application-level entries;
- 420 Gaming Protocol remains protocol-only;
- Faucet remains testnet-only and carries no monetary value.

## Search, navigation and support audit

**PASS.** Users can enter DOC-11 by exact `TRB-*` ID, visible symptom, audience, surface or severity. The troubleshooting landing page links every registry family, the Genesis application matrix and the search/diagnostics/support workflow.

Stable heading anchors support future DOC-14 contextual links using `/troubleshooting/<registry-page>/#trb-domain-nnn` without changing the permanent troubleshooting ID.

## Environment and provenance audit

**PASS.** DOC-11 does not promote local/devnet examples, planned addresses, unverified deployment records, derived provider claims or stale presentation into canonical production truth. Environment identity must be established before address/service recovery actions.

## Phase closeout

DOC-11 satisfies its documentation exit condition at the content level. A user, developer or operator can begin from a symptom or stable troubleshooting ID, identify the relevant authority source, collect non-secret evidence, understand retry risk, follow ordered recovery and escalate with useful context.

Final merge remains gated by the monolithic phase policy:

1. reconcile the DOC-11 branch with current `main`;
2. re-run qualification on the reconciled exact head;
3. require exact-head 420Docs Qualification and 420 Integrated Qualification to be green;
4. merge PR #230 once.

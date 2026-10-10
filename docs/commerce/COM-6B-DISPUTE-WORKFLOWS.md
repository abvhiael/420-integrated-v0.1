# COM-6B — Canonical Market dispute and independent Arbitration handoff

**Canonical parent roadmap:** `docs/commerce/COM-1-ARCHITECTURE-AND-ROADMAP.md`, COM-6 Merchant operations. COM-6B is a proposed implementation work package; it does not replace, renumber or alter the COM-6 exit criteria.

**Audit branch:** `audit/420commerce-com-2-upstream-adaptations`, PR #594 (draft). **Executable candidate SHA:** `938a35772ea70b684a8e38e456cc4d96544f6199`. Current implementation and tests require exact-SHA Level 1 completion before a PASS disposition. No repository-wide Level 3 requested.

## 1. Authority matrix

| Authority | Canonical action | Commerce boundary |
| --- | --- | --- |
| 420Market V1 `OrderRegistry420` | Actual buyer or seller calls `disputeOrder(orderId,disputeHash)` only from PAID/FULFILLED; order becomes DISPUTED | Prepare signed merchant request and exact Wallet intent; verify finalized order/commitment; never mutate Market directly |
| 420Arbitration `ArbitrationCaseRegistry420` | Open case; submit evidence; appeal with bound claimant/respondent, policy and deadlines | Optional, independently Registry-verified case action and Wallet confirmation only |
| 420Arbitration `ArbitrationRulingRegistry420` | Authorized resolver submits ruling, finalized after appeal window | Read finalized case/ruling from approved code; Commerce cannot resolve, alter policy, force finalization or create fictitious rulings |
| Governance / Pay / Market reporter | Independently approves and executes any money return or other bounded remedy | Arbitration ruling **never** grants Commerce authority to transfer money, overwrite canonical order/payment records or execute a remedy |

The canonical Market domain is `keccak256("420/arbitration/domain/market/v1")`; origin component `keccak256("420/component/market/v1")`. These correspond to retained `ArbitrationGenesis420.t.sol` semantics, not arbitrary user input. No custody, privileged reviewer shortcut, unfrozen address or new smart contract is introduced.

## 2. Implemented repository-side workflows

**Market dispute request.** Migration `commerce/sql/004-dispute-requests.sql` retains store-scoped dispute requests and exact evidence commitment; POST signed `.../operations/orders/{attemptId}/dispute` checks live controller, canonical seller, permitted Market status, idempotence and conflicting evidence. The returned `OrderRegistry420.disputeOrder` intent cannot sign or submit for another party. `WalletSession.sendMarketDispute` checks the approved manifest, final block, runtime code, original seller and state, calldata, chain/account and on-chain simulation immediately before an explicit Wallet transaction. Broadcast remains UNFINALIZED.

**Status/reconciliation.** Signed GET `.../operations/disputes` reads the finalized Market order and verifies the exact dispute commitment (including separately identifying a subsequently refunded order). A pending request without canonical DISPUTED state is not a dispute success. Forged or mismatched finalized commitments fail closed.

**Optional approved Arbitration path.** `commerce/src/arbitration.mjs` requires a manifest-pinned `420/service/arbitration/v1` ProtocolRegistry publication with active, exact version, metadata manifest/dependency/interface commitments, full runtime code hashes and the distinct Router→Policy/Case/Ruling and Case→Policy/Ruling and Ruling→Case graph. All reads use the SAME finalized RPC block. Missing, stale, inactive or mismatched service identity fails closed; no default/fabricated addresses are substituted. The separate signed HTTP/SDK methods are:

- `POST .../operations/orders/{attemptId}/arbitration/prepare`: seller-only, only after canonical Market DISPUTED and matching claim commitment; verifies active governance policy, snapshots requested remedy commitment in durable SQLite v5 and returns canonical `openCase` Wallet intent.
- `POST .../operations/orders/{attemptId}/arbitration/bind`: requires a **real finalized Case ID**, reads canonical CaseRegistry and matches claimant/respondent, domain, origin component/order ID, claim commitment and requested remedy. A different second case/reason is rejected; Commerce never invents an on-chain case ID.
- `POST .../operations/orders/{attemptId}/arbitration/evidence`: checks stored case and claimant, round OPEN, evidence deadline and nonzero commitment; returns independent CaseRegistry intent.
- `POST .../operations/orders/{attemptId}/arbitration/appeal`: checks RULED state, snapshotted appeal window/cap and original claimant; returns independent CaseRegistry intent.

`WalletSession.sendArbitrationAction` revalidates the Registry publication, profile, code hashes and immutable graph, exact Market origin/case, active domain policy, case parties and state/deadlines where applicable, and simulates the action before requiring an explicit Wallet transaction. It reports only an unfinalized broadcast. Case IDs must subsequently be verified through the signed bind route. The dashboard offers case preparation, explicit signing, ID binding, evidence and appeal controls when an approved Arbitration manifest exists; otherwise those actions remain unavailable and clearly labeled.

**Read-only lifecycle.** The signed disputes view compares the stored request to finalized Market state, optional canonical case identity, case round/state and current-round independent RulingRegistry record. RULED is distinct from FINALIZED, and a finalized ruling is distinct from an executed remedy. No buyer identifying data is stored beyond the canonical on-chain party Wallet address.

## 3. Deployment manifest extension (optional, operator-approved)

The backend and browser manifests may include `arbitration` with the canonical service ID, chainId, integer version, `router:{address,codeHash,verified:true}`, `dependencies:{policies,cases,rulings}` with their individual verified addresses and runtime code hashes, and nonzero `manifestHash`, `dependencyRoot`, `interfaceHash` matching ProtocolRegistry profile. The entire manifest remains protected by the existing operator-approved SHA-256 gate. No case-opening action is enabled without both this pin and fresh, Registry-proven on-chain identity.

There is **no blanket Arbitration authority** and the UI cannot sign governance, resolver or financial actions. For evidence privacy, submit commitments only; do not upload raw private evidence into public chain data.

## 4. Qualification and tests

- `commerce/test/com6b-dispute.test.mjs`: tenant/seller authorization, Market eligibility, invalid evidence, idempotence and conflict, finalized Market reconciliation, approved Arbitration case binding, requested remedy, appeal/finality and forged-case/ruling negative paths.
- `commerce/test/arbitration-adapter.test.mjs`: finalized Registry service, code/graph, case/ruling read and service substitution/alias/deprecation rejection.
- `commerce/web/test/arbitration.test.mjs`: Wallet-approved Arbitration identity and transaction preflight; rejects inactive publication, wrong chain/claim/target/Market state.
- `commerce/test/http-sdk.test.mjs`: real signed HTTP/SQLite dispute endpoint, IDOR and absent-service fail closed.
- Existing service, browser, SDK, Market/Pay regression and security workflows apply to this exact executable SHA.

**Level 1** is complete only when the required exact-SHA workflow results pass and are recorded. **Level 2** retained Commerce/Market/Arbitration milestone evidence is required when the optional service is production-equivalent and related COM-6 work converges. **Level 3** remains reserved for app-phase closeout; Solidity owns full Foundry and Genesis owns address/manifest authority, without duplicate complete Foundry runs.

## 5. Outstanding external and release-stage gates

1. Approved, deployed `420/service/arbitration/v1` with active governance domain policy, exact ProtocolRegistry publication/profile and qualified manifests across browser/backend.
2. Live Wallet submission and finalized, chain-authentic Market `OrderDisputed`, Arbitration `CaseOpened`, independent evidence, ruling/appeal/finalization and read/reorg/replay evidence.
3. Independent authorized resolvers and an approved origin-protocol remedy adapter. Existing Arbitration cannot custody funds or mutate Market/Pay; a ruling alone does not satisfy financial or fulfilment remediation.
4. Operational event indexing, reorg resynchronization, evidence confidentiality/retention, incident recovery and testnet E2E acceptance where required by the broader COM-8 deployment roadmap.
5. PR #594 still accumulates other COM-6 requirements (Notifications, credentials/names, full analytics) and is not merge-ready solely because COM-6B code is implemented.

**Completion language:** repository-side handoff and independently verified optional-case path may be Level-1-qualified; live Arbitration/deployment/remedy acceptance is a separate real-world gate. Never claim a signed transaction, created case, returned funds or final ruling based only on an API intent, mock or unverified external service. Next canonical work package after COM-6B is COM-6C Notifications, but do not erase the external COM-6B blockers.

## COM-6B exact-SHA Level 1 + app-specific Level 2 evidence — 2026-10-09

**Executable implementation SHA:** `938a35772ea70b684a8e38e456cc4d96544f6199`. **PR:** #594, branch `audit/420commerce-com-2-upstream-adaptations`; **PR base:** `41d173dbcfbeb8299f54f22e7c049f1fec20336d`; **current main as independently rechecked:** `f8bbb62e1cdfe68cff25261fd4a036db1840a15c` (main has advanced; no branch/main reconciliation yet). All applicable targeted workflows completed at this single implementation SHA:

| Workflow | GitHub Actions run | Conclusion |
| --- | --- | --- |
| Commerce service fast qualification (Level 1: service, signed API, SDK/Indexer, SQLite v5, adversarial authorization, optional Arbitration service/case/ruling verification) | [37989067827](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37989067827) | **PASS** |
| Commerce merchant builder fast qualification (Level 1: Wallet, browser UX and responsive/accessibility regressions) | [37989068342](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37989068342) | **PASS** |
| Commerce upstream contracts (retained Market/Pay and funded-refund Foundry plus retained Arbitration Genesis and deployment-binding integration, app-scoped Level 2) | [37989068080](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37989068080) | **PASS** |
| Solidity Contracts (affected classification/build check, not claimed as global Level 3 full inventory) | [37989067983](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37989067983) | **PASS** |
| Commerce governed Pay refund qualification (affected existing Pay governance/source checks) | [37989068370](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37989068370) | **PASS** |

420Pay historical audit workflow [37989068389](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37989068389) was **SKIPPED by design** for the Commerce branch; it is **not passing COM-6B evidence** and its frozen PAY-AUDIT-6 identity/release requirements remain intact on canonical Pay audit branches. The exact candidate has 5 passed applicable workflows, zero failed applicable workflows, and zero pending applicable workflows. Early failed/cancelled tests on earlier SHAs are superseded, not counted green.

**Security and invariants qualified:** independent Market buyer/seller eligibility and exact evidence hash, per-store authorization/IDOR, serialized request idempotence and conflict/replay denial, verified Registry-published Arbitration service/version/runtime code/dependency graph, case parties/domain/origin/remedy/round binding, active policy and exact appeal/evidence deadlines, no forged case/ruling/finality, no unapproved Wallet signing, noncustodial case/ruling reads, and no automatic financial/Market remedy. App-scoped Level 2 additionally exercised retained canonical Market/Pay/Arbitration Solidity integration without duplicating repo-wide Foundry.

**COM-6B disposition:** **repository-side implementation COMPLETE; Level 1 PASS; focused app Level 2 PASS.** This is not live/testnet acceptance. The approved Arbitration service deployment, active governance policy, independently authorized resolver, real Wallet transactions and finalized event receipts, protocol-origin remedy enforcement, live reorg/adversarial recovery, frozen deployment identities and production-equivalent acceptance remain separate gated deployment/integration work. In particular, no actual user dispute or case was opened on a live chain; no ruling or fund transfer was executed. The overall canonical COM-6 Merchant operations roadmap remains INCOMPLETE because COM-6C Notifications, COM-6D Identity/Names, and COM-6E full analytics and phase qualification remain.

**Level 3:** deliberately not run until app-phase closeout. The phase merge requires reconciliation against then-current main and one accumulated exact merge-candidate SHA; Solidity owns full Foundry and Genesis owns address/namespace/manifest checks without duplicating Foundry.

**Next planned COM-6 work package:** COM-6C Notifications (not a renumbered canonical roadmap step). Canonical next top-level step after COM-6 is COM-7 Security/ops.

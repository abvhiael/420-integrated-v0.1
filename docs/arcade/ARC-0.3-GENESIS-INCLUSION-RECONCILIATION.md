# ARC-0.3 — Genesis inclusion reconciliation and authorization gate

**Disposition:** RECONCILIATION PREPARED / FORMAL GENESIS AMENDMENT NOT AUTHORIZED. This is not a declaration that 420Arcade is in the frozen Genesis application decision.

**Depends on:** ARC-0.1 exact-SHA Level 1 `c060503d168d044848e6957862966dcbe983072c` (evidence `0c05db1ab31ac86239a1045682bd6a5051dddd85`, PR #727) and ARC-0.2 exact-SHA Level 1 `9af076fe18e86bd4e88a920032ef9c23245e2e37` (evidence `10e4783c99c5ae3f0dced23c1f9fdc0fc0e7d3eb`, PR #731). Both PRs are still open and stacked at discovery time. This branch descends from #731's evidence commit. Do not represent these as merged to main.

**Inspected main:** `ececfbafb16bf728c7ca5d23f9c33dfcd9df8602`. The intervening changes inspected in the main divergence concern LIFTd PT-11, not the existing Genesis application registry.

## 1. Canonical source of authority

- `config/genesis-applications.json`: `decision_id = GENESIS_APPLICATION_DECISION_1`, `status = FROZEN`, `schema = 420-genesis-application-decision-v9`.
- 420 Gaming Protocol is a canonical existing Genesis protocol. This alone does **not** grant every new consumer application Genesis status.
- `docs/GENESIS-DAPPS.md`, `config/protocol.json`, architecture/contract inventory and generated Genesis/checksum references must be reconciled by their owning processes if an amendment is approved.
- No unilateral edit to the frozen registry, frozen-address maps, genesis verifier, protocol manifest, package generated assets or protected deployment authority may be used to manufacture approval.
- A user-approved *game-content roster* is not equivalent to an authorized amendment of frozen Genesis infrastructure. The authoritative authorization instrument, approver identity, decision scope, effective date, schema/version effect and affected generated artifacts must be evidenced before changing canonical Genesis files.

## 2. Requested change, for approval

Propose inclusion of **420Arcade** as an optional-wallet, guest-playable user-facing Genesis application consuming the existing Gaming Protocol. No new Genesis contracts or reserved addresses are proposed at ARC-0.3. If competent governance approves, the registry class and exact purpose must be reviewed against existing enum/class and verifier constraints rather than invented.

The proposed arcade launch roster is exactly eleven game titles: Kush Crush; 420Colouring Book; 420Buddy; Bong Breaker; Baked Invaders; Puff-Man; Grasshopper; Roach Run; High Climb; Where's Dave?; Mad Bud Delivery.

**Invariant:** Core gameplay wallet-free, no pay-to-win, no chain/network dependency for guests, no unauthorized contract/operator powers or verified rewards.

## 3. Approval-gated transition

| Gate | Evidence | Present disposition |
|---|---|---|
| A. Candidate scope ratification | Eleven-game ARC-0.2 architectural contract and qualified evidence | Available on stacked ARC PRs, not yet merged |
| B. Genesis decision authority | Signed/traceable authorization under applicable governance, with accountable approver and explicit amendment permission | **MISSING — BLOCKING** |
| C. Registry amendment | Approved frozen registry diff, version/schema treatment, exact app class/purpose | **NOT AUTHORIZED** |
| D. Canonical references | Recomputed/validated Genesis inventories, generated references, checksums and owners after authorization | Pending B/C |
| E. Security/deployment | Scope/finality/authority verification and separate live testnet onboarding evidence | Future implementation and ARC-TN |
| F. Rollout | Approved release gates and incident rollback controls | Future release acceptance |

Never mark gates B/C/D complete merely because this proposal is committed or CI is green. Do not silently amend `GENESIS_APPLICATION_DECISION_1`.

## 4. Conflict analysis and compatibility

- 420Arcade is distinct from the canonical shared **420 Gaming Protocol** and from the established four game references (High Country, The Green Road, Budtender, Smoke & Chrome). It uses canonical game-scoped SDK interfaces, rather than creating an alternate GameRegistry/Identity/Entitlements/Claims protocol.
- The eleven proposed game namespace strings and deployed operator accounts are not assigned by this document; later ARC-0.4 and GP-17 manifest qualification must avoid collisions and ensure canonical scope. Do not preempt that work here.
- It is inappropriate to copy Unity/C# Mad Buds source art or runtime into 420Arcade without approved production exports and rights. This remains ARC-2 scope.
- Existing frozen-address and production contract ownership stays unchanged.
- PR merge order: qualify and merge #727 first, then reconcile #731 against main and merge, then reconcile this PR. A stacked PR shall not bypass prior evidence or assert main already contains it. Main divergence must be inspected at each merge boundary.
- CI authorization at ARC-0.3 is limited to **proposal integrity**, **no unauthorized frozen-input edits**, and **retention of parent certificates**. It is **not** an authorization to insert an app in Genesis.

## 5. Completion contract and blockers

**Locally executable reconciliation:** inventory existing frozen decision and cross-references; document the precise candidate inclusion, dependency/authority boundaries, collision risks, proposal and approved sequence; verify fail-closed absence of an unauthorized registry edit; retain ARC-0.1/0.2 certificates; scoped Level 1 proposal-integrity tests.

**External decision:** governance must provide or identify actual authorization allowing a frozen Genesis decision amendment. No such authorization has been established in the inspected repository. Until verified, **ARC-0.3 overall exit status remains BLOCKED_ON_GENESIS_AUTHORIZATION**, even if all local proposal-integrity tests pass. Do not advance to ARC-0.4 on the strength of a green proposal verifier alone.

**Live acceptance:** real on-chain game namespaces, testnet operators/addresses, finalized contract receipts and independent economic/release approvals belong to the canonical testnet/production ledger (ARC-TN), not as simulated proof in this step. Authorization of a Genesis amendment is a separate governance gate, not merely a testnet deferral.

**Qualification:** Level 1 for scoped reconciliation evidence, and no Level 2 or Level 3 globally. A green CI run qualifies only the stated limited scope. Preserve exact-SHA runs and jobs before issuing a durable certificate that describes any outstanding governance blocker accurately.

**Next only after authorization:** apply the formally approved Genesis decision and reconcile affected canonical references under owning verifiers; otherwise the next action remains procurement/recording of authorization for ARC-0.3 itself.

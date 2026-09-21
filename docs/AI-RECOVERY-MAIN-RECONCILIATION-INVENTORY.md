# AI-RECOVERY to main: pre-reconciliation inventory

Status: INVENTORY ONLY; no merge attempted or conflict resolution certified. Snapshot recorded 2026-09-20 America/Regina (GitHub commit timestamps may be 2026-09-21 UTC).

## Immutable reference commits and preservation

- `main`: `1fea2ae8a68c6f4eb1b7aec9a0ffd1bb4e4f745e` (merge of PR #362).
- `ai-compute-recovery-v1`: `ffeee5e7b59993d5c113b817547524750afc3b17` (roadmap refresh; PR #348 draft).
- Common ancestor: `7949ae80d34eb605772bc5c94971a8827581dd0d`.
- Backup of recovery: `backup/ai-recovery-pre-main-reconcile-20260920` created at `ffeee5e7b59993d5c113b817547524750afc3b17`.
- Backup of main: `backup/main-pre-ai-reconcile-20260920` created at `1fea2ae8a68c6f4eb1b7aec9a0ffd1bb4e4f745e`.
- Working inventory branch: `ai-recovery-main-reconciliation-20260920` created from the recovery snapshot; it is not the original PR branch or main.
- Backups are repository refs, not independent off-site archives. Preserve them until after confirmed integration. No force push or branch deletion.

GitHub's ahead/behind comparison as of this snapshot reported recovery 206 commits ahead of and 905 commits behind `main`. The large comparison includes many other applications; do not discard their work when importing AI changes. Both branch snapshots must be refreshed before any later integration.

## Confirmed overlapping modifications: review before merge

| Path | `main` at snapshot | Recovery at snapshot | Resolution requirement |
| --- | --- | --- | --- |
| `.github/workflows/contracts-foundry.yml` | Blob `dc9bc7e421410944e08f0e153ab716bdd5ece617`: PR runs full source/test inventory in 16 shards; `cancel-in-progress: false` | Blob `245d10191ea3900613ba8968c85a7d9652c78358`: older monolithic/scoped workflow and `cancel-in-progress: true` | Preserve current main 16-shard qualification; include new AI test inventory and any separate AI-scoped workflow. Never replace main's broad gates with older scoped checks. |
| `contracts/config/genesis-canonical-addresses.json` | Blob `2041b967e158de6d031a653b28c7c8cd578ca85d`; `protocol-registry` points to `0x0000000000000000000000000000000000000422`; smart-account factory at `0x...0420` | Blob `a5fc5a2c803bbaf526cbf97528e0a9be8643a916`; `protocol-registry` points to `0x0000000000000000000000000000000000000434`; AI legacy anchors at `0x...042f`–`0x...0433` | Major canonical-address divergence: reconcile against latest authoritative system map, Genesis freeze and occupied allocations, not by choosing all of either file. Verify compatibility and run collision/manifest tests. Do not activate AI deployments or change frozen addresses by a blind merge. |

## Additional affected shared surfaces requiring deliberate inspection

The recovery-side comparison against main includes changes to `contracts/config/genesis-dapp-contract-map.json`, `contracts/src/ai/AIJobManager.sol`, `contracts/src/ai/AIJobEscrow.sol`, `contracts/src/ai/AIProviderRegistry.sol`, `contracts/forge-std/Test.sol`, `420-indexer/sql/005-genesis-state-views.sql`, `developer-hub/schema/network-manifest.schema.json`, `developer-hub/src/network-discovery.mjs`, `scripts/verify-genesis-canonical-addresses.py`, and `wallet/web/core/{capabilities,capability-management,session-execution,session-management}.js` and associated tests/config. Determine which were also changed since the common ancestor on main before classifying any of these as true merge conflicts. The available reverse comparison lists a large, truncated subset of main-only changes and does not prove an exhaustive overlap inventory.

Recovery-added AI/Compute Solidity, provider/API/web source, AI tests and dedicated workflows also need dependency/API compatibility checks with current main, even if Git reports no textual conflicts. In particular check Vault interfaces, canonical address resolution, global Foundry test discovery, deployment permission boundaries, and Wallet/indexer cross-application behavior.

## Required next action

Use a checkout or a verified three-way merge based on current live refs; enumerate the actual conflict list and per-file base/ours/theirs changes. Resolve each while retaining new main work. Run comprehensive integration and the new `AINativeSettlementRoutes420.t.sol` and `native-settlement-reconciliation.test.ts` suites on the exact combined SHA. PR #348 remains draft/unmerged and paid AI remains disabled until its independently required gates are satisfied. This inventory is NOT a conflict-free merge attestation or CI qualification.

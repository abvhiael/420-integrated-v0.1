# AI-RECOVERY — frozen-address reconciliation blocker

Status: OPEN, NOT MERGE-QUALIFIED. This note applies to `ai-recovery-main-reconciliation-20260920`. It does not reassign any frozen Genesis address, deploy a contract, or approve live paid AI.

## Sources of truth and confirmed mismatch

- `contracts/config/system-addresses.json` and `config/system-addresses.json` freeze `AIProviderRegistry=0x042f`, `AIModelRegistry=0x0430`, `AIJobManager=0x0431`, `AIJobEscrow=0x0432`, `AIReputationRegistry=0x0433`, and `ProtocolRegistry=0x0434` under Step 6.2. `config/ai-genesis.json`, `contracts/config/deployment-manifest.json`, and the existing AI fixtures use the same AI assignments.
- The retained `main` `contracts/config/genesis-canonical-addresses.json` assigns `TokenFactory420=0x042f`, `AIRouter420=0x0430`, `ResourceRouter420=0x0431`, `ComputeRouter420=0x0432`, `TreasuryRouter420=0x0433`, `VaultRouter420=0x0434`. These are occupied by the frozen predeploys above. It also assigns `ProtocolRegistry=0x0422` where the system map freezes `DevelopmentTreasury`, and `SmartAccountFactory420=0x0420` where it freezes `RewardController`.
- Changing `AIJobManager` fixture from `0x0431` or `AIJobEscrow` fixture from `0x0432` to match the retained canonical router entries would cause the fixture to impersonate a different frozen contract. Do NOT do so. Existing fixture addresses are consistent with Step 6.2, but fixture deployment by `vm.etch` is NOT evidence of actual chain deployment.

## Applied fail-closed guard

`scripts/verify-ai-genesis-reconciliation.py` compares both system maps, deployment manifest, predeploy plan, AI Genesis interfaces, and every canonical address against its frozen occupant. `.github/workflows/ai-genesis-reconciliation.yml` runs the check for relevant pull request changes. It is expected to FAIL until the incompatible canonical-address entries are reconciled by the designated Genesis authority. This does not replace the main 16-shard Solidity check.

## Required resolution before a merged Genesis map or enabled AI deployment

1. Obtain an explicit architecture decision for the overlapping `main` canonical anchors. Preserve all frozen Step 6.2 system allocations and the existing AI compatibility interfaces. Non-system implementation/adapter/router contracts must use registry resolution or an independently approved free address; do not assign an already-frozen address or infer an unapproved replacement.
2. Change `contracts/config/genesis-canonical-addresses.json` through a reviewed, explicit migration once that decision is approved. Reconcile Wallet and Developer Hub discovery/address manifests and verify every canonical anchor against the frozen system map. Do not replace the two immutable backup snapshots.
3. Keep AI web writes off and reject live provider or payout actions unless chain ID, deployment manifest, runtime code hash and authenticated Registry bindings independently agree. No config file alone is deployment proof.
4. Run `python scripts/verify-ai-genesis-reconciliation.py` and the main canonical, system-map, deployment/predeploy, Wallet/Developer Hub, native settlement and 16-shard Solidity checks on the same post-merge commit. Record exact SHA and workflow IDs before marking this gate done.

Until then, the retained main canonical map and frozen system map cannot both be treated as an internally consistent allocation. PR #363 and original recovery PR #348 remain blocked from a qualified final merge; the reconciliation working branch is for correcting these conflicts without rewriting history.

# RESOURCE-AUDIT-8A.2 — C8 final integration qualification

Status: **FINAL CANDIDATE — qualification pending**.

Baseline main: 0ba12e392e2930536fc37cbcf2821ef9583e75ba. Original PR #1423 already merged at 41e99bb1028bc40c890921762d253edecad8a987. Follow-ups #1427, #1428, #1430 and #1431 merged. See [consolidated evidence](420RESOURCE-8A2-qualification/manifest.json) and [C7 final CI](420RESOURCE-8A2-qualification/final-ci.json).

GitHub comparisons from qualified contract source 6837f137229ff0d9496d2d74d1cb0bea50680de5, SDK source b9e3e9acc1c66fa1d0cd5d44cffee7a20497977e and Indexer source 405ea76eb57e6b4fdf11eb04730ca5657cb457be to baseline main show all are ancestors, and no subsequent Resource Solidity, contract test or Foundry configuration changes. SDK and Indexer source and tests are retained. The Indexer dependency-root ABI order was checked against ResourceDeploymentBinding420.t.sol: 21 addresses followed by 19 runtime hashes excluding external CapabilityRegistry and GovernanceTimelock, whose identities are separately verified.

Final gate: same exact PR head must pass Resource core, Storage, runtime/SDK, security (ci 50000 fuzz/2048 sequences/depth 256; hardening 100000 fuzz/4096 sequences/depth 384; zero unexpected reverts and zero high-severity Slither findings), compiler reconciliation, Indexer regression and mandatory PostgreSQL Resource tests (no skips). Security timeout 60 minutes. No threshold reduction, policy activation, production authorization or accounting changes are authorized. Archive successful exact-head results before closeout merge.

Explicitly retained dispositions: production policy approval GOV-PRE-RESOURCE-COLLATERAL (all four parameters null, acceptingNew false); deployed SDK integration and live deployment/Indexer proof RESOURCE-AUDIT-9; session discharge RESOURCE-AUDIT-8A5; inherited Token V3 authority manifest discrepancy external Genesis V4 dependency, not Resource defect. No testnet, Genesis or production readiness claim.

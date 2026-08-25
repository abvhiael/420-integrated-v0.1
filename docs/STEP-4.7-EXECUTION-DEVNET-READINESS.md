
# Step 4.7 — Real Execution Devnet Packaging and Public-Testnet Readiness

Status: **PACKAGED; PUBLIC-TESTNET GATE NOT YET PASSED**

Added:
- candidate post-Merge 420 execution genesis generated from the frozen allocation ledger;
- node420 exact Geth v1.17.5 verification;
- node420 execution-datadir initialization;
- live fourtwentyd Engine fork-choice sink;
- authenticated live Engine smoke script;
- fifteen node420/fourtwentyd deployment pairs;
- Docker build definitions;
- machine-readable readiness gate.

Public-testnet gates:
1. reproducibly build pinned Geth v1.17.5;
2. Geth accepts the exact 420 execution genesis;
3. production blst builds and crypto vectors pass;
4. production libp2p/GossipSub builds;
5. Engine capability negotiation passes;
6. live payload build/get/newPayload flow passes;
7. fifteen real node420/fourtwentyd pairs run simultaneously;
8. 11/15 vs 10/15 passes with production networking/signatures;
9. primary/FB1/FB2 failure paths pass;
10. restart recovery passes with real execution state;
11. partition/reconciliation matrix passes;
12. soak test passes;
13. no unresolved safety-critical findings.

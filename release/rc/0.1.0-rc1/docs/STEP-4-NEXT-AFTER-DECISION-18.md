# Step 4 — Executable Protocol Construction

Decision 18 completes the main Step 3 architecture phase.

Recommended build order:
1. monorepo skeleton;
2. pin node420 Geth baseline;
3. SSZ consensus types/state;
4. slot/epoch/rotation clock;
5. proposer/fallback scheduling;
6. Engine API adapter;
7. QC/finality/fork choice;
8. validator registry/probation/rotation;
9. exact reward arithmetic;
10. deterministic genesis generator;
11. local multi-node devnet;
12. slashing and SAFETY_HALT simulation;
13. explorer/faucet;
14. M2 economic contracts.

A dedicated cross-chain gateway security decision is required before real-value bridge deployment.

# 420AI AI-AUDIT-10 pre-testnet qualification

AI-AUDIT-10 is the exact-head repository gate immediately before production-equivalent testnet qualification.

## Scope

This is an app-focused Level 1 step qualification plus a Level 2 pre-testnet integration milestone. It intentionally does not perform the final Level 3 repository-wide app-phase closeout and does not claim live testnet deployment.

## Canonical commands

The dedicated 420AI Audit Qualification workflow must execute these requirements against one exact implementation SHA:

1. verify checkout HEAD equals the pull-request head SHA;
2. start from a clean repository worktree;
3. run `forge clean` because this roadmap step explicitly requires a clean build;
4. format-check and build the AI contracts and directly required shared integration suites;
5. run the focused `AI*420.t.sol` Foundry inventory;
6. retain Compute/Vault integration:
   - `AIComputeIntegration420.t.sol`
   - `AICustodySettlement420.t.sol`
   - `ComputeEscrowFunding420.t.sol`
   - `ComputeVerifiedEntitlement420.t.sol`
   - `ComputeVerifierDisputeSlashEvidence420.t.sol`
   - `ComputeStakeSlashAuthorization420.t.sol`;
7. retain Registry/Identity integration:
   - `RegistryApiReconciliation420.t.sol`
   - `RegistryGenesis420.t.sol`
   - `RegistryIdentityNames420.t.sol`
   - `Identity420Compatibility.t.sol`
   - `Identity420Audit.t.sol`;
8. run the existing AI boundary verifiers and the AI-AUDIT-10 pre-testnet verifier;
9. build/test the provider service with `npm run build`;
10. build the 420Indexer/read API and run the retained AI API tests;
11. build/test the browser client with `npm run build`;
12. run a targeted forbidden-primitive scan and Slither high-severity gate over `contracts/src/ai/**`;
13. remove qualification-generated build/dependency directories and prove no tracked or untracked repository drift remains.

## Security gate

The pre-testnet security job rejects `tx.origin`, `selfdestruct`, and `delegatecall` in AI sources, runs the AI Foundry suite under the hardening profile, and fails on any high-severity Slither finding attributable to `src/ai/`.

## Live boundary

No live chain ID, deployment transaction, Registry publication transaction, public DNS/API origin, provider endpoint, block hash, or real-provider log is required or permitted to be fabricated here. Those are AI-AUDIT-11 production-equivalent testnet evidence.

## Exit criterion

AI-AUDIT-10 is COMPLETE only when every required app-specific job passes on the exact same implementation SHA and durable evidence records that SHA, run and job IDs. Evidence-only bookkeeping after a successful exact-head run does not create a new implementation SHA.

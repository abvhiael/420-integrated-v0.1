# 420AI AI-AUDIT-9 qualification

**Step:** AI-AUDIT-9 — deployment and Genesis materialization  
**Status:** COMPLETE  
**Qualification level:** Level 1 — exact-head app-specific qualification  
**Implementation SHA:** `ed7ab3af91d54b36d3ca6595eaf1363e07f09a55`  
**Current main at closeout:** `e22a744d8fbcff20f2b2108a1117ee3abe9dc437`  
**Audit branch / PR:** `qualify/ai-audit-8-reconciled-20261003` / PR #505  
**Workflow:** 420AI Audit Qualification  
**Run:** `37228805812`

## Canonical requirements satisfied

- Frozen AI compatibility predeploys `0x042f` through `0x0433` are materialized from the current implementation runtime in deterministic Foundry qualification and retain GovernanceTimelock `0x0429`.
- The mature Registry-resolved AI V1 graph is deployed in the materialization harness; runtime code hashes are checked and emitted.
- Twelve canonical `420/component/ai/.../v1` component identities are registered through ProtocolRegistry.
- Components are staged SUSPENDED, wired and verified, then activated before `420/service/ai/v1` is published to AIRouter420.
- AIJobManager, AIJobEscrow and AIReputationRegistry one-shot adapter bindings are performed under governance authority and unauthorized rebinding is rejected.
- Deployment sequencing, deployer/admin handoff, smoke tests, rollback/recovery, monitoring, DNS/API dependencies and the live-testnet boundary are documented.
- The deployment package deliberately leaves live chain ID, block data, transactions, Registry publication transactions, DNS and API origin unset until production-equivalent testnet deployment.

## Exact-head CI evidence

All required jobs passed on the same exact implementation SHA:

| Job | Job ID | Result |
|---|---:|---|
| compute-integration | 111513925933 | PASS |
| v1-modules | 111513926031 | PASS |
| genesis-compatibility | 111513926092 | PASS |
| deployment-materialization | 111513926105 | PASS |
| audit-state | 111513926111 | PASS |
| custody-settlement | 111513926116 | PASS |
| provider-runtime | 111513926160 | PASS |
| ai-client | 111513926207 | PASS |
| focused-ai-contracts | 111513926214 | PASS |
| ai-read-api | 111513926264 | PASS |

The materialization test initially exposed a Foundry harness ordering defect: a `vm.prank(TIMELOCK)` was consumed by an argument-evaluation getter before the privileged bind. The harness was corrected by resolving adapter addresses before the prank. No protocol authorization was weakened.

## Security / invariant result

- Frozen address identities remain unchanged.
- Registry-resolved modules do not acquire invented fixed Genesis addresses.
- Registry discovery remains separate from mutation authority.
- SUSPENDED staging prevents premature activation.
- Governance-only bindings remain one-shot.
- Unauthorized rebinding remains rejected.
- Runtime-code-hash checks bind Registry publication evidence to deployed code.
- No live-chain evidence is fabricated.

## Deferred by design

AI-AUDIT-9 does **not** claim production-equivalent deployment. Real deployed addresses, deployment and Registry transaction hashes, evidence blocks, live provider/runtime logs, DNS/API materialization and recovery drills belong to AI-AUDIT-11.

## Next canonical step

**AI-AUDIT-10 — exact-head pre-testnet qualification.**

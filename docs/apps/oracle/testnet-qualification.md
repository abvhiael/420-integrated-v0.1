# 420Oracle ORACLE-AUDIT-7 — production-equivalent testnet deployment

## Status

Repository handoff: **READY**

Live qualification: **BLOCKED — OFFICIAL PRODUCTION-EQUIVALENT TESTNET NOT YET AUTHORIZED/LIVE**

ORACLE-AUDIT-7 is a live deployment/evidence gate. Repository tests, local EVM deployments and synthetic fixtures can validate the qualification harness and fail-closed behavior, but they cannot satisfy the step's live exit criteria.

## Canonical prerequisites

Before ORACLE-AUDIT-7 can execute as a live qualification step:

1. the approved production-equivalent testnet must exist and the official manifest must be published at `developer-hub/manifests/testnet.json`;
2. chain ID and genesis identity must be frozen for that release lineage;
3. public RPC/service endpoints must be resolved and non-placeholder;
4. one exact repository implementation SHA must be pinned as the Oracle release candidate;
5. the deployed GovernanceTimelock and canonical ProtocolRegistry must be independently verified;
6. OracleProviderRegistry420, OracleFeedRegistry420, OracleRiskPolicy420 and OracleRouter420 must be deployed from the exact qualified release;
7. `420/service/oracle/v1` must resolve through ProtocolRegistry to the exact active OracleRouter runtime;
8. representative independent provider operators must be provisioned with reviewed operational key custody;
9. representative numeric and exact-result feeds, source memberships and risk policy must be governance-configured;
10. 420Automation and the Swap TWAP source-adapter path must bind to the same verified network/deployment where applicable.

The current repository intentionally fails closed while these prerequisites are absent.

## Required retained live checks

Every check below is mandatory and must bind to the same release/deployment lineage:

- **NETWORK_IDENTITY** — chain ID, genesis hash, evidence block/hash and endpoint provenance match the official manifest.
- **DEPLOYMENT_BINDINGS** — deployed Oracle component addresses, code hashes and immutable constructor bindings match the qualified release.
- **REGISTRY_DISCOVERY** — ProtocolRegistry actively resolves `420/service/oracle/v1` to the exact deployed router/version.
- **GOVERNANCE_AUTHORITY** — governed configuration succeeds only through the canonical authority and unauthorized configuration fails.
- **PROVIDER_PROVISIONING** — at least two independent provider identities/operators are active for representative quorum feeds, with non-secret metadata and reviewed key custody.
- **NUMERIC_QUORUM** — live independent submissions produce the canonical `MEDIAN_NUMERIC` read with correct decimals/confidence/spread/source count.
- **RESULT_QUORUM** — live exact-result sources produce `QUORUM_EQUAL`; conflicting qualifying quorums fail closed.
- **FRESHNESS_FAILURES** — stale/future observations, inactive feeds and insufficient live sources fail closed.
- **REPLAY_ORDERING** — observation-ID replay and non-advancing provider timestamps are rejected.
- **EPOCH_INVALIDATION** — feed revision, provider reactivation and source reactivation invalidate observations from prior epochs.
- **RISK_CONTROLS** — minimum confidence, maximum deviation and circuit breaker operate fail closed.
- **SWAP_ADAPTER** — deployed/read-only Swap TWAP source provenance is observable and stale/unhealthy adapter reads fail closed without deployment itself granting provider authority.
- **AUTOMATION_CONSUMER** — Automation consumes only canonical router facts and preserves chain/router/feed provenance plus local freshness/confidence/quorum constraints.
- **RESTART_REORG_RECONCILIATION** — provider/operator restart and reorg/reconciliation drills do not manufacture current observations or resurrect invalidated/stale data.

## Deployment evidence that must be retained

The live evidence bundle must contain, without secrets:

- exact implementation SHA;
- official chain ID and genesis hash;
- evidence block number/hash;
- GovernanceTimelock address;
- ProtocolRegistry address and code hash;
- ProviderRegistry address and runtime hash;
- FeedRegistry address and runtime hash;
- RiskPolicy address and runtime hash;
- OracleRouter address, runtime hash and protocol version;
- ProtocolRegistry service version/active state and publication transaction;
- constructor/immutable binding verification;
- governance provider/feed/source/risk configuration transactions;
- provider submission transactions for representative positive/negative checks;
- provider IDs/operators/metadata hashes and provider-diversity evidence;
- representative feed IDs/types/aggregation/freshness/quorum/risk parameters;
- live workflow/run IDs used to collect retained evidence;
- expected rejection/result evidence for adversarial checks;
- timestamps and evidence source/provenance.

Do not commit private keys, seed phrases, authenticated RPC URLs, bearer tokens, raw secrets or sensitive provider credentials.

## Canonical repository harness

Qualification state:

`contracts/config/oracle-audit-7-testnet-qualification.json`

Verifier:

`scripts/verify-oracle-audit-7-testnet-readiness.py`

Retained PASS evidence, when the live network exists:

`docs/audit/ORACLE-AUDIT-7-LIVE-TESTNET-EVIDENCE.json`

That PASS evidence file must not be created before the official testnet manifest and real deployment evidence exist.

## Expected repository-only result before launch

Run:

```bash
python3 scripts/verify-oracle-audit-7-testnet-readiness.py
```

Expected result while the testnet is not live:

```text
ORACLE_AUDIT_7_READINESS=BLOCKED_OFFICIAL_TESTNET_NOT_LIVE
liveQualificationComplete=false
requiredLiveChecks=14
```

This means the ORACLE-AUDIT-7 **harness is repository-ready**. It does not mean ORACLE-AUDIT-7 itself is COMPLETE.

## Exit criterion

ORACLE-AUDIT-7 becomes COMPLETE only after all fourteen required checks pass on one approved production-equivalent testnet release/deployment lineage and sanitized durable evidence is committed. Only then may **ORACLE-AUDIT-8 — Genesis/production closeout** begin.

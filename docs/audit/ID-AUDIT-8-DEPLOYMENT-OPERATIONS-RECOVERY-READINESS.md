# ID-AUDIT-8 — Deployment, Operations & Recovery Readiness

**Status:** IMPLEMENTED — Level 1 qualification pending exact-head CI  
**Repository:** `abvhiael/420-integrated-v0.1`  
**Working PR:** #438  
**Canonical roadmap:** `docs/audit/420IDENTITY-AUDIT-REMEDIATION-ROADMAP.md`

## Original step

ID-AUDIT-8 requires operator guidance covering:

- canonical address and network binding;
- governance authority;
- predeploy verification;
- monitoring/events;
- incident response;
- issuer compromise/deactivation;
- derived-service rebuild;
- rollback/recovery boundaries;
- secrets/key management;
- smoke test procedure.

**Exit criterion:** a new operator can verify and operate Identity without relying on tribal knowledge.

## Gap analysis

Prior Identity audit steps established:

- deterministic artifact/ABI/source identity;
- frozen predeploy runtime and storage state;
- derived-service compatibility/rebuild behavior;
- Wallet/user-facing lifecycle.

Before ID-AUDIT-8, those facts were spread across audit evidence and application documentation. There was no single Identity-specific operator runbook and no reusable read-only smoke command binding the retained predeploy package to a candidate chain.

## Implementation

Added:

- `docs/apps/identity/deployment-operations.md`;
- `scripts/identity-operator-smoke.py`;
- `scripts/test-identity-operator-smoke.py`;
- `scripts/verify-id-audit-8-operator-readiness.py`;
- `.github/workflows/identity-id-audit-8.yml`;
- this evidence record.

Updated:

- `docs/apps/identity/index.md` to add operator audience and the runbook link.

## Canonical operational identity

The runbook is mechanically bound to the retained ID-AUDIT-5 package:

- Identity420 address: `0x0000000000000000000000000000000000000436`;
- GovernanceTimelock: `0x0000000000000000000000000000000000000429`;
- protocol version: `3`;
- Solidity: `0.8.24`;
- EVM: Cancun;
- optimizer: enabled, 200 runs;
- via-IR: enabled;
- runtime bytes: `5681`;
- runtime code hash: `0xda0fcd565d7aea6590b3e0ec468f7b99af50138b62527e770ca367a57e6cfd86`;
- initial storage root: `0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421`;
- source blob SHA-1: `9d6bbfecf6cbb406312138acc735c5390513cd5a`;
- ABI SHA-256: `5ea63254c724148eba47ee720486f41105f003602558cbd0b0a43bdc346d3a6e`;
- four compiler-reported immutable references all materialized to GovernanceTimelock.

## Operator guidance completed

The runbook now covers:

### Network/deployment binding

- frozen `0x0436` address;
- chain-specific verification;
- runtime/hash/system-name/version checks;
- retained source/compiler/ABI provenance;
- initial predeploy storage expectations;
- explicit rejection of inferred addresses from Wallet/Indexer/Search/Explorer.

### Governance and issuer authority

It distinguishes:

- GovernanceTimelock issuer configuration/revocation authority;
- user profile-controller authority;
- issuer-controller issue/revoke authority;
- non-authoritative derived services.

### Monitoring

Monitoring guidance covers:

- address/code/hash/version/timelock drift;
- RPC/finality disagreement;
- all nine canonical Identity event families;
- anomalous issuer changes/issuance after deactivation;
- Indexer reorg/replay lag;
- Search inactive-profile leakage;
- Wallet/Explorer/Indexer disagreement with canonical state.

### Incident response

The runbook defines:

- wrong predeploy candidate response;
- RPC/canonical-chain disagreement response;
- issuer compromise/deactivation/replacement response;
- GovernanceTimelock compromise escalation.

Issuer compromise uses the canonical governance path. Operators are explicitly forbidden from editing profile/credential storage, inventing hidden emergency issuer keys or repairing derived projections by contradicting canonical Identity state.

### Derived-service rebuild

Documented rebuild order:

1. establish canonical rollback/finality point;
2. degrade projections;
3. replay canonical logs in block/transaction/log order;
4. rebuild profile/issuer/credential keys;
5. compare representative projections with canonical reads;
6. restore Search/Explorer only after qualified Indexer readiness.

### Rollback/recovery boundaries

The runbook records that Identity420 has no operator:

- arbitrary storage write;
- profile seizure;
- upgrade;
- local pause;
- migration shortcut.

Finalized canonical transactions are not reversed by deleting or editing derived-service state. Subject rejection remains irreversible under Identity v3.

### Secrets/key management

Governance, issuer and user key boundaries are explicit. The operator smoke tool contains no signing path and does not print the configured RPC URL.

## Read-only smoke tooling

`scripts/identity-operator-smoke.py` has two modes.

### Offline mode

```bash
python3 scripts/identity-operator-smoke.py --offline
```

It verifies the retained repository/predeploy authority including:

- frozen namespace ownership;
- runtime hash;
- compiler/source/ABI provenance;
- GovernanceTimelock immutable materialization;
- explicit empty initial mutable storage/root;
- predeploy-plan `ARTIFACT_READY`;
- deployment-manifest parity.

### Live read-only mode

```bash
python3 scripts/identity-operator-smoke.py \
  --rpc-url "$QUALIFIED_RPC_URL" \
  --expected-chain-id "$EXPECTED_CHAIN_ID"
```

It performs only read-only checks:

- chain ID;
- code presence at `0x0436`;
- runtime code hash;
- `systemName()`;
- `protocolVersion()`;
- `governanceTimelock()`;
- fail-closed behavior for an unknown zero credential.

No state-changing transaction is submitted. Representative live profile/issuer/credential lifecycle remains ID-AUDIT-9 scope.

## Adversarial/boundary smoke tests

The focused smoke tests cover:

- valid offline release-tree verification;
- offline runtime-hash drift;
- live chain mismatch;
- missing deployed code;
- runtime hash mismatch;
- GovernanceTimelock mismatch;
- zero/unknown credential failing closed;
- successful read-only live identity/version/timelock observation.

## Qualification level

ID-AUDIT-8 is a **Level 1 step-specific qualification**.

No new shared runtime authority or app-integration milestone is introduced. ID-AUDIT-6 already established the Identity derived-service Level 2 milestone; ID-AUDIT-8 documents and verifies operations over that retained architecture.

Required exact-head checks:

1. retained ID-AUDIT-5 predeploy reproduction/verification;
2. namespace collision verification;
3. offline operator smoke;
4. operator smoke negative/boundary suite;
5. operator runbook/readiness verifier;
6. retained ID-AUDIT-6 derived-service contract verifier;
7. explicit read-only/secret-free smoke-tool scan.

## Level 2 disposition

**Not required for this step.**

The runbook and smoke tooling introduce no new protocol authority or runtime service. Existing ID-AUDIT-6 Level 2 derived-service integration evidence remains retained.

## Level 3 disposition

Intentionally deferred to:

**ID-AUDIT-10 — phase closeout, reconciliation and retained evidence**

Deferred work includes current-main reconciliation, complete repository-wide Solidity/Genesis/docs/security qualification, final cross-app Wallet/Names/Indexer/Search reconciliation and exact final merge-candidate evidence.

## Live deployment boundary

ID-AUDIT-8 does **not** claim:

- production-equivalent testnet deployment;
- live initial storage proof;
- live profile/issuer/credential lifecycle;
- restart/reorg/dependency-failure testnet evidence;
- TESTNET READY.

Those remain the canonical scope of:

**ID-AUDIT-9 — production-equivalent testnet deployment qualification**

## Exact-head qualification evidence

Pending.

## Completion state

**PENDING LEVEL 1 EXACT-HEAD QUALIFICATION**

Next canonical roadmap step after successful closeout:

**ID-AUDIT-9 — production-equivalent testnet deployment qualification**

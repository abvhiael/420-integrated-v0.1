---
title: 420 Identity deployment and operator runbook
audience:
  - operator
  - developer
category: operations
status: pre-genesis
version: current
---

# 420 Identity deployment and operator runbook

This runbook is the Identity-specific operational authority for **ID-AUDIT-8**. It covers canonical deployment identity, governance authority, offline and live verification, monitoring, incident response, issuer compromise, derived-service rebuild, rollback/recovery boundaries, key handling and smoke procedure for the frozen `Identity420` predeploy.

It does **not** claim a production-equivalent testnet deployment. Live lifecycle qualification belongs to **ID-AUDIT-9**.

## Canonical deployment identity

| Item | Frozen value |
| --- | --- |
| Contract | `Identity420` |
| Protocol | `420Identity` |
| Protocol version | `3` |
| Canonical address | `0x0000000000000000000000000000000000000436` |
| GovernanceTimelock immutable | `0x0000000000000000000000000000000000000429` |
| Solidity | `0.8.24` |
| EVM target | Cancun |
| Optimizer | enabled, 200 runs |
| via-IR | enabled |
| Runtime bytes | `5681` |
| Runtime code hash | `0xda0fcd565d7aea6590b3e0ec468f7b99af50138b62527e770ca367a57e6cfd86` |
| Initial storage root | `0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421` |
| Source blob SHA-1 | `9d6bbfecf6cbb406312138acc735c5390513cd5a` |
| ABI SHA-256 | `5ea63254c724148eba47ee720486f41105f003602558cbd0b0a43bdc346d3a6e` |
| Runtime-template Keccak-256 | `0x3183b8b7bbbde1c6698ffc3977d118a6847aced80038caf717d1d71e21f6f270` |
| Materialized immutable references | `4`, all GovernanceTimelock `0x0429` |

Canonical repository inputs:

- `contracts/artifacts/Identity420.json`;
- `contracts/config/predeploy/Identity420-predeploy-state.json`;
- `contracts/config/predeploy/predeploy-plan.json`;
- `contracts/config/deployment-manifest.json`;
- `contracts/config/genesis-address-namespace.json`;
- `contracts/src/apps/Identity420.sol`.

The canonical Identity address is frozen. Do not infer it from Wallet configuration, Registry publication, an Indexer row, Search result, Explorer page, or an historical proposal.

## Canonical authority model

Identity420 has deliberately narrow authority boundaries.

### Governance authority

The only protocol governance authority is the immutable `GovernanceTimelock` at `0x0429`.

Governance may:

- create or replace issuer controller/metadata/activity with `setIssuer`;
- set issuer trust class with `setIssuerTrust`;
- revoke a credential directly through `revokeCredential` because GovernanceTimelock is an allowed revoker.

Governance does **not** control user profiles, profile controller transfer, user primary-name pointers, or subject rejection.

### Profile authority

The current profile controller may:

- update metadata/activity;
- set/clear primary-name pointer;
- nominate a new controller;
- reject credentials issued to that subject profile.

Controller transfer is two-step and only completes when the nominated pending controller accepts.

### Issuer authority

An active issuer controller may issue credentials under its issuer ID and may revoke its own credentials.

Issuer status and trust are dynamic governance state. Existing credential validity follows the **current** issuer activity/trust state.

### Derived services are not authority

420Indexer, Search, Explorer and Wallet are consumers/projections. They never become authority merely because they display Identity data.

If a derived surface disagrees with canonical Identity420 state, canonical chain state wins.

## Deployment order

Identity420 is a Genesis predeploy. Do not deploy an unrelated post-launch copy and point clients at it.

1. Freeze the release candidate and expected chain/genesis identity.
2. Materialize GovernanceTimelock at `0x0429`.
3. Reproduce `Identity420.json` from the pinned compiler profile.
4. Reproduce `Identity420-predeploy-state.json`.
5. Verify all four compiler-reported immutable references are materialized to `0x0429`.
6. Install the retained runtime at `0x0436`.
7. Confirm initial mutable Identity storage is empty unless an explicitly approved Genesis specification states otherwise.
8. Verify the runtime hash and contract identity before enabling consumers.
9. Enable 420Indexer against the final Identity ABI/event surface.
10. Enable Search/Explorer only after Indexer readiness/rebuild checks pass.
11. Publish Wallet chain-specific Identity/Names bindings only after the deployment is verified.
12. Run the read-only operator smoke before enabling user traffic.

Do not advance a candidate if any address, runtime, immutable, source provenance or manifest field differs from the retained release package.

## Configuration and predeploy verification

### Offline release-tree verification

From the candidate release tree:

```bash
python3 scripts/generate-id-audit-5-identity-predeploy.py --check
python3 scripts/verify-id-audit-5-identity-predeploy.py
python3 scripts/identity-operator-smoke.py --offline
python3 scripts/audit-genesis-address-collisions.py
```

The offline smoke verifies:

- frozen `0x0436` ownership;
- retained runtime hash;
- compiler/source/ABI provenance;
- GovernanceTimelock immutable materialization;
- empty initial mutable storage/root;
- predeploy `ARTIFACT_READY` state;
- deployment-manifest parity.

Any regenerated diff or verifier disagreement is a release blocker until reconciled.

### Live read-only smoke

The reusable smoke tool performs no transaction and requires no signing key.

```bash
python3 scripts/identity-operator-smoke.py \
  --rpc-url "$QUALIFIED_RPC_URL" \
  --expected-chain-id "$EXPECTED_CHAIN_ID"
```

The live smoke verifies:

- chain ID equals the explicitly supplied expected chain;
- code exists at `0x0436`;
- deployed code hash equals the retained runtime hash;
- `systemName() == "Identity420"`;
- `protocolVersion() == 3`;
- `governanceTimelock() == 0x0429`;
- an unknown zero credential fails closed through `credentialValid`.

The tool never prints the supplied RPC URL and never submits a transaction.

This smoke is **operational verification only**. It does not replace ID-AUDIT-9 lifecycle/testnet qualification.

## Monitoring and events

Monitor deployment identity continuously enough for the release environment.

### Deployment/authority monitors

Alert on:

- no code at `0x0436`;
- runtime hash drift;
- `systemName()` or protocol-version mismatch;
- GovernanceTimelock different from `0x0429`;
- chain-ID or finalized-head disagreement across qualified RPC endpoints;
- Wallet reporting a deployment/chain mismatch.

### Identity lifecycle events

The canonical event families are:

- `ProfileCreated`;
- `ProfileUpdated`;
- `PrimaryNameSet`;
- `ProfileControllerTransferStarted`;
- `ProfileControllerTransferred`;
- `IssuerSet`;
- `CredentialIssued`;
- `CredentialRevoked`;
- `CredentialRejected`.

Operational alerts should focus on anomalous **patterns**, not individual user behavior. Useful signals include:

- unexpected issuer controller/activity/trust changes;
- credential issuance continuing after an issuer should have been deactivated;
- spikes in authorization failures;
- prolonged Indexer lag or repeated reorg rollback;
- Search serving an inactive profile;
- Wallet/Explorer/Indexer disagreement with canonical finalized state.

Do not build alerts that expose or attempt to recover private metadata payloads from public commitment hashes.

## Incident response

### Wrong code/address/immutable before launch

Stop the candidate.

Do not repair clients around an invalid `0x0436` predeploy. Reproduce the artifact/predeploy package, rebuild the Genesis candidate, rerun qualification and issue a new candidate.

A wrong runtime hash, wrong address or wrong GovernanceTimelock immutable is a chain-image defect.

### RPC or canonical-chain disagreement

1. stop state-changing Identity UX if canonical chain identity cannot be established;
2. compare qualified RPC observations of chain ID, finalized block/hash and `0x0436` code;
3. quarantine disagreeing endpoints;
4. do not use Indexer/Search/Explorer as a tiebreaker;
5. restore writes only after canonical chain identity is re-established.

### Issuer compromise or suspected compromise

Issuer compromise is an Identity-specific emergency.

1. Identify the canonical issuer ID and current issuer controller from Identity420.
2. Stop downstream systems from relying on fresh credentials from the suspect issuer.
3. Use the normal GovernanceTimelock process to call `setIssuerTrust(..., active=false)` or `setIssuer(..., active=false)` as appropriate.
4. Confirm finalized `IssuerSet` event and canonical `issuers(issuerId)` state.
5. Because `credentialValid` dynamically checks issuer activity, existing credentials from that issuer become invalid while the issuer remains inactive.
6. Investigate whether individual credentials also require explicit governance/issuer revocation for durable historical policy.
7. If a replacement controller is approved, update the issuer through governance and revalidate downstream consumers before reactivation.
8. Rebuild or refresh derived services if they cached issuer/credential validity.

Do **not**:

- edit profile or credential storage directly;
- mark Search/Indexer records valid to compensate for an inactive issuer;
- create a hidden emergency issuer key;
- treat issuer trust class as legal/regulatory status.

### Governance-key compromise

Identity420 has no alternate local admin or pause key.

If GovernanceTimelock authority itself is compromised, treat this as a governance/system incident. Do not attempt an Identity-only privileged rollback that the contract does not support.

Follow the system governance/chain recovery process and preserve finalized evidence.

## Derived-service rebuild

Identity projections are reconstructable and non-canonical.

### 420Indexer rebuild

1. mark Indexer-derived Identity state degraded;
2. identify the trusted rollback point/finality horizon;
3. remove or supersede non-canonical Identity projections;
4. replay canonical Identity logs in `block_number, tx_index, log_index` order;
5. rebuild profile, issuer and credential object keys;
6. verify lifecycle projection:
   - profiles by `profileId`;
   - issuers by `issuerId`;
   - credentials by `credentialId`;
7. compare representative rebuilt records with direct canonical contract reads;
8. restore readiness only after reorg/replay checks pass.

### Search rebuild

Search must rebuild public profile presentation from qualified Identity event history.

During rebuild:

- suppress public Identity results when Indexer history is incomplete/unordered;
- keep inactive profiles suppressed;
- treat `metadataHash` only as a public commitment;
- never recover or infer private payloads from commitment visibility.

### Explorer recovery

Explorer remains a presentation/provenance layer.

If Explorer disagrees with canonical chain data, repair its Indexer/raw-log source and presentation cache. Do not create a second canonical Identity state machine inside Explorer.

## Rollback and recovery boundaries

Identity420 is not upgradeable and exposes no operator rollback, arbitrary storage-write, migration, pause or profile-seizure function.

After canonical finality:

- a profile update cannot be operator-reversed;
- controller transfer follows only the two-step contract path;
- subject credential rejection is irreversible in the current protocol;
- issuer deactivation/replacement uses governance;
- credential revocation remains historical;
- derived-service deletion never reverses canonical state.

Before finality, normal chain reorg rules apply. Derived services must roll back/replay to the canonical fork.

If a protocol defect requires changing canonical Identity semantics, that is a versioned governance/Genesis migration problem, not an operations shortcut.

## Secrets and key management

### Governance

Governance signing material must remain outside application repositories, CI logs, Wallet UI state and operator smoke tooling.

Operators should use the approved GovernanceTimelock signing/execution process and independently verify:

- destination `0x0436`;
- exact calldata/action;
- issuer ID/controller/trust/activity values;
- expected chain ID;
- timelock operation identity;
- finalized receipt/event.

### Issuers

Issuer controllers are security-sensitive signing authorities.

Recommended operational controls:

- hardware-backed or equivalently protected signing;
- separation from public API/service credentials;
- no private-key material in Indexer/Search/Explorer/Wallet configuration;
- rotation/replacement only through GovernanceTimelock;
- explicit incident owner and escalation path;
- preserve old controller addresses in incident evidence.

### User profile controllers

Operators do not custody user profile-controller keys and cannot recover them through Identity420.

A lost profile controller has no operator override path in the current protocol unless a pending transfer was already established and accepted by the appropriate account.

## Smoke test procedure

### Pre-release/offline

Run:

```bash
python3 scripts/identity-operator-smoke.py --offline
```

Require `Identity420 operator smoke PASS`.

### Candidate chain/read-only

Run:

```bash
python3 scripts/identity-operator-smoke.py \
  --rpc-url "$QUALIFIED_RPC_URL" \
  --expected-chain-id "$EXPECTED_CHAIN_ID"
```

Retain:

- release SHA;
- expected chain ID;
- observed block/finality context;
- smoke output;
- runtime hash;
- GovernanceTimelock value;
- workflow/run identity.

Do not store RPC credentials in retained evidence.

### State-changing smoke

Representative profile/issuer/credential lifecycle transactions are intentionally **not part of ID-AUDIT-8**.

Those belong to **ID-AUDIT-9 — production-equivalent testnet deployment qualification**, where receipts/logs and cross-service observations must be retained against an approved release candidate.

## Known limitations

1. ID-AUDIT-8 provides offline and read-only operational tooling, not public-testnet deployment evidence.
2. Identity420 has no local pause switch.
3. Identity420 has no upgrade or arbitrary operator repair function.
4. Subject credential rejection is irreversible.
5. Issuer deactivation invalidates credentials dynamically; downstream caches must recheck canonical state.
6. A primary `.420` name is authoritative as a strong binding only while both Names420 and Identity420 agree.
7. Identity trust class is not legal identity, wallet ownership, universal reputation or authorization.
8. Search/Indexer/Explorer availability does not alter canonical Identity state.
9. Metadata and claim hashes are opaque commitments, not permission to retrieve private payloads.
10. Live testnet lifecycle, restart, reorg and dependency-failure qualification remains ID-AUDIT-9.

## Operator release checklist

Before enabling Identity in an environment:

- [ ] exact release SHA recorded;
- [ ] expected chain/genesis identity recorded;
- [ ] GovernanceTimelock `0x0429` verified;
- [ ] Identity artifact reproduces;
- [ ] Identity predeploy state reproduces;
- [ ] namespace/collision checks pass;
- [ ] `0x0436` contains expected code;
- [ ] runtime hash matches retained state;
- [ ] `systemName()`, `protocolVersion()` and `governanceTimelock()` match;
- [ ] Indexer uses the final Identity ABI/event surface;
- [ ] reorg/rebuild procedure has an assigned operator;
- [ ] Search inactive-profile/privacy boundaries are preserved;
- [ ] Explorer remains non-authoritative;
- [ ] Wallet uses chain-specific verified Identity/Names bindings;
- [ ] issuer-compromise response owner is assigned;
- [ ] governance and issuer signing material is stored outside application/CI configuration;
- [ ] read-only smoke passes;
- [ ] monitoring/alert ownership is assigned;
- [ ] no TESTNET READY claim is made until ID-AUDIT-9 passes.

## Related material

- [420 Identity architecture](architecture.md)
- [420 Identity user guide](user-guide.md)
- [420 Identity troubleshooting](troubleshooting.md)
- [420 Identity developer integration](developer/index.md)
- [Genesis architecture](../../architecture/genesis-architecture.md)
- [Registry / Names / Identity architecture](../../architecture/protocols/registry-names-identity-420is.md)
- [Indexer/Search troubleshooting](../../troubleshooting/indexer-explorer-search-analytics-status.md)
- `docs/audit/ID-AUDIT-5-FROZEN-PREDEPLOY-MATERIALIZATION.md`
- `docs/audit/ID-AUDIT-6-DERIVED-SERVICE-COMPATIBILITY.md`
- `docs/audit/ID-AUDIT-7-WALLET-USER-WORKFLOW.md`

---
title: Consensus, validator and node troubleshooting registry
audience:
  - operator
  - developer
category: troubleshooting
status: current
version: current
---

# Consensus, validator and node troubleshooting

Use this registry when validator lifecycle, proposer/attestation behavior, quorum/finality, `fourtwentyd`, `node420`, Engine connectivity or signing safety is degraded. These entries summarize diagnosis and recovery order; canonical architecture and operator procedures remain authoritative.

Consensus safety has priority over liveness. Do not lower quorum, bypass signing protection, duplicate signer identity, or force execution/consensus state to match a dashboard. When canonical state or signer safety cannot be established, fail closed and stop signing.

## `TRB-CONSENSUS-001` — Validator is not eligible or active

**Audience:** operator  
**Surface:** validator lifecycle  
**Severity:** blocked  
**Authority source:** canonical validator/stake/committee state  
**Retry safety:** not-applicable

### What you see

The validator is configured locally but is not selected as active/eligible, does not receive expected duties, or appears outside the current committee.

### What this usually means

Bond/eligibility conditions are unmet, activation is pending, tenure/cooldown state applies, committee rotation moved the validator out, or local configuration references the wrong validator/network identity.

### Safe diagnostics

Collect validator public identity, network/chain identity, canonical validator status, bond/activation state, current epoch/committee and `fourtwentyd` version. Do not export validator private keys or remote-signer credentials.

### Recovery

1. Confirm chain/network identity.
2. Read canonical validator and stake state.
3. Confirm the expected activation/tenure/cooldown epoch.
4. Confirm local validator identity matches the canonical registration.
5. Wait for protocol-defined lifecycle transitions rather than forcing local activation.

Stop and escalate if canonical validator state conflicts with the expected registration or if signer identity is uncertain.

## `TRB-CONSENSUS-002` — Expected proposer duty is missed

**Audience:** operator  
**Surface:** proposer scheduling  
**Severity:** degraded  
**Authority source:** canonical proposer schedule, consensus logs and certified chain state  
**Retry safety:** not-applicable

### What you see

A validator expected to propose does not produce an accepted block, or fallback proposer behavior activates.

### Likely causes

Process unavailability, P2P isolation, Engine payload failure, stale schedule/epoch view, signer failure or local clock/runtime problems.

### Recovery

Verify current epoch/slot and canonical schedule, process health, signer availability, consensus peers, then Engine health. Do not manually produce a duplicate proposal after uncertainty about whether a proposal was already signed.

## `TRB-CONSENSUS-003` — Attestations are missing or rejected

**Audience:** operator  
**Surface:** attestations/QC formation  
**Severity:** degraded  
**Authority source:** consensus protocol state and validated attestation/QC evidence  
**Retry safety:** unsafe

### What you see

Expected attestations do not contribute to QC formation, are rejected, or local participation falls unexpectedly.

### What this usually means

Wrong epoch/slot target, stale committee state, invalid signature/domain, signer/persistence mismatch, network isolation, or an already-signed conflicting duty.

### Before you retry

Do not blindly re-sign. Confirm the exact duty, target and local signing-protection record first.

### Recovery

1. Stop automated retry if signing state is ambiguous.
2. Verify canonical epoch/slot/committee and target.
3. Verify signer identity and signing-protection database.
4. Inspect rejection reason and peer connectivity.
5. Resume only when a duplicate/conflicting signature cannot be produced.

## `TRB-CONSENSUS-004` — QC does not form / finality stops advancing

**Audience:** operator, developer  
**Surface:** QC/finality  
**Severity:** blocked  
**Authority source:** validated consensus votes, quorum rules and canonical finality tracker  
**Retry safety:** not-applicable

### What you see

Head may move while `safe`/`finalized` stop advancing, or a candidate does not become certified.

### What this usually means

Quorum is unavailable, attestations are missing/invalid, the network is partitioned, validators disagree on target/committee state, or execution/Engine failures prevent valid payload progression.

### Recovery

Do not lower quorum or mark a sub-quorum majority certified. Diagnose validator reachability, committee agreement, signing health and Engine state. Restore enough valid participation for protocol quorum, then allow normal certification/finality rules to resume.

## `TRB-CONSENSUS-005` — Quorum loss

**Audience:** operator  
**Surface:** consensus liveness  
**Severity:** blocked  
**Authority source:** live committee membership and validated voting participation  
**Retry safety:** not-applicable

### What you see

The active committee cannot produce the required quorum and certification/finality halt.

### Recovery order

1. Preserve current canonical/finalized state.
2. Do not lower quorum thresholds.
3. Determine which validators are reachable and which committee view they hold.
4. Restore network/process/signer availability without duplicating validator identities.
5. Reconcile head/safe/finalized state before resuming normal participation.

Escalate if quorum cannot be restored without uncertain signer or persistence state.

## `TRB-CONSENSUS-006` — Network partition or conflicting views

**Audience:** operator  
**Surface:** consensus P2P/fork choice  
**Severity:** security-critical  
**Authority source:** protocol fork-choice/QC/finality rules and persisted consensus state  
**Retry safety:** unsafe

### What you see

Validators observe different heads/committees, peer groups are isolated, or views converge only after connectivity returns.

### Recovery

Contain first. Do not restart validators into arbitrary peer groups or force a preferred head. Preserve persisted consensus/signing state, restore connectivity, verify QC/finality evidence, reconcile canonical head/safe/finalized state, then resume signing according to the canonical recovery procedure.

## `TRB-CONSENSUS-007` — `SAFETY_HALT` or equivalent safety stop

**Audience:** operator  
**Surface:** consensus safety  
**Severity:** security-critical  
**Authority source:** consensus safety state and canonical recovery procedure  
**Retry safety:** unsafe

### What you see

Consensus intentionally stops signing/progress because safety preconditions are not satisfied.

### Recovery

Treat the halt as protective. Identify the triggering condition, preserve persistence and signing records, verify validator/signer identity, reconcile consensus and execution canonical state, and clear/resume only through the documented safety recovery path. Never bypass the halt merely to restore liveness.

## `TRB-CONSENSUS-008` — Possible equivocation or conflicting signature

**Audience:** operator  
**Surface:** validator signing  
**Severity:** security-critical  
**Authority source:** signed consensus messages, slashing evidence and signing-protection state  
**Retry safety:** unsafe

### What you see

A validator may have signed conflicting duties, two signer instances may be active, or signing protection reports a conflict.

### Recovery

Immediately stop signing for the affected validator. Preserve logs, signed-message evidence and signing-protection data. Identify every signer instance and restore exactly one authoritative signing path. Do not delete signing-protection history to make the error disappear.

## `TRB-NODE-001` — `fourtwentyd` will not start or remain healthy

**Audience:** operator  
**Surface:** consensus process  
**Severity:** blocked  
**Authority source:** process configuration/persistence plus canonical consensus state  
**Retry safety:** conditional

### Safe diagnostics

Process version, sanitized config, network identity, persistence path/state, peer status, signer endpoint status, Engine endpoint status and non-secret logs.

### Recovery

Check configuration/network identity, persistence readability, signer identity/protection, Engine compatibility, then P2P. Do not replace/delete persistence or signing-protection data as a generic startup fix.

## `TRB-NODE-002` — `node420` will not start or execution state is unhealthy

**Audience:** operator  
**Surface:** execution process  
**Severity:** blocked  
**Authority source:** node datadir/genesis configuration and canonical execution state  
**Retry safety:** conditional

### Recovery

Verify the expected network/genesis, datadir, disk/resource health, execution database state and process version. If rebuilding is required, follow the documented execution recovery procedure; do not invent a new genesis or chain identity to make the process start.

## `TRB-NODE-003` — Engine API connectivity/authentication failure

**Audience:** operator  
**Surface:** private `fourtwentyd` ↔ `node420` Engine boundary  
**Severity:** blocked  
**Authority source:** local Engine health, authenticated capability/version compatibility and both process states  
**Retry safety:** conditional

### What you see

Consensus cannot obtain/submit execution payloads or Engine requests fail authentication/version checks.

### Recovery

1. Confirm both processes are on the intended network and compatible build.
2. Verify private Engine endpoint reachability.
3. Verify JWT/auth configuration without exposing the secret.
4. Verify required Engine capabilities/version support.
5. Reconcile execution head with consensus expectations before restoring duties.

Never expose the Engine endpoint or authentication secret as a public RPC troubleshooting shortcut.

## `TRB-NODE-004` — Consensus and execution disagree on head/safe/finalized state

**Audience:** operator  
**Surface:** consensus/execution integration  
**Severity:** security-critical  
**Authority source:** validated consensus finality state plus canonical execution payload binding  
**Retry safety:** unsafe

### What you see

`fourtwentyd` and `node420` report incompatible canonical state, payload binding fails, or execution appears ahead/behind in a way that cannot be explained by normal synchronization.

### Recovery

Stop signing/proposing if safety is uncertain. Preserve both persistence stores. Establish canonical consensus finality, verify the corresponding execution payload/state, restore execution to the matching canonical state, verify Engine communication, then resume consensus participation.

## `TRB-NODE-005` — Remote signer unavailable or signer identity uncertain

**Audience:** operator  
**Surface:** validator signing boundary  
**Severity:** security-critical  
**Authority source:** configured validator identity, remote-signer public identity and signing-protection state  
**Retry safety:** unsafe

### Recovery

Do not substitute a second signer instance casually. Confirm signer identity, restore signing protection, verify no other active signer can use the same validator key, and resume only after the exact validator/signer mapping is established.

## `TRB-NODE-006` — Restart after crash or host loss

**Audience:** operator  
**Surface:** consensus/execution restart  
**Severity:** degraded  
**Authority source:** persisted consensus/signing state, canonical finalized state and execution database  
**Retry safety:** conditional

### Recovery order

1. Verify network/genesis identity.
2. Restore and validate consensus persistence.
3. Restore/verify signing protection and signer identity.
4. Verify committee/finality state.
5. Restore `node420` to matching canonical execution state.
6. Verify private Engine compatibility/connectivity.
7. Restore consensus P2P and reconcile head/safe/finalized.
8. Resume signing only after the above checks pass.

## Stop conditions for DOC-11.4

Stop automated recovery and escalate when:

- signer identity or signing-protection history is uncertain;
- conflicting signatures may exist;
- consensus and execution canonical state cannot be reconciled;
- restoring quorum would require duplicate validator identity or lowering protocol thresholds;
- persistence appears corrupted and no qualified recovery procedure can establish canonical state;
- Engine authentication material may be compromised.

## Related documentation

- [Consensus architecture](../architecture/consensus/index.md)
- [Epochs, fork choice, QCs and finality](../architecture/consensus/epochs-fork-choice-qcs-finality.md)
- [Failure recovery and operator safety](../architecture/consensus/failure-recovery-operator-safety.md)
- [`fourtwentyd` infrastructure](../architecture/infrastructure/fourtwentyd.md)
- [Observability and operator services](../architecture/infrastructure/observability-status-operator-services.md)
- [Troubleshooting registry contract](registry-contract.md)

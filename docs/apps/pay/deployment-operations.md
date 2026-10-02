# 420Pay deployment operations — PAY-AUDIT-6

## Scope

This runbook covers deterministic repository deployment preparation for the registry-resolved 420Pay resident suite. It does **not** claim that 420Pay has been deployed to the production-equivalent public testnet. Live chain addresses, transactions, Registry revisions, evidence blocks and binding receipts belong to **PAY-AUDIT-7**.

## Canonical authority and address policy

- GovernanceTimelock: `0x0000000000000000000000000000000000000429`.
- ProtocolRegistry: `0x0000000000000000000000000000000000000434`.
- Global `genesisConfigHash`: `0x01aea63faef55d711e5f93e800b04702177874f4015375b659038ce991d20921`.
- Pay residents are **Registry-resolved**. There is no adopted fixed-address or CREATE2 policy for this Pay family. Do not invent production addresses or salts.

The retained authority is `contracts/config/pay/pay-audit-6-deployment-package.json`. The package freezes compiler provenance, source blobs, ABI commitments, compiler runtime templates, materialized runtime code hashes and immutable patch evidence while leaving every Pay deployment address null.

## Reproduce the deterministic package

From repository root:

```bash
cd contracts
forge build src/pay src/swap/CanonicalSwapExecutor420.sol src/system/ReplayProtectionConsumer420.sol
cd ..
python3 scripts/generate-420pay-audit-6-deployment.py --check
python3 scripts/420pay-audit-6-deployment-plan.py --check
python3 scripts/verify-420pay-audit-6-deployment.py
python3 scripts/420pay-audit-6-smoke.py
```

Any source/compiler/toolchain/ABI/immutable/runtime drift must fail qualification rather than silently replacing retained identities.

## Deployment order

1. Verify the frozen GovernanceTimelock, ProtocolRegistry and global Genesis configuration commitment.
2. Verify the canonical `CanonicalSwapExecutor420` and shared `ReplayProtectionConsumer420` dependencies are the approved deployment candidates.
3. Deploy the nine Pay residents using the exact constructor inputs retained in the package. `CanonicalSettlementAdapter420` additionally receives the exact canonical Swap executor address.
4. Do not activate traffic before Registry publication and wiring validation complete.
5. Publish each Pay resident through the canonical ProtocolRegistry component API.
6. Apply the wiring graph below through GovernanceTimelock-authorized calls.
7. Verify all runtime identities, Registry lifecycle/version, replay binding and privileged-call boundaries.
8. Only after every postcondition passes may the deployment candidate be considered ready for PAY-AUDIT-7 live qualification.

## Registry publication

For each of the nine Pay residents call:

`ProtocolRegistry.registerComponent(componentId, implementation, Version(1,0,0), Lifecycle.ACTIVE)`.

Postconditions:
- `component(componentId).implementation` equals the exact deployed instance.
- `component(componentId).runtimeCodeHash` equals `EXTCODEHASH(implementation)`.
- lifecycle is `ACTIVE`.
- `resolve(componentId)` returns the exact instance.
- `supportsVersion(componentId, 1.0.0)` is true.
- deployed runtime code hash equals the retained PAY-AUDIT-6 package hash for that contract.

ProtocolRegistry publication is discovery/identity authority only. It does not grant custody, spending, upgrade, or signing authority.

## Required wiring

After Registry publication:

- `PaymentRouter420.setSettlementAdapter(CanonicalSettlementAdapter420)`.
- `PaymentRouter420.setSettlementRouter(SettlementRouter420)`.
- `CanonicalSettlementAdapter420.setPaymentRouter(PaymentRouter420)`.
- `CanonicalSettlementAdapter420.setSettlementRouter(SettlementRouter420)`.
- `CanonicalSettlementAdapter420.setSwapExecutor(CanonicalSwapExecutor420)`.
- `SettlementRouter420.setPaymentRouter(PaymentRouter420)`.
- `SettlementRouter420.setSettlementAdapter(CanonicalSettlementAdapter420)`.
- `RefundManager420.setPaymentRegistry(PaymentRegistry420)`.
- `CanonicalSwapExecutor420.setTrustedCaller(CanonicalSettlementAdapter420, true)`.
- bind `ReplayDomainIds420.PAY_SETTLEMENT` exclusively to `PaymentRouter420` in the canonical ReplayProtection consumer.

A wrong, inactive, unregistered or runtime-hash-mismatched component must fail closed.

## Governance handoff

All privileged configuration remains behind the frozen GovernanceTimelock and canonical governance-authority checks. Before activation verify:

- no deployer EOA has an alternate owner/admin backdoor;
- all configured Pay residents expose the frozen timelock immutable;
- unauthorized callers cannot change settlement, refund, replay, sponsor or Swap trust bindings;
- operational mutations fail closed when resident Registry identity/lifecycle/runtime hash does not match.

Never bypass the timelock merely to repair a deployment. A candidate requiring such bypass is rejected.

## Offline smoke

`python3 scripts/420pay-audit-6-smoke.py` verifies retained package reproducibility and static deployment invariants. The Foundry test `contracts/test/PayAudit6DeploymentPackage420.t.sol` deploys the real ProtocolRegistry with production-authority immutable values, registers all nine residents, applies the binding graph and proves an unauthorized configuration call fails.

This is repository-side evidence only.

## PAY-AUDIT-7 live read-only smoke

When an approved production-equivalent candidate exists, PAY-AUDIT-7 must record chain ID, evidence block/hash, addresses and transaction receipts before read-only smoke is accepted. Required checks include:

- deployed code exists at every recorded address;
- code hash equals the retained PAY-AUDIT-6 runtime hash;
- Registry component implementation/hash/version/lifecycle match;
- all wiring getters equal the recorded canonical instances;
- replay domain points only to PaymentRouter420;
- executor trusts only the intended settlement adapter under the approved policy;
- Indexer descriptors point at the recorded Registry-resolved Pay addresses.

Do not populate those values in the PAY-AUDIT-6 package.

## Monitoring

Monitor:
- ProtocolRegistry lifecycle/code-identity changes for every Pay component;
- governance/timelock configuration transactions;
- Swap executor trusted-caller changes;
- replay-domain consumer changes;
- settlement/refund/sponsorship configuration changes;
- Indexer decode/reorg/restart health for Pay events.

Any unexpected runtime or binding change is a release-blocking identity drift until reconciled through governance and requalified.

## Incident response

For a suspected bad binding or runtime mismatch:

1. stop Pay activation/value-moving operations through canonical safety/pause controls where available;
2. preserve transaction/block/Registry evidence;
3. compare live runtime and Registry state with the retained package;
4. identify whether the issue is wrong deployment, wrong publication, wrong wiring, lifecycle drift or derived-service/indexer drift;
5. do not compensate or replay payments until canonical settlement/refund state is reconciled;
6. produce a remediation candidate and re-run the applicable qualification level before reactivation.

## Rollback / recovery

There is no hidden upgrade proxy or emergency owner for the Pay residents. Recovery therefore means governance-controlled lifecycle/configuration correction or deployment of a new Registry-resolved candidate, not mutating deployed bytecode.

Safe recovery boundary:
- suspend/deactivate a bad candidate through canonical lifecycle/safety mechanisms;
- deploy a replacement from a newly qualified exact source/package SHA;
- register the replacement and reapply the complete binding graph;
- verify replay/refund/accounting state migration requirements before traffic moves;
- never reuse a failed deployment merely because its address is convenient.

Rollback must not reverse already-final canonical settlement or manufacture refund authority.

## Indexer recovery

Indexer state is derived. If descriptors or event processing drift:
- retain the canonical deployed address/Registry evidence;
- rebuild descriptors from the approved ABI/runtime package;
- replay from a known-good block/checkpoint;
- verify `PaymentSet`, `PaymentAuthorized`, split/refund and sponsorship-derived state;
- test reorg/restart behavior before restoring service.

Indexer recovery cannot alter on-chain Pay authority or finality.

## Secrets and key management

Deployment/governance keys and RPC credentials must remain outside repository artifacts and CI logs. Use the approved signing/governance process; never commit private keys, seed phrases, API credentials or privileged raw transaction material. PAY-AUDIT-6 stores only public deterministic deployment identities and procedures.

## Known limitations

- PAY-AUDIT-6 is repository deployment readiness, not live-chain qualification.
- Pay resident addresses remain unknown until an approved PAY-AUDIT-7 deployment occurs.
- Shared Swap executor and ReplayProtection deployment ownership is external to Pay; Pay verifies and binds those exact canonical instances.
- External independent security review and final Genesis/production closeout remain PAY-AUDIT-8.

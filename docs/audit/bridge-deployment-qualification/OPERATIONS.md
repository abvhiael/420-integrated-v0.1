# Bridge deployment, activation and rollback

This is the executable preparation for the user-assigned BRIDGE-AUDIT-12. No new approval tier or branch rule is introduced. Existing Genesis governance, timelock, ProtocolRegistry, chain/token/risk/qualification authority and the original testnet handoff remain authoritative. The global freeze conflict in README.md blocks release preparation; the scripts reject it for production plans.

## Reproduce the retained build

Use native solc `0.8.24+commit.e11b9ed9`, optimizer 200, viaIR, Cancun, and Anvil 1.7.1. Tool versions and the solc binary hash are recorded in the package manifest and rehearsal result. Install `scripts/bridge-audit-12/requirements.txt` in an isolated Python environment.

```sh
python scripts/bridge-audit-12/package.py build --solc /path/to/solc --output /tmp/bridge12-package
BRIDGE12_PACKAGE=/tmp/bridge12-package python scripts/bridge-audit-12/test_package.py
python scripts/bridge-audit-12/rehearse.py --package /tmp/bridge12-package --anvil /path/to/anvil --solc /path/to/solc --output /tmp/bridge12-rehearsal
python scripts/bridge-audit-12/prepare.py --package /tmp/bridge12-package --anvil /path/to/anvil --output /tmp/bridge12-canonical
python scripts/bridge-audit-12/verify.py
```

`package.tar.gz` contains the exact compiler request, all 113 Bridge/ProtocolRegistry ABI, creation/runtime bytecode, immutable references, storage layouts and compiler settings, source hashes, and the entire current Bridge JSON configuration snapshot. Extract into a new directory; no source download or guessed compiler input is needed. The reproducible build can be compared by artifact and input hashes; `baseline_main` records the original compilation baseline and does not purport to be a newly executed test SHA.

`canonical/constructor-parameters.json` pins the frozen configuration hash, timelock, Registry, disabled gateway verifier and every compiled constructor schema. Null inputs explicitly require actual deployed/source/issuer/validator dependencies. They are not zero defaults or permission to create a new trust authority. Libraries and helper contracts in the complete compiler inventory are not an instruction to deploy unnecessary contracts.

## Construct unsigned deployment and publication calls

After the shared freeze is reconciled under its existing version-decision rule, supply the actual local chain ID, deployer, start nonce and explicit constructor arguments:

```sh
python scripts/bridge-audit-12/package.py plan --package /tmp/bridge12-package --parameters /path/to/approved-parameters.json --output /tmp/bridge12-plan.json
```

The parameter schema and a complete controlled example are in `rehearsal/unsigned-plan.json` under `parameters`. Remove `environment: local_rehearsal` for a release plan. That special mode is restricted to chain ID 31337; the rehearsal launches its own loopback Anvil and never accepts an external RPC URL. Neither script signs or broadcasts to a real network.

The plan derives CREATE addresses from the exact deployer/nonce and emits ABI-encoded constructor data and governance publication calldata. Any other deployment transactions by that deployer invalidate subsequent predicted addresses. Governance publication calls are executed through the existing timelock, not signed as transactions by a contract address. Do not mix another account's nonce stream with the deployer's stream.

1. Materialize the frozen ProtocolRegistry at `0x0434` through its already qualified Registry predeploy process. Materialize VerifiedGateway420 at `0x0438` from constructor execution, including immutable timelock/Registry/configuration and initial zero verifier. Do not deploy creation code at a frozen address, copy an unpatched runtime template, or move self-address-bound custody/proxy contracts after construction. The gateway candidate has no mutable constructor writes; its storage trie is empty. The candidate is explicitly `deployment_ready: false` while current authority inputs conflict with FROZEN_V1.
2. Deploy/publish BridgeVerifierRegistry420 and the chain, asset, route, risk, transfer, accounting, router and CADC components. The executable core order is retained in constructor parameters. Each publication uses `registerComponent(componentId, implementation, (1,0,0), ACTIVE)` and pins the actual deployed runtime code hash. ACTIVE component discovery grants no route or economic approval.
3. BridgeValueCustody420 must be constructed **after** the qualification registry is active in ProtocolRegistry. Its constructor resolves and permanently pins that registry address/hash, its own deployment address and a real code-bearing withdrawal outcome verifier. The always-reverting outcome in the rehearsal is an existing test fixture; it is absent from production deployment selections. Deploy BridgeRepresentation420 only against its final custody address. Never use bridged generic representations for issuer-native CADC/USDC.
4. Deploy the selected production verifier/adapter graph with actual constructor dependencies from the inventory. For each instance retain actual runtime Keccak hash, implementation/proxy identity, trusted root/configuration probes, source/issuer authority evidence and qualification ID. Core/source/helper inventory entries do not themselves confer authority. The two legacy ETH/BTC placeholders are explicitly ineligible deployment selections, and both execution directions still revert.
5. Compare deployed bytecode with the matching artifact after constructor immutable materialization, verify `registry`, `governanceTimelock`, `genesisConfigHash`, `componentId` and `protocolVersion`, then compare ProtocolRegistry's address/runtime/version/lifecycle. Check custody's `qualificationAnchor`, `qualificationRuntime` and `deploymentAddress`. Retain actual chain ID, receipts and transaction hashes. Current local controlled receipts cannot satisfy these live requirements.

## Governance activation

All operations below are existing contract APIs under the existing governance/timelock; no automatic approval is generated by the package.

1. Establish canonical chain identities through `BridgeChainRegistry420.setChain`; register canonical and Bridge assets with verified units and precision; stage routes with `BridgeRouteRegistry.setRoute` as APPROVED_INACTIVE. Bind the exact route/asset/network/source-gateway and adapter IDs. Configure underlying token/mint mappings and source/provider peers. Generic token routes share their already qualified chain adapters.
2. Use `GatewayRouter420.setAdapter` only for the independently reviewed final production instance. Configure route/asset risk limits and canonical router permissions through the existing risk and transfer registries. Reconcile actual owned backing, circulating claims, pending obligations and the custody/token execution graph. Configure custody and issuer-native providers through their existing paths. Source readiness includes finality/bootstrap, deployed gateways, backing/outcome proofs, owned custody/HSM and issuer authorization, as applicable.
3. Record `BridgeVerifierRegistry420.record(registration, expectedPrevious, true)` only after the exact consumer/verifier and all dependency runtime/implementation identities, trusted-root/configuration probes, proof system, direction mask, evidence hash, chain identities and expiry are independently qualified. For supported proxies use the existing explicit proxy profiles. JSON labels, a matching ABI or a test root cannot grant this approval.
4. Activate the exact reviewed route tuple with `setRoute(... ACTIVE ...)`, which atomically binds the current qualification and chain identities. Enable only qualified directions. `requireAdmission` and router operational checks must pass for the exact asset and direction. VerifiedGateway420 and CADC integration use their existing explicit qualification-binding APIs. Do not activate the disabled gateway by merely setting a verifier or approving an asset.
5. Run the original funded qualification in `420BRIDGE-TESTNET-WORK-ROADMAP.md`, retaining genuine source finality/execution/payment/cancellation evidence, destination receipts, replay identities and accounting/risk conservation. Only this evidence can close live requirements.

## Isolation, rollback and recovery

Disable both directions with `BridgeRouteRegistry.setDirection(routeId,false,false)` and suspend the route with `setRoute(... SUSPENDED ...)` under governance. These isolation paths remain available after qualification revocation or chain drift. Apply the existing shared pause/safety controls as appropriate. Revoke compromised qualification using `BridgeVerifierRegistry420.revoke(approvalId,reason)`; retain the append-only registration/evidence history.

Keep consumed source messages, transfer IDs, approvals originally pinned to transfers, custody liabilities, pending withdrawals, replay state and BTC UTXO reservations. Do not replace populated registries or copy a previous storage snapshot over later state. An old deployment is not automatically safe to restore: runtime, source authority, roots, configuration and route bindings must still be current. A changed route tuple needs fresh qualification; new approval cannot launder an earlier transfer's stale approval.

Pause/dispute affected transfers through their existing lifecycle APIs. Retry and settlement recovery require the original qualified evidence and current authorization. A timeout, missing RPC result, governance label or unconfirmed cancellation does not establish nonpayment or authorize a refund. Refund local claims only through the existing qualified permanent cancellation/source-repayment paths. For replacements, qualify state/reservation migration before governance switches bindings. Reconcile supply, escrow, risk exposure and pending claims before reenabling any direction.

Deployment-specific failures and the existing source/issuer/provider prerequisites remain in the existing testnet roadmap. The current global freeze conflict stays in this pre-testnet closeout record; it is not relabelled a testnet dependency.

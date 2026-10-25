# TN-FAN-01: local deployment readiness and official-network boundary

The opening format remains the established uncapped daily NHL points pool, with paid and launcher-funded free configurations. The earlier deferral of H07 salary-cap/captain, H08 season-long and H09 pick'em was superseded by the user's 2026-10-25 request for [local draft frameworks](BET-FANTASY-FORMAT-FRAMEWORKS-V1.md). Their funded integration remains a separate local milestone. This step adds deployment/integration tooling, not another fantasy format or production activation.

## Work split

| Work | Can be completed now? | Implementation/evidence |
| --- | --- | --- |
| Freeze source, scoring adapter, ABI, compiler and constructor graph | Yes | Deployment bundle: 16 module identities, source SHA-256, creation/runtime-template keccak, ABI checksums; solc 0.8.30, Cancun, optimizer 200, viaIR |
| Reuse canonical identity, capabilities, oracle, development vault and $420 asset | Yes, as an integration | Four-step unsigned fantasy deployment DAG; it cannot deploy a replacement canonical token or core authority. Official addresses remain externally supplied inputs. |
| Verify constructors, runtime code and dependency wiring | Yes | Real local deployments, compiler immutable-template comparison, explicit getters and constructor-transaction/receipt checks |
| Prepare custodian, publisher, reporters, resolver and admin authority | Yes | Existing key initializer; bounded grant/revocation and oracle provisioning planners; six distinct keys, verified canonical identities, exact pool/slate scopes, maximum seven-day leases |
| Protect identity/nonparticipation, beneficiaries and source policy | Yes | Operator controller/credential/issuer/person-key checks; pool conflicts; immutable development/community destinations; two Sportradar operators explicitly remain one upstream |
| Bind manifests, detect drift and export client configuration | Yes | Code/source/network/genesis checks, dependencies, snapshots, receipts, capability inventory, provider/feed/source epochs, risk configuration and gas reserve; export exercises the actual client adapter and sealed roster; the client/server and wallet also check pinned genesis identity |
| Execute negative integration qualification | Yes | 32 real Anvil cases including revoked/expired/unapproved authority, provider rotation, wrong network/code/beneficiary/credential/feed/receipt, and rejection of local evidence as official deployment |
| Select official network/asset/operator/beneficiary values | Does not inherently require a live chain | Authoritative inputs and independent designation/approval remain needed. The template leaves them null; they can be supplied and reviewed before launch. |
| Prove those values on the official running chain | Requires live testnet | Finalized deployments, predeploy/asset/runtime reads, actual grants/registrations/epochs, gas funding and receipt/reorg evidence: TN-FAN-01-L1–L4 in the testnet roadmap |
| Prospective sports reporting, funded entry timing and live settlement | Requires testnet and actual events | Existing TN-FAN-02–05; local synthetic qualification cannot close them |

## Local qualification

Use the daily application's Python requirements, Foundry 1.8.6 and solc 0.8.30:

```sh
python -m pip install -r clients/420bet-fantasy/daily/requirements.txt
python scripts/fantasy/qualify-deployment-readiness.py --output work/fantasy-deployment-readiness
```

The runner compiles only the canonical fantasy import closure, deploys actual production contracts to its isolated Anvil, executes the complete 32-case inventory, and emits an exact-SHA Level 2 certificate only for clean scoped source. Explicit binary paths use `--forge`, `--anvil`, `--solc`. `--diagnostic-build` reuses an earlier build for debugging and never emits a qualification certificate. Compilation alone is not a test pass.

Public evidence: qualification.json, offline-bundle.json, local-deployment-manifest.json, constructor-transactions.json, receipt-evidence.json, unsigned-authority-plan.json, local-attestation.json, application-config.json and compile/test logs. Do not upload private/ or anvil.log. Keys and custody databases stay private. The focused workflow runs deployment readiness plus the complete browser flow in both legacy ERC20 and canonical Wrapped420 modes; it does not dispatch global qualification.

For browser regression/native wrapping qualification, follow the existing daily client install/build instructions and run `qualify-daily-application.py --asset-kind erc20` and `--asset-kind wrapped-native` with separate output directories. Wrapped mode backs its local tokens with actual native deposits and exercises explicit browser wrap/unwrap, both funded pool configurations, disputes, settlement and refunds.

## Operator sequence

The implementation is [deployment.py](https://github.com/abvhiael/420-integrated-v0.1/blob/main/clients/420bet-fantasy/daily/deployment.py). Production-facing commands only read state or produce unsigned transactions; none broadcasts or accepts a private signing key.

1. Run `python clients/420bet-fantasy/daily/deployment.py bundle --build BUILD --output bundle.json`. Review its source/compiler digest against the qualified release. Keep the approved bundle/digest separately: a newly generated self-consistent manifest is not independent approval.
2. Fill [official-bindings.template.json](https://github.com/abvhiael/420-integrated-v0.1/blob/main/clients/420bet-fantasy/daily/official-bindings.template.json) with authoritative network, asset, module, beneficiary and identity values. It is an input checklist, not a deployment success marker. Null and zero addresses are rejected by construction/attestation.
3. Reuse canonical core/asset contracts. Prepare bindings.json mapping contract names to addresses and parameters.json containing chainID/assetKind/issuer/userType/resolverType/community. Resolve each step with `transaction --build BUILD --step NAME --bindings bindings.json --parameters parameters.json --sender DEPLOYER --output unsigned.json`. Order: disputes, slate book, scorer, engine; the engine creates admission/rankings/payout-policy children. Record actual child addresses and all four deployment receipts.
4. Prepare `authority-plan` with bindings, roles, parameters, RPC and explicit valid-from/valid-until. The canonical API requires global CREATE authority for the creator; publication/validation use the exact slate; registration/invitation/conflict actions use the exact pool. A gas-only publisher receives no BET grant. `oracle-plan` configures actual provider operators, feed quorum, source set and risk policy. No speculative resolver grant is issued: it requires an actual independent pending claim and cannot outlive that claim's deadline. Delegation remains a separately activated later path.
5. Plan `from` values identify the required caller. If it is a timelock or smart account, submit through its approved execution process; do not impersonate it as an EOA. Execute externally only under real deployment authority. Provider/feed epochs are checked when preparing plans, not atomically by the registry setters. Recheck before signing and attest finalized post-state before admission.
6. `revoke --build BUILD --bindings bindings.json --grant-id ID --sender AUTHORITY --rpc RPC --output revoke.json` builds a real registry revocation. Local qualification executes revocation, expiration and reporter rotation and verifies fail-closed attestation. Actual operational response and custody/backups remain TN-FAN-05.
7. Collect an intent JSON with modules (all 16 actual addresses), parameters, roles, providers, feeds, grants and receipts. `bind --intent intent.json --build BUILD --rpc RPC --official --output manifest.json` pins finalized code/network/genesis/epochs/receipts and verifies all bindings. The generated local manifest is a schema example only; its chain, keys and addresses are local test values.
8. `verify --manifest manifest.json --build BUILD --rpc RPC --official --output attestation.json` reruns checks. `export-app --manifest manifest.json --metadata metadata.json --build BUILD --rpc RPC --official --output application.json` exports existing client configuration after verification and actual sealed-slate/roster reads. Metadata contains RPC, deploymentBlock, public profiles, the provisioned slate, explicitly listed pool IDs and pinned candidate feeds. Start the existing server/custodian with that configuration and protected keys.

Outputs refuse overwriting files. Archive each approved revision/digest. Local qualification permits loopback chain 31337 only and cannot be relabelled as official deployment. Production authorization is always false. Technical consistency is not an independent network/asset designation or release approval.

## Canonical asset and inputs

The repository already defines `Wrapped420` as the canonical ERC20 representation of native $420; `deployments/exchange/testnet.runtime.json` still leaves its actual testnet address unresolved. This package integrates that existing wrapper rather than minting a parallel token. The client supports explicit 1:1 native wrapping/unwrapping and pool escrow uses the backed wrapper. Constructor plans cannot deploy a substitute asset. Attestation verifies the actual Wrapped420 runtime and native collateral covering total supply; its official address/designation is still a prelaunch input, and finalized deployment evidence is a live gate. Legacy ERC20 test-token mode remains supported for inherited local fixtures and is not an official asset designation.

Local synthetic verified credentials prove contract integration, not verification of real operators. Governance identities, beneficiary designation, source rights and authority approval can be supplied before launch. Finalized proof of deployment/activation requires the live network. Two keys using Sportradar do not constitute independent sports sources.

Authority and client export accept an explicit `parameters.pools` batch (up to 32 IDs per reviewed manifest, with `pool` retaining the primary ID). This bounds each authority review, not the number of entrants or the total number of pools. The local deployment test provisions two independent pool scopes so paid and free configurations can share the same engine without broad registration authority. Extra undisclosed pool IDs are rejected.

## Qualification ledger

Executable code SHA `9a259013a9a32258d33b64cb5d010620f5a99a77`: 32/32 real deployment/readiness tests, 12/12 complete browser scenarios in legacy ERC20 mode (204 successful transactions), and 12/12 in canonical Wrapped420 mode (207 successful transactions). Both browser runs finished with zero contest/bond escrow balances and liabilities. The complete fixtures use actual verified custodian identities, bounded seven-day authority and claim-deadline resolver leases. Native wrapping/unwrapping and wrong-genesis wallet rejection were exercised. Certificates and evidence checksums were independently verified. This is local Level 2 evidence; no official deployment, production approval, live sports settlement or external wallet-extension approval UI is claimed. The workflow is provided but was not run remotely in this task.

This ledger is documentation only and inherits that exact executable qualification by unchanged source identity. Actual generated certificates/receipts, not this paragraph, are required acceptance evidence.

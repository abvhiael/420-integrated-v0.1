# BRIDGE-AUDIT-3.V.20 — Production Admission and Fail-Closed Enforcement

Implements the supplied BRIDGE-AUDIT-3.4 requirements, 2026-11-15 (America/Regina).
Authoritative main: `97413f2eea862d5f2ec3117313cd3beb15a634f4`. Required unmerged dependency: V.19 / PR #1173, `deaa99174ea95850d1c7b17cd613c34a26ae4b65`. This is an incremental change on that exact qualified dependency; it does not silently represent V.19 as merged.

## Enforcement and exit criteria

| Original requirement | Enforcement |
| --- | --- |
| GatewayRouter420 qualification | Retains V.19 exact implementation/configuration checks before and after proof/dispatch. Rechecks adapter ID live and qualification/route again after transfer-registry callbacks, before reporting success. |
| BridgeRouteRegistry qualification | ACTIVE registration atomically validates current chain identities, current instance qualification, direction mask and exact route tuple, and pins the binding. Invalid activation reverts the entire update. Inactive staging remains available. |
| Adapter/verifier bindings | Canonical router adapter resolution, exact consumer address and verifier getter/implementation identity; route/configuration/chain mismatches fail closed. Direct admission guard validates canonical chain and resident registration as well as qualification. |
| Approved runtime hashes | ProtocolRegistry-resolved residents and dependencies plus qualification runtime/implementation hashes checked at use. No replacement address, changed code or proxy implementation inherits the old binding. |
| Unqualified route activation | An ACTIVE route cannot be registered without an approved and current verifier. Changed pinned route tuples require fresh qualification. Existing active flags becoming stale after revocation never confer execution permission. |
| Revoked/substituted components | Router admission, direct route guard and positive transfer lifecycle advancement fail closed on revoked/stale/current-approval mismatch. A transfer captures its original exact qualification/route registry identity; a new approval cannot launder its old verification. |
| Alternative paths | Transfer creation requires the exact canonical router, in addition to its governance trust flag. Only that router may assert VERIFIED. Operators retain permitted lifecycle operations but cannot fabricate proof authorization. CADC control-plane activation and live use require explicitly bound current qualification. Legacy placeholder adapters still revert. |
| Execution-time checks | Source/transaction acceptance and outbound dispatch check current admission; positive lifecycle transitions, retry/resume into positive states, destination pending and completion recheck live route qualification and the original transfer binding. |
| Emergency controls | Both directions can be disabled after qualification/chain drift. Route suspension, transfer pause/dispute/expiry and existing governed refund controls remain available; positive resume/settlement cannot bypass revocation. Existing global pause, safety, risk and accounting controls remain in force. |

## Configuration and integration

Stage a route APPROVED_INACTIVE first. Configure its adapter, establish the reviewed V.19 qualification record, then set the exact approved route ACTIVE. Activation now installs its binding atomically. Existing bindVerifier remains available for explicit governance rebinding. Changing directions on an active route must retain a qualified tuple, except disabling both directions, which remains available without a current verifier. A fresh approval is required when an already pinned tuple changes. No additional approver, branch rule or governance delay was introduced.

A route may describe either local-to-remote or remote-to-local chain orientation. V.19 initially required the destination to be local; this step accepts either endpoint as local while requiring the recorded exact source/destination identities to remain unchanged at execution. Wrong-network, wrong-chain and configurations with neither endpoint local remain rejected.

BridgeTransferRegistry records a hash of the route registry address/runtime and exact verifier binding on creation. Positive advancement requires that identity to remain current. Pending transfers do not silently adopt a replacement approval. Suspension and refund/recovery use their existing authorization controls; approval replacement never clears replay state. Deployments with pre-existing transfer storage require reconciliation; no upgrade or migration of live state is claimed. These residents are deployed contracts, not an assertion of proxy storage-layout compatibility.

CADCBridgeIntegration.bindQualification records an explicit current qualification. configure clears that binding. Its public configurationState commits to token, endpoint, issuer OFT and security/peer hashes. Qualification manifests must also include actual dependency implementation identities and all protocol-specific security state, as required by V.19. Consumers must call requireActive; reading a stored active flag is not an execution authorization. This contract still does not mint, burn or custody CADC and does not confer issuer authorization.

Only a successful qualified verifier call can cause the canonical router to mark an inbound transfer VERIFIED. Outbound initiation retains SOURCE_PENDING behavior; operators cannot invent proof authorization to force its completion. No new outbound receipt verifier or consensus proof format is invented here. Unsupported dispatch/receipt paths remain closed until their existing underlying chain/protocol integration is qualified.

Direct calls to pure/observational verifier routines do not settle assets. All legacy placeholder adapter entrypoints revert. Accounting reconciliation is evidence recording under existing governance; it does not mint or settle. The Pay/Swap integration uses the same canonical bridge admission and is included in affected regression qualification.

## Evidence and status

Actual logs, exact import closures, source checksums, compiler configuration and production runtime size assertions are retained in production-admission-qualification/. Controlled mock proofs qualify admission enforcement only; they are not historical consensus or issuer evidence. Prior V.19 evidence remains attributed to its original SHA; no earlier historical blockchain or issuer qualification is relabelled as new evidence. The runner closes owner selection explicitly, excludes unrelated imported test suites and independently enforces EIP-170 production sizes even though test harnesses need a larger code-size limit.

Repository implementation and local qualification are distinct from live production admission. Production approval records remain empty. Actual deployment, approved manifests, governance transactions and end-to-end live qualification depend on approved testnet infrastructure and authentic source/issuer authority evidence already required by earlier steps. No live registrations, balances, deployment addresses or issuer approvals are invented.

The supplied task list ends at V.20 and available main does not identify its canonical successor. No subsequent step is invented or begun. Merge and exact published SHA are reported in the pull request.

## Actual local qualification results

145 distinct cases qualified: 136 passes in the main batch, eight CADC passes, and the affected admission invariant rerun. Four fuzz cases execute 2,500 runs each (10,000 cases). The two invariants each execute 128 runs at depth 64, 16,384 calls total, with zero handler reverts. All eight compiled production runtimes satisfy EIP-170; largest is 22,063 bytes. Full compiler/runner inputs and sizes are retained alongside the logs.

The only test failure was setup of the new invariant: its constructor attempted to register itself as an operator before its runtime code existed, violating the existing operator code-length guard. Initialization now occurs after deployment; only that invariant was rerun. The eight passing CADC cases were preserved. The main batch began before addition of CADC's public configurationState getter; all eight CADC cases exercised the final getter and source. Exact earlier source snapshots match captured input hashes, and all other tested sources are unchanged. No passing chain-consensus or historical qualification was repeated. The V.19 registration/live-configuration tests were affected by the local-source/local-destination orientation correction and were therefore included.

The four edited workflows parse and retain their job bodies and branch controls unchanged. Path exclusions are limited to this audit's evidence and bridge-only policy. Existing skip-ci publication avoids redundant local qualification runs; no GitHub Actions run IDs are claimed.

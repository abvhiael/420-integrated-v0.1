# ARB-PRE-11 — Arbitration Operations and Testnet Handoff

Status: REPOSITORY PREPARED ONLY. No live deployment, operational testnet, production signer or private Storage service is asserted. Never copy Anvil chain ID 31337, ephemeral test keys/addresses, snapshot receipts or simulated finality into a public testnet record. This runbook preserves REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS.

## 1. Shift start and authorization

1. Pin exact commit SHA, approved release artifacts, Solidity 0.8.24 / Cancun / via-IR / optimizer 200. Compare the current main branch with the qualified source. Preserve a redacted copy of each source commit, transaction receipt and review decision.
2. Read contracts/config/genesis-address-namespace.json and contracts/config/arbitration/arbitration-audit-4-release-materialization.json. The existing GovernanceTimelock and ProtocolRegistry namespace is authoritative. No new Arbitration fixed address, CREATE2 salt or Genesis parameter may be introduced.
3. Independently verify actual chain ID, Genesis hash, consensus finality status and RPC agreement. Do not trust a wallet provider, one RPC or an Indexer API as authority for deployment or signing.
4. Identify the currently authorized GovernanceTimelock scheduler and Civic activation state. Respect the governance process, frozen class delay floors and the seven-day G1 floor. Schedule and execute are distinct transactions; never use Anvil impersonation as live authority.
5. Before any write, verify exact target code hash, calldata selector/arguments, signer, domain, Registry version, state preconditions, expected receipt and rollback limits. Capture explicit approval and preserve the operation ID and two transaction hashes. Prevent secret-bearing logs and unauthorized automation.

## 2. Deterministic deployment and release verification

Execute the already qualified local drill twice before any live network attempt:

    python3 scripts/verify-reg-audit-4-genesis-address-namespace.py
    python3 scripts/verify-arbitration-audit-4-release.py
    (cd contracts && forge build src/governance/GovernanceTimelock.sol src/apps/ProtocolRegistry.sol src/arbitration/ArbitrationPolicyRegistry420.sol src/arbitration/ArbitrationCaseRegistry420.sol src/arbitration/ArbitrationRulingRegistry420.sol src/arbitration/ArbitrationRouter420.sol)
    npm install --prefix scripts --no-save --no-package-lock --ignore-scripts ethers@6
    node scripts/qualify-arbitration-pre09-local-genesis.mjs artifacts/arbitration/arb-pre-09/first.json
    node scripts/qualify-arbitration-pre09-local-genesis.mjs artifacts/arbitration/arb-pre-09/second.json
    cmp artifacts/arbitration/arb-pre-09/first.reproducible.json artifacts/arbitration/arb-pre-09/second.reproducible.json
    python3 scripts/verify-arbitration-pre09-local-genesis.py artifacts/arbitration/arb-pre-09/first.json artifacts/arbitration/arb-pre-09/second.json

Live handoff sequence after an actual chain exists: verify real Timelock and Registry code at the already approved namespace addresses; deploy PolicyRegistry with that Timelock; deploy CaseRegistry with Timelock + actual Policy; deploy RulingRegistry with actual Case; execute a legitimate delayed one-time Case.bindRulingRegistry(Ruling); deploy Router with actual Policy/Case/Ruling; govern Registry.registerComponent with component preimage 420/component/arbitration/v1 and ACTIVE lifecycle; govern publishRegisteredService with separate service preimage 420/service/arbitration/v1, sequential version, SERVICE type and verified metadata/manifest/interface/dependency hash commitments; read resolveActive and component references; finally verify all constructor immutables, receipt ordering, runtime code hashes and actual event block hashes.

Binding to EOA, wrong Case ledger, or a second ruling ledger must revert. No Router deployment before the correct one-time binding. Do not copy local manifest metadata into the live publication unless separately approved. Governance actions must be scheduled by the actual scheduler and executed after the applicable delay.

Read-only commands, with variables supplied from independently verified live evidence rather than defaults:

    cast chain-id --rpc-url "$RPC_URL"
    cast block 0 --rpc-url "$RPC_URL"
    cast code "$REGISTRY" --rpc-url "$RPC_URL"
    cast call "$REGISTRY" "resolveActive(bytes32)(address,uint32)" "$ARBITRATION_SERVICE_ID" --rpc-url "$RPC_URL"
    cast call "$CASES" "rulingRegistry()(address)" --rpc-url "$RPC_URL"
    cast call "$RULINGS" "cases()(address)" --rpc-url "$RPC_URL"
    cast call "$ROUTER" "cases()(address)" --rpc-url "$RPC_URL"

Capture original RPC responses, block numbers/hashes, computed code identity and independently decoded receipts. An RPC call alone cannot certify a release. Live networks must never be modified with anvil_setCode, anvil_setStorageAt, evm_snapshot or evm_increaseTime.

## 3. Domain policy and resolver onboarding

GovernancePolicy: PolicyRegistry.setPolicy(domainId,resolver,appealResolver,evidenceWindow,appealWindow,maxAppeals,active). Confirm nonzero domain/resolver, positive uint64 windows, maxAppeals <= 3 and nonzero appealResolver when appeals are allowed. Policies default inactive; activation is a governed action, not an API toggle. Verify original source-domain ownership and permission to refer origin disputes before enabling.

Resolver onboarding: verify the signing key in approved hardware/remote signer boundary, test chain-bound signing and backup/recovery, register the exact address and operator contact in the private authorized runbook, and read back the Timelock-executed PolicySet event. Verify the Wallet session/chain/genesis and domain before ruling. RulingRegistry.submitRuling requires the exact current-round snapshotted resolver, OPEN case, nonzero outcome, ruling hash and remedy commitment, and no existing ruling for that round. Never upload a private key, seed phrase or evidence decryption key into the manifest.

Resolver key rotation: establish replacement signer, test control, schedule a new policy via the authorized governance path, and verify it becomes current for newly opened cases. Already opened cases snapshot resolver, appealResolver, windows and maxAppeals; policy changes DO NOT rotate an existing case signer. Keep prior signer available until in-flight cases finish. If an old private key is lost or compromised, stop its operations and escalate. There is no supported admin override that changes a case's snapshotted resolver; do not invent one.

## 4. Evidence privacy, case, appeal and finality monitoring

Opening a case commits claimant sender, distinct respondent, exact domain, origin component/object, claim hash and requested remedy commitment. CaseRegistry state is canonical. Record the caseId, block hash and complete policy snapshot. Evidence is a hash commitment only, not plaintext. Only claimant/respondent may commit within the current OPEN round at or before evidenceDeadline. Duplicate commitments in the same round revert.

Encrypt private evidence locally, bind the capsule to exact case/round/submitter and capability, and keep plaintext out of chain events, RPC traces, browser logs, screenshots, cache and artifacts. Remote 420Storage private retrieval/ingest stays disabled until a real Wallet-controller authenticated session issuer, private-only Gateway authorizer, resource agreement, retention/revocation and authorized HTTPS gateway are deployed and verified. A 420ID login alone is not a Wallet signature.

Monitor CaseOpened, EvidenceCommitted, CaseRuled, CaseAppealed, CaseFinalized, RulingSubmitted and RulingFinalized against canonical receipt/block provenance. Read CaseRegistry.caseState, caseRound, getCase and RulingRegistry.getRuling; mark stale/pending/reorganized/confirmed user visibility explicitly. The Indexer is a read-only projection, never a source of signing authority or finality.

Appeal: only claimant/respondent, RULED state, block timestamp at or before appealDeadline and round strictly below maxAppeals. A valid appeal increments round, reopens evidence and selects snapshotted appealResolver; earlier ruling rounds remain immutable. Finalization: after the appeal deadline strictly expires, anyone may invoke RulingRegistry.finalizeRuling if the current-round ruling exists. Confirm FINALIZED on the chain, not from a submitted or pending receipt. No further appeal is allowed.

Read-only examples:

    cast call "$CASES" "caseState(bytes32)(uint8)" "$CASE_ID" --rpc-url "$RPC_URL"
    cast call "$CASES" "caseRound(bytes32)(uint8)" "$CASE_ID" --rpc-url "$RPC_URL"

## 5. Infrastructure and Indexer recovery

RPC interruption: stop new broadcasts when chain/genesis, registry identity, nonce, code, receipt or peer data disagree. Record the pending intent and transaction hash; do not blindly resend. On recovery verify the chain from independent peers, re-resolve Registry, recheck pending receipt and require fresh explicit Wallet review.

Wallet interruption: accountsChanged, chainChanged, disconnect, session/permission expiry, signing rejection, gas/simulation drift and changed Registry version invalidate cached review and pending intents. Do not restore previously approved signatures across changed contexts. Recreate intent after verifying account/chain/service and user reconsent.

Indexer/API interruption: stop ingestion at the last atomically committed PostgreSQL checkpoint. Record recent canonical block hashes, receipt source and reorg depth; recover via native SqlCheckpointStore420 / SqlCanonicalHistoryStore420 and the bounded rollback/replay path, not by manually overwriting final states. Check deterministic rebuild and duplicate suppression; use 420-indexer/test/arbitration-recovery-postgres.test.ts with a separate test PostgreSQL database. DO NOT run the test fixture's schema-drop operation against production SQL. Expose stale/reorganized API views instead of fabricated confirmations.

Chain reorganization: reject orphaned receipts, mark affected user-visible history noncanonical, identify the verified common ancestor, roll back only derived projections within approved recovery depth and re-ingest canonical events. Re-read direct on-chain CaseRegistry/RulingRegistry and reconcile finalization and origin settlement. Do not infer genuine validator finality from local Anvil snapshot/revert or from elapsed time.

## 6. Service deprecation, Registry recovery, incident response

Service pause: obtain approved governance authority to call ProtocolRegistry.deprecateService(serviceId). Verify service becomes inactive and resolveActive fails; Wallet and Indexer must reject stale targets. Component lifecycle is separate: use authorized setComponentLifecycle to pause a component where appropriate, and inspect both component and service activity. Existing case records are not erased by service deprecation.

Recovery: verify code hashes, immutable dependency graph, original provenance, active component lifecycle and latest service revision. Schedule governed publishRegisteredService with version EXACTLY prior version + 1, correct metadata/manifest/dependency/interface commitments; if the component legitimately changes, separately register the verified new component reference. Verify historical old version remains inactive, new version is active, and consumers refresh pinned code/version and reject cached signed intents.

Incident triggers: key compromise, unauthorized resolver, wrong chain, forged ruling, private capsule disclosure, Registry/hash mismatch, RPC equivocation, deep reorg or settlement discrepancy. Contain affected Wallet signing, consumer execution and remote evidence routes without pretending governance can rewrite an already finalized case. Preserve redacted UTC timestamps, exact release SHA, canonical receipts, block hashes, case origin/round, operator actions, Timelock operation IDs and incident evidence. Escalate to the existing authorized security/governance process; never transmit signer secrets in issue trackers or CI.

Rollback: an unexecuted Timelock operation may be canceled only by the bootstrap governor while civicAuthorityActivated is false and the operation is still cancellable. After Civic activation legacy cancel is disabled. Executed governance writes, one-time Ruling binding, immutables, finalized case, evidence commitment and historical Registry revisions cannot be reverted. Use a new governed service version, governed component lifecycle or an application configuration rollback where applicable. A reorg may invalidate unfinalized history, but SQL rollback cannot change real finalized chain state.

## 7. Origin-protocol remedy troubleshooting

Arbitration never holds custody or executes refunds/rights rewrites. Only originating Commerce/Market, Launchpad/Pay/Allocation or other explicitly integrated contracts decide and execute remedy. Check exact original claimant, respondent, domain, component/object, finalized current appeal round, ruling/remedy commitments and originating contract authorization. Compare the origin's consumed marker, settlement/refund transaction, nonce, ledger postings and conservation; reject forged cross-domain/object links and double consumption. If inconsistent funds movement occurs, stop the owning consumer path and use its existing settlement/rollback policy, not an invented Arbitration transfer hook. Indexer or UI "finalized" presentation is not a payment authorization.

## 8. Application configuration and release evidence capture

Canonical UI is Wallet-integrated Genesis application, not a newly invented standalone deployment. Configure chainId, Genesis hash, Registry endpoint, service ID, current service version, router/dependency hashes and authenticated Wallet controller from actual qualified release evidence. Do not auto-sign. Verify browser onboarding, account/chain changes, explicit review, pending and reorg views against the qualified local browser test before any public release.

The structured EMPTY template is contracts/config/arbitration/arb-pre-11-testnet-handoff-template.json. Keep every live-only field null, false or empty until genuinely verified. Create a separate live evidence file after the public testnet exists, never overwrite the template. Capture real chain/genesis, four deployed contracts with constructor arguments, deployment transaction/block hashes, runtime bytecode hashes, Timelock schedule/execute and binding, component/service publication and commitment receipts, active resolution, A-I plus private Storage scenario results, workflow ID/SHA/artifacts, independently reconciled Indexer state, operator approval and finality. Do not copy local Anvil chain IDs, local fixture addresses or fabricated confirmations.

Executable repository preparation and negative schema checks:

    python3 scripts/verify-arbitration-pre11-handoff.py --template
    python3 scripts/verify-arbitration-pre11-handoff.py --runbook
    python3 -m unittest discover -s scripts/tests -p 'test_arbitration_pre11_handoff.py'

Future real evidence structural lint (not an on-chain attestation):

    python3 scripts/verify-arbitration-pre11-handoff.py --candidate /path/to/independently-collected-testnet-evidence.json

The independent live-chain proof remains ARBITRATION-AUDIT-5. It must verify actual finality/reorg, Registry/Wallet/Indexer and private Storage sessions/retention/issuer with correct chain receipts, not just a filled manifest. Independent production security closeout remains ARBITRATION-AUDIT-6.

## 9. Local drill, monitoring signoff and escalation

The ARB-PRE-11 exact-head workflow verifies template, source policy, malformed manifest rejection and this runbook, then repeats the real local Genesis governance/deprecation/recovery drill. Retain CI run ID, exact SHA, companion reproducible manifest and existing ARB-PRE-10 browser, Indexer, Commerce/Launchpad, adversarial and documentation evidence.

Monitoring shift handoff must identify who watches the chain/Registry version, stalled cases approaching evidence/appeal deadline, unread rulings awaiting finalization, signer health and session revocation, Indexer lag/checkpoints and event-log gaps, private evidence expiry, and origin settlement reconciliation. Record alert time and owner, and escalate when signer snapshots become inaccessible, untrusted service metadata appears, an RPC fork exceeds the recovery limit, a private gateway cannot authenticate the Wallet controller, or the origin ledger fails conservation. On any such condition FAIL CLOSED; do not invent authority or premature testnet qualification.

# AI-AUDIT-10.1.B — dependency and authority reconciliation

Source snapshot: d22ed00cbd98315ec8883487ba3ba0a39f48d620. Main baseline: 2bcf3155d55c442714a25e3d5e49f04ed96749f8. Companion: [current-main inventory](420AI-AUDIT-10.1-CURRENT-MAIN-INVENTORY.json). This records source behavior, not live activation or new runtime qualification. All AI function names below refer to contracts/src/ai/<contract>.sol at the source snapshot. Governance means the immutable SystemAccess.governanceTimelock, not an arbitrary administrator. An unqualified caller, missing record, downstream revert or arithmetic overflow reverts the whole transaction unless explicitly described otherwise. No event means none emitted by that function; downstream events are identified separately.

## 1. Job lifecycle — AIJobManager (frozen 0x0431)

| Initiator / entry point | Receiver / authorized caller | Required evidence and failure conditions | Mutation | Event |
|---|---|---|---|---|
| User create / createRequest | JobManager; caller becomes requester | Unique nonzero job/model/input, recognized workload, nonzero spend, future deadline; legacy defaults text, max uint, zero policy IDs, one day | NONE → CREATED; store requester and request constraints | JobCreated |
| Governance bindComputeAdapter | JobManager; timelock | Nonzero adapter, not previously bound; no code check at bind | Adapter address and bound flag | ComputeAdapterBound |
| Escrow confirmFunding | JobManager; 0x0432 only | CREATED, nonzero reference and amount within max | FUNDED, fundingRef, fundedAmount | JobStatus, FundingConfirmed |
| Adapter confirmCanonicalFunding | JobManager; bound adapter only | Same local checks; upstream CMP credit and funded evidence | Same | JobStatus, FundingConfirmed |
| Adapter matchCompute | JobManager; bound adapter | FUNDED; nonzero request/job/provider IDs | MATCHED and three IDs | JobStatus, ComputeMatched |
| Adapter acceptCompute | JobManager; bound adapter | MATCHED | ACCEPTED | JobStatus |
| Adapter markRunning | JobManager; bound adapter | ACCEPTED | RUNNING | JobStatus |
| Adapter commitResult | JobManager; bound adapter | RUNNING, nonzero result and manifest hashes | RESULT_COMMITTED and hashes | JobStatus, ResultCommitted |
| Adapter verifyResult | JobManager; bound adapter | RESULT_COMMITTED; upstream verified entitlement | VERIFIED | JobStatus |
| Escrow confirmSettlement / adapter confirmCanonicalSettlement | JobManager; frozen escrow / bound adapter respectively | VERIFIED; upstream settlement evidence | SETTLED | JobStatus |
| Escrow confirmRefund / adapter confirmCanonicalRefund | JobManager; frozen escrow / bound adapter respectively | FUNDED, EXPIRED or FAILED; DISPUTED excluded | REFUNDED | JobStatus |
| User cancel | JobManager; requester | CREATED only | CANCELLED | JobStatus |
| Anyone expire | JobManager | Strictly after deadline; CREATED, FUNDED, MATCHED or ACCEPTED | EXPIRED | JobStatus |
| Adapter markFailed | JobManager; bound adapter | MATCHED, ACCEPTED or RUNNING | FAILED | JobStatus |
| Requester openDispute | JobManager → bound code-bearing adapter → canonical CMP resolver | RESULT_COMMITTED or VERIFIED; unique nonzero case ref; active nonfinal hold; matching nonzero job, result and verification refs | Increment sequence; append original state, job, result, case, verification; consume case ref; DISPUTED | DisputeContextRecorded, JobStatus, DisputeOpened |
| Anyone resolveDispute | JobManager → adapter → CMP resolver | DISPUTED; unresolved context; inactive hold and final outcome; exact case, job, result, verification and resolution; supplied upheld must equal !providerWins | Persist resolution/outcome; provider win restores original status, payer win FAILED | JobStatus, DisputeResolved, DisputeContextResolved |

No terminal outgoing transition other than EXPIRED/FAILED → REFUNDED. Creation does not itself establish model/policy/license validity or capability grants. The JobManager does not independently validate CMP tuples for ordinary adapter callbacks. Expiry is local, not a canonical CMP cancellation. Dispute restoration is not verification or settlement. The existing jobs() ABI remains unchanged; dispute context is separate storage. See discrepancies B01–B05.

## 2. AIComputeAdapter420 — CMP synchronization

Constructor requires code at six AI/CMP inputs (jobs, authorization, computeRouter, aiProviders, models, deployments). It resolves immutable jobRegistry, matchRegistry, settlementAdapter, providerRegistry, fundingAdapter from ICompute420 and requestEvidence from jobRegistry; each must have code. Resolver discovered dynamically through disputeResolver(). No native custody or CMP write calls.

| Initiator / entry | Receiving components and exact reads/calls | Caller and evidence / failure conditions | Mutation | Events |
|---|---|---|---|---|
| bindComputeRequest | jobs.jobs; authorization.isRequestAuthorized; computeRouter.componentGraphHash; deployments.getDeployment/isOperational; aiProviders.providers; models.modelVersions; computeRequests.getRequest; computeProviders.provider | Requester or ACTION_BIND_COMPUTE grant scoped to AI request and AI maximum. Unique nonzero IDs, CREATED, matching graph, operational deployment/model/provider, nonzero offer/requirements/schema/verification, CMP owner/workload/input/schema match, spend/deadline no broader, authorization expiry covers deadline, request commitment equals request ID and domain-separated manifest matches, active CMP provider with operator and settlement account | Persist binding including payer, graph, deployment, model, provider, offer, policies, schema, bounded spend/deadline; no CMP write | ComputeRequestBound |
| bindComputeJob | computeJobs.job; computeRequests.getRequest; computeFunding.credit/funded; jobs.confirmCanonicalFunding | Anyone; existing binding without job; CMP FUNDED and nonzero funding ref; exact request/owner/commitments/workload/schema/deadline; unrefunded unallocated credit with matching payer/owner/request/deadline, nonzero obligation/deposit/maximum and bounded amounts; funded predicate | Set computeJobId and mirror FUNDED atomically | ComputeJobBound; JobStatus, FundingConfirmed |
| syncAcceptedMatch | computeJobs.job; computeMatches.getMatch/priceReservationForJob/priceReservation; computeProviders.provider; jobs.matchCompute/acceptCompute | Anyone; bound job, not accepted; CMP accepted or later (including DISPUTED); match and reservation exist, job/request/match/offer/provider/payer correspond, nonzero resource, price and bounded maxima; active provider and beneficiary equals current settlement account | Record match/resource/beneficiary/price, accepted flag; AI FUNDED → MATCHED → ACCEPTED | AcceptedComputeBound, ComputeMatched, JobStatus twice |
| syncExecution | computeJobs.job; jobs.jobs/markRunning/commitResult/markFailed | Anyone; accepted binding. CMP running or later advances ACCEPTED; result or later requires nonzero result/assignment and advances RUNNING; CMP FAILED/EXPIRED moves eligible AI MATCHED/ACCEPTED/RUNNING to FAILED. Other combinations may emit without mutation. Result evidence hash binds chain, adapter, job, match, assignment and result | AI lifecycle plus resultCommitment | ComputeResultSynchronized; applicable JobStatus/ResultCommitted |
| syncVerifiedEntitlement | computeJobs.job; computeEntitlements.entitlementForJob/entitlement; jobs.jobs/verifyResult | Anyone; accepted and result present; CMP VERIFIED or SETTLED only; matching result/verifier/verification, job/request/match/payer/provider/resource/beneficiary/accepted price and bounded earned/funded/maximum; AI RESULT_COMMITTED or already VERIFIED | Set verificationRef, entitlementRef; verify only if RESULT_COMMITTED | VerifiedEntitlementBound; conditional JobStatus |
| observeSettlement | computeJobs.job; computeEntitlements.settled; jobs.confirmCanonicalSettlement | Anyone; entitlement and verification bound, CMP SETTLED, nonzero settlementRef, canonical settled predicate; AI VERIFIED | Store settlementRef, AI SETTLED | SettlementObserved, JobStatus |
| observeRefund | computeJobs.job; computeEntitlements.refunded; jobs.confirmCanonicalRefund | Anyone; CMP REFUNDED, nonzero settlementRef, canonical refunded predicate and valid AI predecessor | Store refundRef, AI REFUNDED | RefundObserved, JobStatus |
| disputeEvidence | computeRouter.disputeResolver; resolver.disputeForJob/verificationDisputeDisposition/activeHold; computeJobs.job; computeEntitlements.entitlementForJob/entitlement | Read by anyone; accepted bound job/result; exact case and nonzero code, match request/job/result/verifier/verification policy ID/revision/commitment; matching entitlement/payer/provider/resource/beneficiary/price and existing refs if set; active means DISPUTED, no final resolution; inactive means finalized nonzero resolution and CMP VERIFIED/SETTLED for provider win or FAILED/REFUNDED for payer win | None | None |
| computeManifestHash / getBinding | Local view | Manifest binds domain, chain, adapter, request/deployment/model/requirement/privacy/verification/workload/input/schema/spend/deadline; getBinding rejects absent record | None | None |

CMP identity reconciliation (source in contracts/src/compute/): IAIComputeJobRegistry420 → ComputeJobRegistry420; IAIComputeRequestAuthority420 → ComputeJobSignedRequestAuthority420 (not the similarly named ComputeRequestRegistry420); IAIComputeAcceptedMatch420 → ComputeAcceptedPriceMatch420 (not ComputeMatch420); IAIComputeProviderRegistry420 → ComputeProviderRegistry420; IAIComputeFunding420 → ComputeEscrowFunding420; IAIComputeEntitlement420 → ComputeVerifiedEntitlement420; IAICMPDispute420 → ComputeDisputeResolution420. ICompute420 → ComputeRouter420. These are intended concrete implementation identities evidenced by source, not live address assertions. The AIComputeIntegration420 test substitutes all of these interfaces and CapabilityRegistry with mocks; materialization uses code-bearing placeholders. Real graph/ABI and execution qualification belongs to AI-AUDIT-4/5/10; B02–B05.

## 3. Escrow — AIJobEscrow (frozen 0x0432)

| Initiator / entry | Receiver / authority | Evidence / failure | Mutation | Events |
|---|---|---|---|---|
| Governance bindVaultAdapter / bindSettlementAdapter | Escrow; timelock | Nonzero address, each once; no code check | Corresponding address and bound flag | VaultAdapterBound / SettlementAdapterBound |
| Funding adapter confirmCanonicalVaultFunding | Escrow → frozen JobManager.confirmFunding | Bound vault adapter only; nonzero job/payer/vault/funding/amount, NONE; JobManager must accept | FUNDED, payer, refs, amount; beneficiary/provider unset | Funded, FundingBound; JobStatus, FundingConfirmed |
| Funding adapter confirmVaultFunding | Escrow → JobManager.confirmFunding | Same plus nonzero provider and beneficiary | FUNDED with prebound beneficiary/provider | Same |
| Settlement adapter bindSettlementBeneficiary | Escrow | Bound settlement adapter; FUNDED, both previous IDs unset, both new values nonzero | Bind provider and beneficiary once | None |
| Settlement adapter markClaimable | Escrow | FUNDED, nonzero settlement ref and bound provider/beneficiary | CLAIMABLE, settlementRef | SettlementReferenceBound |
| Settlement adapter markRefundable | Escrow | FUNDED, nonzero settlement ref | REFUNDABLE, settlementRef | SettlementReferenceBound |
| Settlement adapter release | Escrow → JobManager.confirmSettlement | CLAIMABLE and exact beneficiary; downstream VERIFIED | CLOSED, no transfer | Released; JobStatus |
| Settlement adapter refund | Escrow → JobManager.confirmRefund | REFUNDABLE; downstream eligible AI state | CLOSED, no transfer | Refunded; JobStatus |
| Anyone fund / receive | Escrow | Always DirectCustodyDisabled | None | None |

CMP ComputeEscrowFunding420 and ComputeVerifiedEntitlement420 own actual custody authorization with AssetVault420, VaultRegistry420 and VaultAccounting420; the escrow stores mirror evidence only. No production caller of confirmCanonicalVaultFunding located by repository search; direct adapter synchronization bypasses this mirror. Existing materialization binds CMP funding and settlement addresses but does not prove callbacks. Payer/provider/beneficiary correspondence is trusted from adapters, not independently read by escrow; release/refund events do not prove actual native transfer. B04.

## 4. Providers — AIProviderRegistry (frozen 0x042f)

| Entry / initiator | Authority and evidence / failure | Mutation | Event |
|---|---|---|---|
| register / registerProvider | Caller must equal nonzero operator; unique nonzero ID, nonzero settlement; legacy bond converted to hash, not paid stake | REGISTERED, operator, settlement, metadata, stake, CMP provider refs, timestamp, revision 1 | ProviderRegistered |
| updateMetadata | Operator, existing nonretired provider | Metadata and revision | ProviderMetadataUpdated |
| updateSettlementAccount | Operator, nonretired, nonzero address | Settlement and revision | ProviderSettlementUpdated |
| updateStakeReference | Operator, not ACTIVE/RETIRED, nonzero stake | Stake and revision | ProviderStakeReferenceUpdated |
| updateComputeProviderReference | Operator, not ACTIVE/RETIRED | CMP ref and revision; zero allowed | ProviderComputeReferenceUpdated |
| activate | Operator, REGISTERED, nonzero stake ref | ACTIVE and revision | ProviderStateChanged |
| retire | Operator, nonretired existing provider | RETIRED and revision | ProviderStateChanged |
| setActive | Timelock; ACTIVE→SUSPENDED or SUSPENDED→ACTIVE with nonzero stake | State and revision | ProviderStateChanged |
| isOperational / providers | Anyone; active and nonzero stake for operational predicate | None | None |

Deployment registry reads provider operator and operational state; compute adapter reads provider record and separately validates CMP provider. No stake contract is called; legacy bond hash is not collateral evidence. No operator-transfer entry point. AI settlement account is not CMP beneficiary authority. B06.

## 5. Models — AIModelRegistry (frozen 0x0430)

| Entry / initiator | Authority and evidence / failure | Mutation | Event |
|---|---|---|---|
| registerModel | Anyone becomes creator; unique nonzero ID | ACTIVE model, creator, metadata/license, timestamp/revision | ModelRegistered |
| register (legacy) | Caller creator or creates model; nonzero unique derived version ID and artifact, positive unique version, active model | Optional new model, version record and number index, training DENIED declaration | ModelRegistered if created, ModelVersionRegistered, Model420Declared |
| updateModel | Creator, nonretired | Metadata/license and revision | ModelUpdated |
| registerVersion | Creator, active model, nonzero unique version ID/artifact/manifest and positive unused version | Version/index and training DENIED declaration | ModelVersionRegistered, Model420Declared |
| registerModel420Version | Same plus nonzero controller, architecture/capability/disclosure/training declaration hashes | Version/index and explicit Model420 training mode/controller | ModelVersionRegistered, Model420Declared |
| transferTrainingRightsController | Existing declared version's current controller; nonzero successor | Controller only | TrainingRightsControllerTransferred |
| grantTraining | Controller; GRANT_ONLY, active model/version, nonzero grantee/scope, future expiry or zero; unused deterministic grant ID | New scoped training grant | TrainingGrantCreated |
| revokeTrainingGrant | Current controller; existing unrevoked grant | Revoked flag | TrainingGrantRevoked |
| deprecateVersion | Creator; active version, nonretired model | DEPRECATED | ModelVersionDeprecated |
| suspendModel / reactivateModel | Timelock; ACTIVE↔SUSPENDED | State and revision | ModelStateChanged |
| retireModel | Creator; nonretired | RETIRED and revision | ModelStateChanged |
| isTrainingAuthorized | Anyone; active model/version, declared GRANT_ONLY, matching unrevoked grant, expiry strictly future or zero | None | None |
| modelVersions / model420 / models / versionIdByNumber / model420Metadata / trainingGrants / trainingGrantId / isVersionOperational | Anyone; read or deterministic identifier | None | None |

No model ownership transfer function; controller transfer is not creator transfer. Ordinary license does not grant training. Deployment and adapter read model version state/schema/profile/requirements; no direct Rights or Storage verification call, nor training-grant enforcement in adapter. B07.

## 6. Deployment registry, policies and authorization

| Initiator / entry | Receiver / caller and evidence | Mutation | Event / failure |
|---|---|---|---|
| registerDeployment | DeploymentRegistry → models.isVersionOperational, providers.providers, authorization.isDeploymentAuthorized; provider operator or scoped REGISTER_DEPLOYMENT | REGISTERED record incl provider/model/offer/pricing/endpoint/expiry/region/SLA, revision 1 | DeploymentRegistered; rejects zero refs, expired endpoint, inactive version, missing provider or duplicate/unauthorized |
| updateDeployment | Same operator or UPDATE_DEPLOYMENT grant, not ACTIVE/RETIRED; nonzero refs and future/zero expiry | Offer/pricing/endpoint/expiry/region/SLA, revision | DeploymentUpdated; invalid state/input/caller reverts |
| setState | Operator or SET_DEPLOYMENT_STATE grant; REGISTERED→ACTIVE/RETIRED, ACTIVE→SUSPENDED/RETIRED, SUSPENDED→ACTIVE/RETIRED; activation requires providers.isOperational, models.isVersionOperational, endpoint not expired | State/revision | DeploymentStateChanged; illegal transition/dependency reverts |
| getDeployment / isOperational | Anyone; getDeployment rejects absent; operational returns active plus dependencies | None | None |
| setPolicy | AIPolicyRegistry420; timelock; nonzero ID/privacy/verify/pricing/limits, known workload | Current policy and append revision/history including active flag | PolicyConfigured; InvalidPolicy on malformed input |
| getPolicy / getPolicyRevision / isActive | Anyone; missing policy/revision reverts for getters | None | None |
| scopeProvider / scopeDeployment / scopeRequest | AIAuthorization420; hash domain, kind and nonzero ID | None | InvalidScope for zero ID |
| isAuthorized and typed helpers | AIAuthorization420 → immutable ICapabilityRegistry420.isAuthorized(principal, COMPONENT_AI, action, scope, amount); any read caller; known action/nonzero principal and scope | None; no capability consumption | False on invalid principal/action/scope or caught registry error; typed scope zero reverts |
| Capability grant administration | CapabilityRegistry420; component registrar registers/rotates component authority; component authority creates/revokes scoped grant | Registry authority, active grant, revocation, limits/time windows | ComponentAuthorityRegistered, ProtocolComponentAuthorityUpdated, CapabilityGranted, CapabilityRevoked; rejects unauthorized/invalid windows/IDs/limits |

Authorization action namespace: REGISTER_PROVIDER, REGISTER_DEPLOYMENT, UPDATE_DEPLOYMENT, SET_DEPLOYMENT_STATE, CREATE_REQUEST, BIND_COMPUTE, all AIIds420 ACTION_ constants. Actual consumers are deployment's three actions and compute adapter BIND_COMPUTE (amount AI maxSpend); provider registration and request creation do not call authorization; REGISTER_PROVIDER and CREATE_REQUEST are recognized but not consumed by those entry points. CapabilityRegistry420 is a registry-resolved candidate, not frozen AI address. AI authorization reads grants rather than consuming period allowance. Policy registry is discoverable through AIRouter but not enforced by JobManager or deployment/adapter; offer/pricing/SLA refs are not direct operational predicates. B01/B06/B08.

## 7. Reputation — AIReputationRegistry (frozen 0x0433)

| Initiator / entry | Receiver / caller and evidence | Mutation | Event / failure |
|---|---|---|---|
| bindTrustAdapter | Timelock; nonzero address, once | Adapter/bound | TrustAdapterBound; duplicate/zero reverts |
| applyEvidence | Bound Trust adapter only; nonzero provider/evidence, unused globally, recognized COMPLETED/DISPUTED/UPHELD/FAILED outcome | Increment matching counter, consume evidence ID globally | EvidenceApplied, ReputationApplied; invalid caller/ref/outcome/replay reverts |
| setReputation | Anyone | None | Always InvalidEvidence |
| reputation / evidenceApplied | Anyone | None | None |

TrustSignalRegistry420, TrustIssuerRegistry420, TrustPolicyRegistry420, TrustAggregator420 and ComputeWorkerTrust420 exist in ecosystem; no production adapter invoking applyEvidence identified. The trust adapter binding is an abstract dependency; fixture addresses are not proof of authenticated production evidence. B09.

## 8. Rewards and contribution evidence

| Initiator / entry | Receiver / caller and evidence | Mutation | Event / failure |
|---|---|---|---|
| AIRewardsAdapter420.publishContribution | Anyone → immutable IAIContributionVerifier420.verifyContribution; supported type, nonzero source/beneficiary/evidence; true verification required | No local state; derive content hash from domain/chain/type/source/beneficiary/evidence and deterministic type/source nonce | AIContributionForwarded after successful registry write; invalid/unsupported/unverified reverts |
| AIContributionVerifier420.verifyContribution | Anyone → immutable IAIContributionSource420.datasetContributionRecord | Matching contributor, nonzero dataset ID, exact content hash, accepted and active; no mutation | None; false for mismatch |
| Same EVALUATION | source.evaluationRecord | Matching evaluator, nonzero model ID, exact evaluation hash, finalized and active; no mutation | None |
| Same MODEL_CORRECTION | source.modelCorrectionRecord | Matching contributor, nonzero model ID, exact correction hash, accepted and active; no mutation | None |
| Same PROVIDER_VALIDATION | source.providerValidationRecord | Matching validator, nonzero provider ID, exact validation hash, finalized and not overturned; no mutation | None |
| Adapter → ContributionRegistry420.publish | Registry → RewardAuthorization420.canPublish → CapabilityRegistry420.isAuthorized for COMPONENT_REWARDS/ACTION_PUBLISH_CONTRIBUTION/app scope, zero amount; adapter is publisher; valid nonzero fields | Append contribution and consume nullifier (chain/app/publisher/nonce) | ContributionPublished; unauthorized/duplicate/invalid reverts |
| ContributionRegistry420.contribution / nullifierUsed | Anyone | None | None |

APP_ID keccak256("420AI"); four supported types defined in AIRewardTypes420. No direct payout: Rewards owns acceptance and downstream distribution. Verifier source constructor checks nonzero only; adapter constructors check nonzero only. Source errors propagate; unsupported types return false. AIRewardsIntegration420.t.sol uses real adapter/verifier/contribution registry with MockAIContributionSource420 and MockAICapabilities420. No production implementation of IAIContributionSource420 found; five contribution files absent from AI Genesis map/deployment package. Nullifier includes publisher, so cross-publisher duplicates require separate policy/registration controls. B10.

## 9. Read surfaces and shared dependency topology

| Initiator / receiver | Binding / evidence | Mutation / events / failure |
|---|---|---|
| AIRequestRegistry420.getRequest → jobs.jobs | Immutable code-bearing JobManager; anyone reads request projection | No mutation/events; unknown ID yields default job data |
| AIResultRegistry420.getResult → jobs.jobs | Same; result projection includes dispute ref and status | None; not verification or settlement |
| AIRouter420 → provider/model/deployment operational predicates | Nine immutable code-bearing addresses: provider, model, jobs, authorization, policy, deployment, request, result, compute adapter; graph hash binds chain/router and all nine | No mutation/events after constructor; fallback reverts; no fund routing |
| Registry publication → ProtocolRegistry (0x0434) | AI deployment package uses component IDs, SUSPENDED then ACTIVE after runtime/binding verification, service 420/service/ai/v1 | Registry owns publication; AI router has no publication authority; production activation unverified |
| Wallet / Identity → user transaction | Wallet signs as requester/operator/creator or scoped principal; no direct Identity dependency in reviewed AI contracts | AI cannot create identity or sign as user; CMP signed-request authority validates EOA/ERC-1271 |
| CMP funding/settlement → AssetVault420, VaultRegistry420, VaultAccounting420 | Concrete imports in ComputeEscrowFunding420 and ComputeVerifiedEntitlement420; obligation/credit and payout evidence consumed by AI adapter | Actual custody and payouts remain CMP/Vault; AI mirrors refs, not transfer authorization |
| CMP match → ComputeAcceptedPriceMatch420 → ComputeResourceRegistry420, ComputeOfferRegistry420, ComputeAuthorization420, ComputeEscrowFunding420 | Concrete imports and immutable dependencies; accepted price reservation binds match/offer/resource/payer/beneficiary | AI consumes accepted match; not an independent offer or resource allocator |
| CMP resolver → ComputeDisputeResolution420 / ComputeVerifiedEntitlement420 | Resolver owns case, hold and final disposition; entitlement owns economic outcome and payout evidence | AI reads evidence, never adjudicates CMP or pays |
| Rights / Storage | Model metadata holds license and artifact commitments; no direct Rights/Storage call in reviewed contracts | Model grant authority remains AIModelRegistry; actual cross-protocol enforcement unverified |
| Indexer / read API / web | AI and CMP state/events; indexer descriptors and read model listed in companion inventory | Derived only; no canonical state mutation. Runtime config disables request creation/cancellation/dispute and lacks live endpoint/chain IDs |

Canonical frozen Genesis AI addresses are 0x042f–0x0433; timelock 0x0429; ProtocolRegistry 0x0434. Other AI and shared addresses are registry-resolved, not invented. Deployment materialization test binds mocks, not live contracts. AIIds420 and AIRewardTypes420 are libraries, IAI420/IAIContributionSource420/IAIContributionVerifier420 interfaces only: no independent state authority.

## 10. Discrepancy ledger — classifications, not remediation closure

| ID | Classification and concrete discrepancy | Owning remediation |
|---|---|---|
| B01 | Implemented but disconnected policy/capability enforcement on direct request creation; legacy unbounded spend and zero policy refs | AI-AUDIT-3/4 |
| B02 | CMP adapter interface graph source-identified, mock-qualified; real ABI and integrated authority/tuple compatibility not established; constructor only checks code presence | AI-AUDIT-4/10 |
| B03 | Synchronization gaps: funding bind requires exact FUNDED, match sync requires accepted/later and currently active provider; local expiry may diverge; no dedicated CMP cancel mirror; result sync can emit without transition. Review one-to-one binding/replay, all terminal recovery and match tuple comparisons | AI-AUDIT-4/5 |
| B04 | Escrow callback path disconnected in searched production source; direct canonical adapter bypasses escrow; mock escrow evidence and beneficiary trust do not demonstrate payer/beneficiary binding against actual CMP/Vault | AI-AUDIT-5 |
| B05 | Dispute restoration implemented on branch; real resolver/entitlement hold and payout integration plus exact-head ABI/storage qualification pending; local open requires canonical verification ref even when AI prestate RESULT_COMMITTED | AI-AUDIT-5/10 |
| B06 | Provider stake is a reference, legacy hash not actual stake; no direct stake validation or REGISTER_PROVIDER capability consumer | AI-AUDIT-2/4 |
| B07 | Rights and Storage commitments, training grants implemented locally; direct cross-protocol license/artifact/training-use enforcement not established | AI-AUDIT-3/4/6 |
| B08 | Deployment activation checks only AI provider/model/expiry; actual offer/policy activity and policy revision enforcement disconnected; authorization view does not consume allowance | AI-AUDIT-3/4 |
| B09 | Reputation Trust adapter identity/canonical evidence producer not established; fixture-only callback evidence | AI-AUDIT-2/4 |
| B10 | Rewards contribution source missing from searched production sources; mock source/grants, deployment package omission and cross-publisher replay review | AI-AUDIT-5/9 |
| B11 | Registry-resolved addresses, grant publication, live binding and endpoints not established; mock materialization only | AI-AUDIT-9/11 |
| B12 | Read surfaces source-confirmed non-authoritative; exact-head indexer event/ABI and client qualification not transferred | AI-AUDIT-7/8/10 |

Existing inventory discrepancy IDs CURRENT-01→B10, CURRENT-02→B02/B07, CURRENT-03→B11, CURRENT-06→B05, CURRENT-07→B08. CURRENT-04 (branch/PR coverage) and CURRENT-05 (compiled ABI and full authority coverage) remain under 10.1; this matrix addresses source-level call-site/transition analysis but does not claim compiled ABI verification or full transitive audit.

## Evidence and limitations

Source review includes all 13 concrete AI contracts (including contribution verifier and adapter), libraries and interfaces classified above. Concrete shared source paths: contracts/src/system/SystemAccess.sol, CapabilityRegistry420.sol; contracts/src/compute/{ComputeRouter420,ComputeJobRegistry420,ComputeJobSignedRequestAuthority420,ComputeAcceptedPriceMatch420,ComputeProviderRegistry420,ComputeEscrowFunding420,ComputeVerifiedEntitlement420,ComputeDisputeResolution420}.sol; contracts/src/rewards/{ContributionRegistry420,RewardAuthorization420}.sol. Tests inspected: AIComputeIntegration420.t.sol, AICustodySettlement420.t.sol, AIDeploymentMaterialization420.t.sol, AIRewardsIntegration420.t.sol. Searches for applyEvidence, confirmCanonicalVaultFunding, bindTrustAdapter and IAIContributionSource420 found only AI declarations/tests/configuration/scripts, not a production callback/source. Searches are evidence of absence in retrieved results, not exhaustive tree proofs. Exact-head compiled ABI, full transitive dependency/consumer coverage and real integration qualification remain unverified; do not mark 10.1 or 10.1.B complete solely on this source matrix.

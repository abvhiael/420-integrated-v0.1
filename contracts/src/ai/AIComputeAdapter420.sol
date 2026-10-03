// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../compute/ICompute420.sol";
import "./AIIds420.sol";
import "./AIAuthorization420.sol";
import "./AIJobManager.sol";
import "./AIProviderRegistry.sol";
import "./AIModelRegistry.sol";
import "./AIModelDeploymentRegistry420.sol";

interface IAIComputeRequestAuthority420 {
    struct Request {
        address owner;
        address payer;
        bytes32 requestCommitment;
        bytes32 manifestHash;
        bytes32 workloadType;
        bytes32 inputCommitment;
        bytes32 outputSchemaCommitment;
        uint64 deadline;
        uint64 authorizationExpiry;
        uint256 maxSpend;
        uint256 nonce;
        bool exists;
    }
    function getRequest(bytes32 requestId) external view returns (Request memory);
}

interface IAIComputeJobRegistry420 {
    enum Status {
        NONE, CREATED, FUNDED, MATCHED, ACCEPTED, RUNNING, RESULT_COMMITTED, VERIFIED,
        SETTLED, CANCELLED, EXPIRED, FAILED, DISPUTED, REFUNDED
    }
    struct Job {
        address owner;
        bytes32 requestId;
        bytes32 requestCommitment;
        bytes32 manifestHash;
        bytes32 workloadType;
        bytes32 inputCommitment;
        bytes32 outputSchemaCommitment;
        bytes32 matchId;
        bytes32 fundingRef;
        bytes32 acceptanceRef;
        bytes32 assignmentRef;
        address worker;
        bytes32 resultCommitment;
        address verifier;
        bytes32 verificationRef;
        bytes32 settlementRef;
        bytes32 verificationPolicyId;
        bytes32 verificationPolicyCommitment;
        uint32 verificationPolicyRevision;
        uint64 deadline;
        uint64 revision;
        Status status;
    }
    function job(bytes32 jobId) external view returns (Job memory);
    function requestEvidence() external view returns (address);
}

interface IAIComputeAcceptedMatch420 {
    struct Match {
        bytes32 jobId;
        bytes32 requestId;
        bytes32 manifestHash;
        bytes32 offerId;
        bytes32 resourceId;
        bytes32 providerId;
        bytes32 nodeId;
        uint64 resourceRevision;
        address owner;
        address operator;
        bytes32 priceReservationRef;
        bytes32 acceptanceRef;
        bool exists;
    }
    struct PriceReservation {
        bytes32 jobId;
        bytes32 matchId;
        bytes32 offerId;
        bytes32 requestId;
        address owner;
        address payer;
        bytes32 providerId;
        bytes32 resourceId;
        uint64 resourceRevision;
        address beneficiary;
        bytes32 pricingPolicyId;
        uint32 pricingVersion;
        uint256 acceptedAmount;
        uint256 fundedAmount;
        uint256 payerMaximum;
        bytes32 disputePolicyId;
        uint32 disputePolicyVersion;
        uint64 challengeWindow;
        uint64 responseWindow;
        uint64 decisionWindow;
        uint64 appealWindow;
        uint64 acceptedAt;
        bool exists;
    }
    function getMatch(bytes32 matchId) external view returns (Match memory);
    function priceReservationForJob(bytes32 jobId) external view returns (bytes32);
    function priceReservation(bytes32 priceRef) external view returns (PriceReservation memory);
}

interface IAIComputeProviderRegistry420 {
    enum Status { NONE, REGISTERED, ACTIVE, SUSPENDED, RETIRED }
    struct Provider {
        address registrant;
        address operator;
        address settlementAccount;
        bytes32 manifestHash;
        bytes32 securityReference;
        uint64 createdAt;
        uint64 revision;
        Status status;
    }
    function provider(bytes32 providerId) external view returns (Provider memory);
}

interface IAIComputeEntitlement420 {
    struct Entitlement {
        bytes32 jobId;
        bytes32 requestId;
        bytes32 matchId;
        bytes32 priceReservationRef;
        bytes32 verificationRef;
        bytes32 resultCommitment;
        address verifier;
        address payer;
        bytes32 providerId;
        bytes32 resourceId;
        address beneficiary;
        bytes32 pricingPolicyId;
        uint32 pricingVersion;
        uint256 acceptedAmount;
        uint256 earnedAmount;
        uint256 fundedAmount;
        uint256 payerMaximum;
        uint64 finalizedAt;
        bool exists;
    }
    function entitlementForJob(bytes32 jobId) external view returns (bytes32);
    function entitlement(bytes32 entitlementRef) external view returns (Entitlement memory);
    function settled(bytes32 jobId, bytes32 verificationRef, bytes32 settlementRef) external view returns (bool);
    function refunded(bytes32 jobId, bytes32 refundRef) external view returns (bool);
}

/// @notice Narrow 420AI -> current ComputeMarket adapter.
/// @dev It never creates compute economics. It validates the signed CMP request, accepted priced match,
///      canonical provider/resource/beneficiary, result commitment and entitlement/refund evidence.
contract AIComputeAdapter420 is I420System {
    bytes32 private constant MANIFEST_DOMAIN = keccak256("420/AI/CMP/MANIFEST/V1");
    bytes32 private constant RESULT_EVIDENCE_DOMAIN = keccak256("420/AI/CMP/RESULT-EVIDENCE/V1");

    struct Binding {
        bytes32 computeRequestId;
        bytes32 computeJobId;
        bytes32 computeGraphHash;
        bytes32 deploymentId;
        bytes32 aiProviderId;
        bytes32 computeProviderId;
        bytes32 modelVersionId;
        bytes32 workloadClass;
        bytes32 computeRequirementId;
        bytes32 privacyPolicyId;
        bytes32 verificationProfileId;
        bytes32 outputSchemaCommitment;
        bytes32 matchId;
        bytes32 offerId;
        bytes32 resourceId;
        address payer;
        address beneficiary;
        uint256 maxSpend;
        uint256 acceptedPrice;
        uint64 deadline;
        bytes32 resultCommitment;
        bytes32 verificationRef;
        bytes32 entitlementRef;
        bytes32 settlementRef;
        bytes32 refundRef;
        bool exists;
        bool accepted;
    }

    AIJobManager public immutable jobs;
    AIAuthorization420 public immutable authorization;
    ICompute420 public immutable computeRouter;
    AIProviderRegistry public immutable aiProviders;
    AIModelRegistry public immutable models;
    AIModelDeploymentRegistry420 public immutable deployments;
    IAIComputeJobRegistry420 public immutable computeJobs;
    IAIComputeRequestAuthority420 public immutable computeRequests;
    IAIComputeAcceptedMatch420 public immutable computeMatches;
    IAIComputeEntitlement420 public immutable computeEntitlements;
    IAIComputeProviderRegistry420 public immutable computeProviders;

    mapping(bytes32 => Binding) private bindings;

    error InvalidDependency();
    error InvalidBinding();
    error BindingExists();
    error Unauthorized();
    error WrongState();
    error ConstraintBroadened();
    error EvidenceMismatch();

    event ComputeRequestBound(
        bytes32 indexed aiRequestId,
        bytes32 indexed computeRequestId,
        bytes32 indexed deploymentId,
        bytes32 computeGraphHash
    );
    event ComputeJobBound(bytes32 indexed aiRequestId, bytes32 indexed computeJobId);
    event AcceptedComputeBound(
        bytes32 indexed aiRequestId,
        bytes32 indexed computeJobId,
        bytes32 indexed matchId,
        bytes32 resourceId,
        uint256 acceptedPrice,
        address payer,
        address beneficiary
    );
    event ComputeResultSynchronized(
        bytes32 indexed aiRequestId,
        bytes32 indexed computeJobId,
        bytes32 resultCommitment,
        AIJobManager.Status aiStatus
    );
    event VerifiedEntitlementBound(
        bytes32 indexed aiRequestId,
        bytes32 indexed computeJobId,
        bytes32 indexed entitlementRef,
        bytes32 verificationRef
    );
    event SettlementObserved(bytes32 indexed aiRequestId, bytes32 indexed computeJobId, bytes32 settlementRef);
    event RefundObserved(bytes32 indexed aiRequestId, bytes32 indexed computeJobId, bytes32 refundRef);

    constructor(
        address jobs_,
        address authorization_,
        address computeRouter_,
        address aiProviders_,
        address models_,
        address deployments_
    ) {
        address[6] memory deps = [jobs_, authorization_, computeRouter_, aiProviders_, models_, deployments_];
        for (uint256 i; i < deps.length; ++i) {
            if (deps[i] == address(0) || deps[i].code.length == 0) revert InvalidDependency();
        }
        jobs = AIJobManager(jobs_);
        authorization = AIAuthorization420(authorization_);
        computeRouter = ICompute420(computeRouter_);
        aiProviders = AIProviderRegistry(aiProviders_);
        models = AIModelRegistry(models_);
        deployments = AIModelDeploymentRegistry420(deployments_);

        address jobRegistry_ = ICompute420(computeRouter_).jobRegistry();
        address matchRegistry_ = ICompute420(computeRouter_).matchRegistry();
        address settlementAdapter_ = ICompute420(computeRouter_).settlementAdapter();
        address providerRegistry_ = ICompute420(computeRouter_).providerRegistry();
        if (
            jobRegistry_.code.length == 0 || matchRegistry_.code.length == 0
                || settlementAdapter_.code.length == 0 || providerRegistry_.code.length == 0
        ) revert InvalidDependency();

        computeJobs = IAIComputeJobRegistry420(jobRegistry_);
        address requestAuthority_ = IAIComputeJobRegistry420(jobRegistry_).requestEvidence();
        if (requestAuthority_.code.length == 0) revert InvalidDependency();
        computeRequests = IAIComputeRequestAuthority420(requestAuthority_);
        computeMatches = IAIComputeAcceptedMatch420(matchRegistry_);
        computeEntitlements = IAIComputeEntitlement420(settlementAdapter_);
        computeProviders = IAIComputeProviderRegistry420(providerRegistry_);
    }

    function systemName() external pure returns (string memory) { return "AIComputeAdapter420"; }
    function protocolVersion() external pure returns (uint32) { return 2; }

    /// @notice Canonical signed-manifest commitment bridging AI semantics into CMP.
    function computeManifestHash(
        bytes32 aiRequestId,
        bytes32 deploymentId,
        bytes32 modelVersionId,
        bytes32 computeRequirementId,
        bytes32 privacyPolicyId,
        bytes32 verificationProfileId,
        bytes32 workloadClass,
        bytes32 inputCommitment,
        bytes32 outputSchemaCommitment,
        uint256 maxSpend,
        uint64 deadline
    ) public view returns (bytes32) {
        return keccak256(
            abi.encode(
                MANIFEST_DOMAIN,
                block.chainid,
                address(this),
                aiRequestId,
                deploymentId,
                modelVersionId,
                computeRequirementId,
                privacyPolicyId,
                verificationProfileId,
                workloadClass,
                inputCommitment,
                outputSchemaCommitment,
                maxSpend,
                deadline
            )
        );
    }

    function bindComputeRequest(
        bytes32 aiRequestId,
        bytes32 computeRequestId,
        bytes32 deploymentId,
        bytes32 expectedComputeGraphHash
    ) external {
        if (
            aiRequestId == bytes32(0) || computeRequestId == bytes32(0)
                || deploymentId == bytes32(0) || expectedComputeGraphHash == bytes32(0)
        ) revert InvalidBinding();
        if (bindings[aiRequestId].exists) revert BindingExists();

        (
            address requester,
            bytes32 modelVersionId,
            bytes32 workloadClass,
            bytes32 inputCommitment,
            bytes32 privacyPolicyId,
            bytes32 verificationProfileId,
            uint256 aiMaxSpend,
            uint64 aiDeadline,
            ,
            uint256 fundedAmount,
            ,
            ,
            ,
            ,
            ,
            ,
            AIJobManager.Status aiStatus
        ) = jobs.jobs(aiRequestId);

        if (aiStatus != AIJobManager.Status.FUNDED) revert WrongState();
        if (
            msg.sender != requester
                && !authorization.isRequestAuthorized(
                    msg.sender, aiRequestId, AIIds420.ACTION_BIND_COMPUTE, aiMaxSpend
                )
        ) revert Unauthorized();

        bytes32 graphHash = computeRouter.componentGraphHash();
        if (graphHash == bytes32(0) || graphHash != expectedComputeGraphHash) revert InvalidBinding();

        AIModelDeploymentRegistry420.Deployment memory d = deployments.getDeployment(deploymentId);
        if (
            !deployments.isOperational(deploymentId) || d.modelVersionId != modelVersionId
                || d.computeOfferRef == bytes32(0)
        ) revert InvalidBinding();

        (
            address aiOperator,
            ,
            ,
            ,
            bytes32 computeProviderId,
            ,
            ,
            AIProviderRegistry.ProviderState aiProviderState,
            bool aiProviderExists
        ) = aiProviders.providers(d.providerId);
        aiOperator;
        if (
            !aiProviderExists || aiProviderState != AIProviderRegistry.ProviderState.ACTIVE
                || computeProviderId == bytes32(0)
        ) revert InvalidBinding();

        (
            ,
            ,
            ,
            ,
            ,
            bytes32 computeRequirementId,
            bytes32 schemaHash,
            bytes32 modelVerificationProfileId,
            ,
            ,
            AIModelRegistry.VersionState versionState,
            bool versionExists
        ) = models.modelVersions(modelVersionId);
        if (
            !versionExists || versionState != AIModelRegistry.VersionState.ACTIVE
                || computeRequirementId == bytes32(0) || schemaHash == bytes32(0)
                || verificationProfileId == bytes32(0)
                || modelVerificationProfileId != verificationProfileId
        ) revert InvalidBinding();

        IAIComputeRequestAuthority420.Request memory r = computeRequests.getRequest(computeRequestId);
        if (
            !r.exists || r.owner != requester || r.workloadType != workloadClass
                || r.inputCommitment != inputCommitment || r.outputSchemaCommitment != schemaHash
        ) revert EvidenceMismatch();
        if (
            r.maxSpend == 0 || r.maxSpend > aiMaxSpend || r.maxSpend > fundedAmount
                || r.deadline > aiDeadline || r.authorizationExpiry < r.deadline
        ) revert ConstraintBroadened();

        bytes32 expectedManifest = computeManifestHash(
            aiRequestId,
            deploymentId,
            modelVersionId,
            computeRequirementId,
            privacyPolicyId,
            verificationProfileId,
            workloadClass,
            inputCommitment,
            schemaHash,
            r.maxSpend,
            r.deadline
        );
        if (r.manifestHash != expectedManifest || r.requestCommitment != computeRequestId) {
            revert EvidenceMismatch();
        }

        IAIComputeProviderRegistry420.Provider memory cp = computeProviders.provider(computeProviderId);
        if (
            cp.status != IAIComputeProviderRegistry420.Status.ACTIVE
                || cp.operator == address(0) || cp.settlementAccount == address(0)
        ) revert InvalidBinding();

        bindings[aiRequestId] = Binding({
            computeRequestId: computeRequestId,
            computeJobId: bytes32(0),
            computeGraphHash: graphHash,
            deploymentId: deploymentId,
            aiProviderId: d.providerId,
            computeProviderId: computeProviderId,
            modelVersionId: modelVersionId,
            workloadClass: workloadClass,
            computeRequirementId: computeRequirementId,
            privacyPolicyId: privacyPolicyId,
            verificationProfileId: verificationProfileId,
            outputSchemaCommitment: schemaHash,
            matchId: bytes32(0),
            offerId: d.computeOfferRef,
            resourceId: bytes32(0),
            payer: r.payer,
            beneficiary: address(0),
            maxSpend: r.maxSpend,
            acceptedPrice: 0,
            deadline: r.deadline,
            resultCommitment: bytes32(0),
            verificationRef: bytes32(0),
            entitlementRef: bytes32(0),
            settlementRef: bytes32(0),
            refundRef: bytes32(0),
            exists: true,
            accepted: false
        });
        emit ComputeRequestBound(aiRequestId, computeRequestId, deploymentId, graphHash);
    }

    function bindComputeJob(bytes32 aiRequestId, bytes32 computeJobId) external {
        Binding storage b = _binding(aiRequestId);
        if (computeJobId == bytes32(0) || b.computeJobId != bytes32(0)) revert InvalidBinding();

        IAIComputeJobRegistry420.Job memory j = computeJobs.job(computeJobId);
        IAIComputeRequestAuthority420.Request memory r = computeRequests.getRequest(b.computeRequestId);
        if (
            j.requestId != b.computeRequestId || j.owner != r.owner
                || j.requestCommitment != r.requestCommitment || j.manifestHash != r.manifestHash
                || j.workloadType != b.workloadClass || j.inputCommitment != r.inputCommitment
                || j.outputSchemaCommitment != b.outputSchemaCommitment || j.deadline != b.deadline
        ) revert EvidenceMismatch();
        if (uint8(j.status) < uint8(IAIComputeJobRegistry420.Status.FUNDED)) revert WrongState();

        b.computeJobId = computeJobId;
        emit ComputeJobBound(aiRequestId, computeJobId);
    }

    function syncAcceptedMatch(bytes32 aiRequestId) external {
        Binding storage b = _binding(aiRequestId);
        if (b.computeJobId == bytes32(0) || b.accepted) revert InvalidBinding();

        IAIComputeJobRegistry420.Job memory j = computeJobs.job(b.computeJobId);
        if (uint8(j.status) < uint8(IAIComputeJobRegistry420.Status.ACCEPTED) || j.matchId == bytes32(0)) {
            revert WrongState();
        }

        IAIComputeAcceptedMatch420.Match memory m = computeMatches.getMatch(j.matchId);
        bytes32 priceRef = computeMatches.priceReservationForJob(b.computeJobId);
        if (priceRef == bytes32(0)) revert EvidenceMismatch();
        IAIComputeAcceptedMatch420.PriceReservation memory p = computeMatches.priceReservation(priceRef);
        if (
            !m.exists || !p.exists || m.jobId != b.computeJobId || p.jobId != b.computeJobId
                || p.matchId != j.matchId || p.requestId != b.computeRequestId
                || p.offerId != b.offerId || p.providerId != b.computeProviderId
                || p.resourceId == bytes32(0) || p.payer != b.payer
                || p.acceptedAmount == 0 || p.acceptedAmount > b.maxSpend
                || p.payerMaximum > b.maxSpend || p.fundedAmount > b.maxSpend
        ) revert ConstraintBroadened();

        IAIComputeProviderRegistry420.Provider memory cp = computeProviders.provider(b.computeProviderId);
        if (
            cp.status != IAIComputeProviderRegistry420.Status.ACTIVE
                || p.beneficiary != cp.settlementAccount || p.beneficiary == address(0)
        ) revert EvidenceMismatch();

        b.matchId = j.matchId;
        b.resourceId = p.resourceId;
        b.beneficiary = p.beneficiary;
        b.acceptedPrice = p.acceptedAmount;
        b.accepted = true;

        jobs.matchCompute(aiRequestId, b.computeRequestId, b.computeJobId, b.aiProviderId);
        jobs.acceptCompute(aiRequestId);
        emit AcceptedComputeBound(
            aiRequestId,
            b.computeJobId,
            b.matchId,
            b.resourceId,
            b.acceptedPrice,
            b.payer,
            b.beneficiary
        );
    }

    function syncExecution(bytes32 aiRequestId) external {
        Binding storage b = _binding(aiRequestId);
        if (!b.accepted) revert InvalidBinding();
        IAIComputeJobRegistry420.Job memory c = computeJobs.job(b.computeJobId);

        (,,,,,,,,,,,,,,,, AIJobManager.Status aiStatus) = jobs.jobs(aiRequestId);

        if (
            aiStatus == AIJobManager.Status.ACCEPTED
                && uint8(c.status) >= uint8(IAIComputeJobRegistry420.Status.RUNNING)
                && c.status != IAIComputeJobRegistry420.Status.FAILED
                && c.status != IAIComputeJobRegistry420.Status.REFUNDED
        ) {
            jobs.markRunning(aiRequestId);
            aiStatus = AIJobManager.Status.RUNNING;
        }

        if (
            aiStatus == AIJobManager.Status.RUNNING
                && uint8(c.status) >= uint8(IAIComputeJobRegistry420.Status.RESULT_COMMITTED)
                && c.status != IAIComputeJobRegistry420.Status.FAILED
                && c.status != IAIComputeJobRegistry420.Status.REFUNDED
        ) {
            if (c.resultCommitment == bytes32(0) || c.assignmentRef == bytes32(0)) revert EvidenceMismatch();
            bytes32 resultEvidenceHash = keccak256(
                abi.encode(
                    RESULT_EVIDENCE_DOMAIN,
                    block.chainid,
                    address(this),
                    b.computeJobId,
                    b.matchId,
                    c.assignmentRef,
                    c.resultCommitment
                )
            );
            b.resultCommitment = c.resultCommitment;
            jobs.commitResult(aiRequestId, c.resultCommitment, resultEvidenceHash);
            aiStatus = AIJobManager.Status.RESULT_COMMITTED;
        }

        if (
            (c.status == IAIComputeJobRegistry420.Status.FAILED
                || c.status == IAIComputeJobRegistry420.Status.EXPIRED)
                && (
                    aiStatus == AIJobManager.Status.MATCHED || aiStatus == AIJobManager.Status.ACCEPTED
                        || aiStatus == AIJobManager.Status.RUNNING
                )
        ) {
            jobs.markFailed(aiRequestId);
            aiStatus = AIJobManager.Status.FAILED;
        }

        emit ComputeResultSynchronized(aiRequestId, b.computeJobId, b.resultCommitment, aiStatus);
    }

    function syncVerifiedEntitlement(bytes32 aiRequestId) external {
        Binding storage b = _binding(aiRequestId);
        if (!b.accepted || b.resultCommitment == bytes32(0)) revert InvalidBinding();

        IAIComputeJobRegistry420.Job memory j = computeJobs.job(b.computeJobId);
        if (
            uint8(j.status) < uint8(IAIComputeJobRegistry420.Status.VERIFIED)
                || j.resultCommitment != b.resultCommitment || j.verificationRef == bytes32(0)
                || j.verifier == address(0)
        ) revert EvidenceMismatch();

        bytes32 entitlementRef = computeEntitlements.entitlementForJob(b.computeJobId);
        if (entitlementRef == bytes32(0)) revert EvidenceMismatch();
        IAIComputeEntitlement420.Entitlement memory e = computeEntitlements.entitlement(entitlementRef);
        if (
            !e.exists || e.jobId != b.computeJobId || e.requestId != b.computeRequestId
                || e.matchId != b.matchId || e.resultCommitment != b.resultCommitment
                || e.verificationRef != j.verificationRef || e.verifier != j.verifier
                || e.payer != b.payer || e.providerId != b.computeProviderId
                || e.resourceId != b.resourceId || e.beneficiary != b.beneficiary
                || e.acceptedAmount != b.acceptedPrice || e.earnedAmount > b.acceptedPrice
                || e.payerMaximum > b.maxSpend || e.fundedAmount > b.maxSpend
        ) revert EvidenceMismatch();

        b.verificationRef = e.verificationRef;
        b.entitlementRef = entitlementRef;

        (,,,,,,,,,,,,,,,, AIJobManager.Status aiStatus) = jobs.jobs(aiRequestId);
        if (aiStatus == AIJobManager.Status.RESULT_COMMITTED) {
            jobs.verifyResult(aiRequestId);
        } else if (aiStatus != AIJobManager.Status.VERIFIED) {
            revert WrongState();
        }
        emit VerifiedEntitlementBound(aiRequestId, b.computeJobId, entitlementRef, e.verificationRef);
    }

    /// @notice Bind an already-executed canonical CMP settlement. AI custody state is reconciled in AI-AUDIT-5.
    function observeSettlement(bytes32 aiRequestId) external {
        Binding storage b = _binding(aiRequestId);
        if (b.entitlementRef == bytes32(0) || b.verificationRef == bytes32(0)) revert InvalidBinding();
        IAIComputeJobRegistry420.Job memory j = computeJobs.job(b.computeJobId);
        if (
            j.status != IAIComputeJobRegistry420.Status.SETTLED || j.settlementRef == bytes32(0)
                || !computeEntitlements.settled(b.computeJobId, b.verificationRef, j.settlementRef)
        ) revert EvidenceMismatch();
        b.settlementRef = j.settlementRef;
        emit SettlementObserved(aiRequestId, b.computeJobId, j.settlementRef);
    }

    /// @notice Bind an already-executed canonical CMP payer refund. AI custody state is reconciled in AI-AUDIT-5.
    function observeRefund(bytes32 aiRequestId) external {
        Binding storage b = _binding(aiRequestId);
        IAIComputeJobRegistry420.Job memory j = computeJobs.job(b.computeJobId);
        if (
            j.status != IAIComputeJobRegistry420.Status.REFUNDED || j.settlementRef == bytes32(0)
                || !computeEntitlements.refunded(b.computeJobId, j.settlementRef)
        ) revert EvidenceMismatch();
        b.refundRef = j.settlementRef;
        emit RefundObserved(aiRequestId, b.computeJobId, j.settlementRef);
    }

    function getBinding(bytes32 aiRequestId) external view returns (Binding memory) {
        return _binding(aiRequestId);
    }

    function _binding(bytes32 aiRequestId) private view returns (Binding storage b) {
        b = bindings[aiRequestId];
        if (!b.exists) revert InvalidBinding();
    }
}

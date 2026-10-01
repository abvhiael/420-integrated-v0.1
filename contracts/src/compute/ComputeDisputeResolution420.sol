// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./ComputeJobRegistry420.sol";
import "./ComputeAcceptedPriceMatch420.sol";
import "./ComputeAuthorization420.sol";
import "./ComputeVerifierIndependencePolicy420.sol";

interface IComputeDisputeEntitlement420 {
    function disputes() external view returns (address);
    function disputeSnapshot(bytes32 jobId) external view returns (
        bytes32 entitlementRef,
        bytes32 claimRef,
        bytes32 providerObligationId,
        bytes32 payerResidualObligationId,
        address payer,
        address beneficiary,
        uint256 providerAmount,
        uint256 residualAmount,
        uint64 claimCreatedAt,
        bool claimExists,
        bool paid
    );
    function verifiedEntitlement(
        bytes32 jobId,
        bytes32 verificationRef,
        bytes32 entitlementRef,
        address beneficiary,
        uint256 earnedAmount
    ) external view returns (bool);
    function enterDispute(bytes32 jobId, uint64 expectedRevision, bytes32 disputeId) external;
    function applyDisputeResolution(bytes32 jobId, uint64 expectedRevision,
        bytes32 disputeId, bytes32 resolutionRef, bool providerWins) external;
}

/// @notice CMP-1.2.6 bounded dispute case state for the fixed-price settlement path.
/// @dev This contract never holds funds. The settlement adapter remains the only Vault-facing
/// authority and applies the final provider/payer disposition after this case reaches finality.
contract ComputeDisputeResolution420 {
    enum CaseStatus { NONE, OPEN, RESPONDED, DECIDED, APPEALED, FINAL, WITHDRAWN, TIMED_OUT }

    struct DisputeCase {
        bytes32 jobId;
        bytes32 matchId;
        bytes32 entitlementRef;
        bytes32 claimRef;
        bytes32 policyId;
        uint32 policyVersion;
        bytes32 verificationRef;
        bytes32 resultCommitment;
        address verifier;
        bytes32 verificationPolicyId;
        uint32 verificationPolicyRevision;
        bytes32 verificationPolicyCommitment;
        address claimant;
        address respondent;
        address initialAdjudicator;
        address appealAdjudicator;
        bytes32 groundsCode;
        bytes32 evidenceCommitment;
        bytes32 responseCommitment;
        bytes32 decisionCommitment;
        bytes32 appealCommitment;
        bytes32 appealDecisionCommitment;
        bytes32 resolutionRef;
        uint64 openedAt;
        uint64 responseDeadline;
        uint64 decisionDeadline;
        uint64 appealDeadline;
        uint64 appealDecisionDeadline;
        bool providerWins;
        bool appealed;
        bool appealResolved;
        CaseStatus status;
    }

    bytes32 private constant DISPUTE_DOMAIN = keccak256("420/CMP/DISPUTE/CASE/V1");
    bytes32 private constant RESOLUTION_DOMAIN = keccak256("420/CMP/DISPUTE/RESOLUTION/V1");

    ComputeAcceptedPriceMatch420 public immutable matches;
    ComputeAuthorization420 public immutable authorization;
    ComputeVerifierIndependencePolicy420 public immutable independencePolicy;
    address public immutable bindingAdmin;

    ComputeJobRegistry420 public jobs;
    IComputeDisputeEntitlement420 public entitlements;
    uint64 public nextCaseNonce;
    mapping(bytes32 => DisputeCase) private _cases;
    mapping(bytes32 => bytes32) public disputeForJob;
    bool private entered;

    error InvalidDispute();
    error Unauthorized();
    error WrongCaseState();

    event EntitlementsBound(address indexed entitlements);
    event JobsBound(address indexed jobs);
    event DisputeOpened(bytes32 indexed disputeId, bytes32 indexed jobId,
        address indexed claimant, address respondent, bytes32 groundsCode,
        bytes32 evidenceCommitment, bytes32 verificationRef, bytes32 resultCommitment,
        address verifier, uint64 responseDeadline, uint64 decisionDeadline);
    event DisputeResponded(bytes32 indexed disputeId, address indexed respondent,
        bytes32 responseCommitment);
    event DisputeDecided(bytes32 indexed disputeId, address indexed adjudicator,
        bool providerWins, bytes32 decisionCommitment, uint64 appealDeadline);
    event DisputeAppealed(bytes32 indexed disputeId, address indexed appellant,
        bytes32 appealCommitment, uint64 appealDecisionDeadline);
    event AppealDecided(bytes32 indexed disputeId, address indexed adjudicator,
        bool providerWins, bytes32 decisionCommitment);
    event DisputeFinalized(bytes32 indexed disputeId, bytes32 indexed jobId,
        bool providerWins, bytes32 resolutionRef, CaseStatus terminalStatus);

    constructor(address matches_, address authorization_, address independence_) {
        if (matches_.code.length == 0 || authorization_.code.length == 0
            || independence_.code.length == 0) revert InvalidDispute();
        matches = ComputeAcceptedPriceMatch420(matches_);
        authorization = ComputeAuthorization420(authorization_);
        independencePolicy = ComputeVerifierIndependencePolicy420(independence_);
        bindingAdmin = msg.sender;
    }

    function bindEntitlements(address entitlements_) external {
        if (msg.sender != bindingAdmin || address(entitlements) != address(0)
            || entitlements_.code.length == 0) revert Unauthorized();
        IComputeDisputeEntitlement420 candidate = IComputeDisputeEntitlement420(entitlements_);
        if (candidate.disputes() != address(this)) revert InvalidDispute();
        entitlements = candidate;
        emit EntitlementsBound(entitlements_);
    }

    function bindJobs(address jobs_) external {
        if (msg.sender != bindingAdmin || address(jobs) != address(0)
            || address(entitlements) == address(0) || jobs_.code.length == 0)
            revert Unauthorized();
        ComputeJobRegistry420 candidate = ComputeJobRegistry420(jobs_);
        if (address(candidate.settlementEvidence()) != address(entitlements)
            || address(matches.jobs()) != jobs_) revert InvalidDispute();
        jobs = candidate;
        emit JobsBound(jobs_);
    }

    function openDispute(bytes32 jobId, uint64 expectedRevision,
        bytes32 groundsCode, bytes32 evidenceCommitment)
        external returns (bytes32 disputeId)
    {
        if (entered || address(jobs) == address(0) || groundsCode == bytes32(0)
            || evidenceCommitment == bytes32(0) || disputeForJob[jobId] != bytes32(0))
            revert InvalidDispute();
        entered = true;

        ComputeJobRegistry420.Job memory j = jobs.job(jobId);
        if (j.status != ComputeJobRegistry420.Status.VERIFIED || j.revision != expectedRevision)
            revert InvalidDispute();

        (
            bytes32 entitlementRef,
            bytes32 claimRef,
            ,
            ,
            address payer,
            address beneficiary,
            uint256 providerAmount,
            ,
            uint64 claimCreatedAt,
            bool claimExists,
            bool paid
        ) = entitlements.disputeSnapshot(jobId);
        if (!claimExists || paid || entitlementRef == bytes32(0) || claimRef == bytes32(0)
            || payer == address(0) || beneficiary == address(0)
            || j.verificationRef == bytes32(0) || j.resultCommitment == bytes32(0)
            || j.verifier == address(0)
            || !_validOptionalPolicyTuple(
                j.verificationPolicyId,
                j.verificationPolicyRevision,
                j.verificationPolicyCommitment
            )
            || !entitlements.verifiedEntitlement(
                jobId, j.verificationRef, entitlementRef, beneficiary, providerAmount
            )) revert InvalidDispute();

        ComputeAcceptedPriceMatch420.PriceReservation memory p = _price(jobId);
        uint256 challengeEnd = uint256(claimCreatedAt) + uint256(p.challengeWindow);
        if (claimCreatedAt == 0 || block.timestamp > challengeEnd) revert InvalidDispute();

        bool directParty = msg.sender == j.owner || msg.sender == payer || msg.sender == beneficiary;
        if (!directParty && !authorization.isAuthorized(
            msg.sender, authorization.ACTION_CHALLENGE(), authorization.scopeJob(jobId), 0
        )) revert Unauthorized();

        address respondent = msg.sender == beneficiary ? payer : beneficiary;
        if (respondent == address(0) || respondent == msg.sender) revert InvalidDispute();
        if (nextCaseNonce == type(uint64).max) revert InvalidDispute();
        uint64 nonce = ++nextCaseNonce;

        disputeId = keccak256(abi.encode(
            DISPUTE_DOMAIN, block.chainid, address(this), jobId, j.matchId, entitlementRef,
            claimRef, j.verificationRef, j.resultCommitment, j.verifier,
            j.verificationPolicyId, j.verificationPolicyRevision, j.verificationPolicyCommitment,
            p.disputePolicyId, p.disputePolicyVersion, nonce, msg.sender
        ));
        uint64 openedAt = uint64(block.timestamp);
        uint64 responseDeadline = _deadline(openedAt, p.responseWindow);
        uint64 decisionDeadline = _deadline(responseDeadline, p.decisionWindow);

        _cases[disputeId] = DisputeCase({
            jobId: jobId,
            matchId: j.matchId,
            entitlementRef: entitlementRef,
            claimRef: claimRef,
            policyId: p.disputePolicyId,
            policyVersion: p.disputePolicyVersion,
            verificationRef: j.verificationRef,
            resultCommitment: j.resultCommitment,
            verifier: j.verifier,
            verificationPolicyId: j.verificationPolicyId,
            verificationPolicyRevision: j.verificationPolicyRevision,
            verificationPolicyCommitment: j.verificationPolicyCommitment,
            claimant: msg.sender,
            respondent: respondent,
            initialAdjudicator: address(0),
            appealAdjudicator: address(0),
            groundsCode: groundsCode,
            evidenceCommitment: evidenceCommitment,
            responseCommitment: bytes32(0),
            decisionCommitment: bytes32(0),
            appealCommitment: bytes32(0),
            appealDecisionCommitment: bytes32(0),
            resolutionRef: bytes32(0),
            openedAt: openedAt,
            responseDeadline: responseDeadline,
            decisionDeadline: decisionDeadline,
            appealDeadline: 0,
            appealDecisionDeadline: 0,
            providerWins: false,
            appealed: false,
            appealResolved: false,
            status: CaseStatus.OPEN
        });
        disputeForJob[jobId] = disputeId;

        entitlements.enterDispute(jobId, expectedRevision, disputeId);
        emit DisputeOpened(disputeId, jobId, msg.sender, respondent, groundsCode,
            evidenceCommitment, j.verificationRef, j.resultCommitment, j.verifier,
            responseDeadline, decisionDeadline);
        entered = false;
    }

    function respond(bytes32 disputeId, bytes32 responseCommitment) external {
        DisputeCase storage d = _case(disputeId);
        if (d.status != CaseStatus.OPEN || msg.sender != d.respondent
            || responseCommitment == bytes32(0) || block.timestamp > d.responseDeadline)
            revert WrongCaseState();
        d.responseCommitment = responseCommitment;
        d.status = CaseStatus.RESPONDED;
        emit DisputeResponded(disputeId, msg.sender, responseCommitment);
    }

    function decide(bytes32 disputeId, bool providerWins, bytes32 decisionCommitment) external {
        DisputeCase storage d = _case(disputeId);
        if (d.status != CaseStatus.OPEN && d.status != CaseStatus.RESPONDED)
            revert WrongCaseState();
        if (decisionCommitment == bytes32(0) || block.timestamp > d.decisionDeadline
            || (d.status == CaseStatus.OPEN && block.timestamp <= d.responseDeadline))
            revert WrongCaseState();
        _requireAdjudicator(d.jobId, msg.sender);
        ComputeAcceptedPriceMatch420.PriceReservation memory p = _price(d.jobId);
        d.initialAdjudicator = msg.sender;
        d.providerWins = providerWins;
        d.decisionCommitment = decisionCommitment;
        d.appealDeadline = _deadline(uint64(block.timestamp), p.appealWindow);
        d.status = CaseStatus.DECIDED;
        emit DisputeDecided(disputeId, msg.sender, providerWins, decisionCommitment, d.appealDeadline);
    }

    function appeal(bytes32 disputeId, bytes32 appealCommitment) external {
        DisputeCase storage d = _case(disputeId);
        if (d.status != CaseStatus.DECIDED || d.appealed || appealCommitment == bytes32(0)
            || block.timestamp > d.appealDeadline
            || (msg.sender != d.claimant && msg.sender != d.respondent))
            revert WrongCaseState();
        ComputeAcceptedPriceMatch420.PriceReservation memory p = _price(d.jobId);
        d.appealed = true;
        d.appealCommitment = appealCommitment;
        d.appealDecisionDeadline = _deadline(uint64(block.timestamp), p.decisionWindow);
        d.status = CaseStatus.APPEALED;
        emit DisputeAppealed(disputeId, msg.sender, appealCommitment, d.appealDecisionDeadline);
    }

    function decideAppeal(bytes32 disputeId, bool providerWins, bytes32 decisionCommitment) external {
        DisputeCase storage d = _case(disputeId);
        if (d.status != CaseStatus.APPEALED || d.appealResolved
            || decisionCommitment == bytes32(0) || block.timestamp > d.appealDecisionDeadline
            || msg.sender == d.initialAdjudicator) revert WrongCaseState();
        _requireAdjudicator(d.jobId, msg.sender);
        d.appealAdjudicator = msg.sender;
        d.providerWins = providerWins;
        d.appealDecisionCommitment = decisionCommitment;
        d.appealResolved = true;
        d.status = CaseStatus.DECIDED;
        emit AppealDecided(disputeId, msg.sender, providerWins, decisionCommitment);
    }

    function finalize(bytes32 disputeId) external returns (bytes32 resolutionRef) {
        DisputeCase storage d = _case(disputeId);
        if (d.status != CaseStatus.DECIDED) revert WrongCaseState();
        if ((!d.appealed && block.timestamp <= d.appealDeadline)
            || (d.appealed && !d.appealResolved)) revert WrongCaseState();
        resolutionRef = _resolve(disputeId, d, CaseStatus.FINAL, d.providerWins);
    }

    function withdraw(bytes32 disputeId) external returns (bytes32 resolutionRef) {
        DisputeCase storage d = _case(disputeId);
        if ((d.status != CaseStatus.OPEN && d.status != CaseStatus.RESPONDED)
            || msg.sender != d.claimant) revert WrongCaseState();
        resolutionRef = _resolve(disputeId, d, CaseStatus.WITHDRAWN, true);
    }

    /// @notice Fail-closed timeout: missing adjudication never defaults to provider payment.
    function timeout(bytes32 disputeId) external returns (bytes32 resolutionRef) {
        DisputeCase storage d = _case(disputeId);
        if (d.status == CaseStatus.OPEN || d.status == CaseStatus.RESPONDED) {
            if (block.timestamp <= d.decisionDeadline) revert WrongCaseState();
        } else if (d.status == CaseStatus.APPEALED) {
            if (block.timestamp <= d.appealDecisionDeadline) revert WrongCaseState();
        } else {
            revert WrongCaseState();
        }
        resolutionRef = _resolve(disputeId, d, CaseStatus.TIMED_OUT, false);
    }


    /// @notice Read-only CMP-1.4.9 bridge from a finalized dispute to later stake/slash adjudication.
    /// @dev This hook never moves funds, rewrites the original verifier decision, or authorizes slashing.
    ///      A future stake layer must independently validate its own bound policy and objective evidence.
    function verificationDisputeDisposition(bytes32 disputeId) external view returns (
        bytes32 jobId,
        bytes32 verificationRef,
        bytes32 resultCommitment,
        address verifier,
        bytes32 verificationPolicyId,
        uint32 verificationPolicyRevision,
        bytes32 verificationPolicyCommitment,
        bytes32 groundsCode,
        bytes32 resolutionRef,
        bool providerWins,
        bool finalDisposition
    ) {
        DisputeCase storage d = _case(disputeId);
        jobId = d.jobId;
        verificationRef = d.verificationRef;
        resultCommitment = d.resultCommitment;
        verifier = d.verifier;
        verificationPolicyId = d.verificationPolicyId;
        verificationPolicyRevision = d.verificationPolicyRevision;
        verificationPolicyCommitment = d.verificationPolicyCommitment;
        groundsCode = d.groundsCode;
        resolutionRef = d.resolutionRef;
        providerWins = d.providerWins;
        finalDisposition = d.status == CaseStatus.FINAL
            || d.status == CaseStatus.WITHDRAWN
            || d.status == CaseStatus.TIMED_OUT;
    }

    function providerReleaseAllowed(bytes32 jobId) external view returns (bool) {
        if (address(entitlements) == address(0)) return false;
        (
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            uint64 claimCreatedAt,
            bool claimExists,
            bool paid
        ) = entitlements.disputeSnapshot(jobId);
        if (!claimExists || paid || claimCreatedAt == 0) return false;
        bytes32 disputeId = disputeForJob[jobId];
        if (disputeId == bytes32(0)) {
            ComputeAcceptedPriceMatch420.PriceReservation memory p = _price(jobId);
            return block.timestamp > uint256(claimCreatedAt) + uint256(p.challengeWindow);
        }
        DisputeCase storage d = _cases[disputeId];
        return (d.status == CaseStatus.FINAL || d.status == CaseStatus.WITHDRAWN)
            && d.providerWins;
    }

    function caseOf(bytes32 disputeId) external view returns (DisputeCase memory d) {
        d = _cases[disputeId];
        if (d.status == CaseStatus.NONE) revert InvalidDispute();
    }

    function activeHold(bytes32 jobId) external view returns (bool) {
        bytes32 disputeId = disputeForJob[jobId];
        if (disputeId == bytes32(0)) return false;
        CaseStatus s = _cases[disputeId].status;
        return s == CaseStatus.OPEN || s == CaseStatus.RESPONDED
            || s == CaseStatus.DECIDED || s == CaseStatus.APPEALED;
    }

    function _resolve(bytes32 disputeId, DisputeCase storage d,
        CaseStatus terminalStatus, bool providerWins) private returns (bytes32 resolutionRef)
    {
        if (entered) revert InvalidDispute();
        entered = true;
        ComputeJobRegistry420.Job memory j = jobs.job(d.jobId);
        if (j.status != ComputeJobRegistry420.Status.DISPUTED) revert InvalidDispute();
        resolutionRef = keccak256(abi.encode(
            RESOLUTION_DOMAIN, block.chainid, address(this), disputeId, d.jobId,
            d.entitlementRef, d.claimRef, d.policyId, d.policyVersion,
            d.verificationRef, d.resultCommitment, d.verifier,
            d.verificationPolicyId, d.verificationPolicyRevision,
            d.verificationPolicyCommitment, providerWins, terminalStatus,
            d.decisionCommitment, d.appealDecisionCommitment
        ));
        d.providerWins = providerWins;
        d.resolutionRef = resolutionRef;
        d.status = terminalStatus;
        entitlements.applyDisputeResolution(
            d.jobId, j.revision, disputeId, resolutionRef, providerWins
        );
        emit DisputeFinalized(disputeId, d.jobId, providerWins, resolutionRef, terminalStatus);
        entered = false;
    }

    function _requireAdjudicator(bytes32 jobId, address candidate) private view {
        if (!authorization.isAuthorized(candidate, authorization.ACTION_ADJUDICATE(),
            authorization.scopeJob(jobId), 0)) revert Unauthorized();
        ComputeJobRegistry420.Job memory j = jobs.job(jobId);
        ComputeAcceptedPriceMatch420.PriceReservation memory p = _price(jobId);
        (, , address operator, bool exists) = matches.matchParties(j.matchId);
        if (!exists || !independencePolicy.independentFromParties(
            candidate, j.owner, p.payer, operator, j.verifier
        )) revert Unauthorized();
    }

    function _price(bytes32 jobId)
        private view returns (ComputeAcceptedPriceMatch420.PriceReservation memory p)
    {
        bytes32 priceRef = matches.priceReservationForJob(jobId);
        if (priceRef == bytes32(0)) revert InvalidDispute();
        p = matches.priceReservation(priceRef);
        if (!p.exists || p.jobId != jobId || p.disputePolicyId == bytes32(0)
            || p.disputePolicyVersion == 0 || p.challengeWindow == 0
            || p.responseWindow == 0 || p.decisionWindow == 0 || p.appealWindow == 0)
            revert InvalidDispute();
    }

    function _validOptionalPolicyTuple(
        bytes32 policyId,
        uint32 policyRevision,
        bytes32 policyCommitment
    ) private pure returns (bool) {
        bool empty = policyId == bytes32(0)
            && policyRevision == 0
            && policyCommitment == bytes32(0);
        bool complete = policyId != bytes32(0)
            && policyRevision != 0
            && policyCommitment != bytes32(0);
        return empty || complete;
    }

    function _case(bytes32 disputeId) private view returns (DisputeCase storage d) {
        d = _cases[disputeId];
        if (d.status == CaseStatus.NONE) revert InvalidDispute();
    }

    function _deadline(uint64 from, uint64 delta) private pure returns (uint64 result) {
        uint256 sum = uint256(from) + uint256(delta);
        if (sum > type(uint64).max) revert InvalidDispute();
        result = uint64(sum);
    }
}

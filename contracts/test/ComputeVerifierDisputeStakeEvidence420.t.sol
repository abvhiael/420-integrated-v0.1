// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeVerifierDisputeStakeEvidence420.sol";

contract MockVerifierDisputeStakeEvidenceSource420
    is IComputeVerifierDisputeStakeEvidenceSource420
{
    mapping(bytes32 => VerificationReview) private _reviews;
    mapping(bytes32 => bytes32) public override verifierIdForDispute;

    function set(
        bytes32 disputeId,
        VerificationReview calldata review,
        bytes32 verifierId
    ) external {
        _reviews[disputeId] = review;
        verifierIdForDispute[disputeId] = verifierId;
    }

    function verificationReview(bytes32 disputeId)
        external
        view
        returns (VerificationReview memory review)
    {
        review = _reviews[disputeId];
    }
}

contract ComputeVerifierDisputeStakeEvidence420Test {
    address private constant VERIFIER = address(0xB0B);
    address private constant ADJUDICATOR = address(0xA11CE);
    address private constant APPEAL_ADJUDICATOR = address(0xCAFE);

    bytes32 private constant DISPUTE = keccak256("cmp-1.5.8/dispute");
    bytes32 private constant VERIFIER_ID = keccak256("cmp-1.5.8/verifier-id");
    bytes32 private constant STAKE_POLICY = keccak256("cmp-1.5.8/stake-policy");
    bytes32 private constant VERIFY_POLICY = keccak256("cmp-1.5.8/verify-policy");
    bytes32 private constant VERIFY_COMMITMENT = keccak256("cmp-1.5.8/verify-commitment");

    MockVerifierDisputeStakeEvidenceSource420 private disputes;
    ComputeVerifierDisputeStakeEvidence420 private evidence;

    function setUp() public {
        disputes = new MockVerifierDisputeStakeEvidenceSource420();
        evidence = new ComputeVerifierDisputeStakeEvidence420(
            address(disputes),
            STAKE_POLICY
        );
        disputes.set(DISPUTE, _valid(false), VERIFIER_ID);
    }

    function _valid(bool appealed)
        private
        view
        returns (
            IComputeVerifierDisputeStakeEvidenceSource420.VerificationReview memory r
        )
    {
        r = IComputeVerifierDisputeStakeEvidenceSource420.VerificationReview({
            disputeId: DISPUTE,
            jobId: keccak256("job"),
            verificationRef: keccak256("verification"),
            resultCommitment: keccak256("result"),
            verifier: VERIFIER,
            verificationPolicyId: VERIFY_POLICY,
            verificationPolicyRevision: 4,
            verificationPolicyCommitment: VERIFY_COMMITMENT,
            groundsCode: evidence.OBJECTIVE_VERIFIER_ERROR_GROUND(),
            evidenceCommitment: keccak256("evidence"),
            responseCommitment: keccak256("response"),
            decisionCommitment: keccak256("decision"),
            appealCommitment: appealed ? keccak256("appeal") : bytes32(0),
            appealDecisionCommitment: appealed ? keccak256("appeal-decision") : bytes32(0),
            resolutionRef: keccak256("resolution"),
            claimant: address(0x1111),
            respondent: address(0x2222),
            initialAdjudicator: ADJUDICATOR,
            appealAdjudicator: appealed ? APPEAL_ADJUDICATOR : address(0),
            openedAt: uint64(block.timestamp),
            responseDeadline: uint64(block.timestamp + 1),
            decisionDeadline: uint64(block.timestamp + 2),
            appealDeadline: uint64(block.timestamp + 3),
            appealDecisionDeadline: appealed ? uint64(block.timestamp + 4) : 0,
            status: 5,
            holdActive: false,
            appealed: appealed,
            appealResolved: appealed,
            providerWins: false,
            finalDisposition: true,
            adverseToOriginalVerification: true
        });
    }

    function testFinalObjectiveDisputeBindsCanonicalVerifierAndStakePolicy() public view {
        IComputeObjectiveSlashEvidence420.Evidence memory e =
            evidence.slashEvidence(DISPUTE);

        require(e.finalObjective, "not final objective");
        require(e.subjectKind == 2, "wrong subject kind");
        require(e.subjectRef == VERIFIER_ID, "verifier id not frozen");
        require(e.subjectAccount == VERIFIER, "verifier authority drift");
        require(e.stakePolicyId == STAKE_POLICY, "stake policy not frozen");
        require(e.verificationPolicyId == VERIFY_POLICY, "verification policy");
        require(e.verificationPolicyRevision == 4, "verification revision");
        require(
            e.verificationPolicyCommitment == VERIFY_COMMITMENT,
            "verification commitment"
        );
        require(e.misconductKey != bytes32(0), "missing misconduct key");
        require(e.evidenceCommitment != bytes32(0), "missing evidence commitment");
    }

    function testMissingCanonicalVerifierIdFailsClosed() public {
        disputes.set(DISPUTE, _valid(false), bytes32(0));
        (bool ok,) = address(evidence).staticcall(
            abi.encodeCall(evidence.slashEvidence, (DISPUTE))
        );
        require(!ok, "address-only verifier identity accepted");
    }

    function testGenericOrNonfinalDisputeFailsClosed() public {
        IComputeVerifierDisputeStakeEvidenceSource420.VerificationReview memory r =
            _valid(false);
        r.groundsCode = keccak256("generic-payer-win");
        disputes.set(DISPUTE, r, VERIFIER_ID);
        (bool ok,) = address(evidence).staticcall(
            abi.encodeCall(evidence.slashEvidence, (DISPUTE))
        );
        require(!ok, "generic dispute became slash evidence");

        r = _valid(false);
        r.status = 3;
        r.finalDisposition = false;
        disputes.set(DISPUTE, r, VERIFIER_ID);
        (ok,) = address(evidence).staticcall(
            abi.encodeCall(evidence.slashEvidence, (DISPUTE))
        );
        require(!ok, "nonfinal dispute became slash evidence");
    }

    function testIndependentAppealFinalityRemainsRequired() public {
        IComputeVerifierDisputeStakeEvidenceSource420.VerificationReview memory r =
            _valid(true);
        r.appealResolved = false;
        disputes.set(DISPUTE, r, VERIFIER_ID);
        (bool ok,) = address(evidence).staticcall(
            abi.encodeCall(evidence.slashEvidence, (DISPUTE))
        );
        require(!ok, "unresolved appeal accepted");

        r = _valid(true);
        r.appealAdjudicator = ADJUDICATOR;
        disputes.set(DISPUTE, r, VERIFIER_ID);
        (ok,) = address(evidence).staticcall(
            abi.encodeCall(evidence.slashEvidence, (DISPUTE))
        );
        require(!ok, "same-adjudicator appeal accepted");
    }
}

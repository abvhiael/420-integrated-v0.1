// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeVerifierDisputeSlashEvidence420.sol";

contract MockVerifierDisputeReview420 is IComputeVerifierDisputeReview420 {
    mapping(bytes32 => VerificationReview) private _reviews;

    function set(bytes32 disputeId, VerificationReview calldata review) external {
        _reviews[disputeId] = review;
    }

    function verificationReview(bytes32 disputeId)
        external
        view
        returns (VerificationReview memory review)
    {
        review = _reviews[disputeId];
    }
}

contract ComputeVerifierDisputeSlashEvidence420Test {
    address private constant VERIFIER = address(0xB0B);
    address private constant ADJUDICATOR = address(0xA11CE);
    address private constant APPEAL_ADJUDICATOR = address(0xCAFE);

    bytes32 private constant DISPUTE = keccak256("dispute");
    bytes32 private constant VERIFY_POLICY = keccak256("verify-policy");
    bytes32 private constant VERIFY_COMMITMENT = keccak256("verify-commitment");

    MockVerifierDisputeReview420 private disputes;
    ComputeVerifierDisputeSlashEvidence420 private adapter;

    function setUp() public {
        disputes = new MockVerifierDisputeReview420();
        adapter = new ComputeVerifierDisputeSlashEvidence420(address(disputes));
        disputes.set(DISPUTE, _valid(false));
    }

    function _valid(bool appealed)
        private
        view
        returns (IComputeVerifierDisputeReview420.VerificationReview memory r)
    {
        r = IComputeVerifierDisputeReview420.VerificationReview({
            disputeId: DISPUTE,
            jobId: keccak256("job"),
            verificationRef: keccak256("verification"),
            resultCommitment: keccak256("result"),
            verifier: VERIFIER,
            verificationPolicyId: VERIFY_POLICY,
            verificationPolicyRevision: 3,
            verificationPolicyCommitment: VERIFY_COMMITMENT,
            groundsCode: adapter.OBJECTIVE_VERIFIER_ERROR_GROUND(),
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

    function testFinalIndependentObjectiveVerifierErrorProducesEvidence() public view {
        IComputeObjectiveSlashEvidence420.Evidence memory e = adapter.slashEvidence(DISPUTE);
        require(e.finalObjective, "not objective");
        require(e.subjectKind == 2, "kind");
        require(e.subjectAccount == VERIFIER, "verifier");
        require(e.subjectRef == bytes32(uint256(uint160(VERIFIER))), "subject ref");
        require(e.violationCode == adapter.VIOLATION_CODE(), "violation");
        require(e.verificationPolicyId == VERIFY_POLICY, "policy id");
        require(e.verificationPolicyRevision == 3, "policy revision");
        require(e.verificationPolicyCommitment == VERIFY_COMMITMENT, "policy commitment");
        require(e.misconductKey != bytes32(0) && e.evidenceCommitment != bytes32(0), "commitments");
    }

    function testIndependentAppealFinalityCanProduceEvidence() public {
        disputes.set(DISPUTE, _valid(true));
        IComputeObjectiveSlashEvidence420.Evidence memory e = adapter.slashEvidence(DISPUTE);
        require(e.finalObjective, "appeal finality");
    }

    function testTimeoutOrNonFinalDispositionCannotBeSlashEvidence() public {
        IComputeVerifierDisputeReview420.VerificationReview memory r = _valid(false);
        r.status = 7;
        disputes.set(DISPUTE, r);
        (bool ok,) = address(adapter).staticcall(
            abi.encodeCall(adapter.slashEvidence, (DISPUTE))
        );
        require(!ok, "timeout slash evidence");

        r = _valid(false);
        r.finalDisposition = false;
        r.status = 3;
        disputes.set(DISPUTE, r);
        (ok,) = address(adapter).staticcall(
            abi.encodeCall(adapter.slashEvidence, (DISPUTE))
        );
        require(!ok, "non-final slash evidence");
    }

    function testGenericAdverseDisputeGroundDoesNotProveVerifierFault() public {
        IComputeVerifierDisputeReview420.VerificationReview memory r = _valid(false);
        r.groundsCode = keccak256("provider-sla-failure");
        disputes.set(DISPUTE, r);

        (bool ok,) = address(adapter).staticcall(
            abi.encodeCall(adapter.slashEvidence, (DISPUTE))
        );
        require(!ok, "generic payer win slashed verifier");
    }

    function testUnresolvedOrNonIndependentAppealCannotAuthorize() public {
        IComputeVerifierDisputeReview420.VerificationReview memory r = _valid(true);
        r.appealResolved = false;
        disputes.set(DISPUTE, r);
        (bool ok,) = address(adapter).staticcall(
            abi.encodeCall(adapter.slashEvidence, (DISPUTE))
        );
        require(!ok, "unresolved appeal");

        r = _valid(true);
        r.appealAdjudicator = ADJUDICATOR;
        disputes.set(DISPUTE, r);
        (ok,) = address(adapter).staticcall(
            abi.encodeCall(adapter.slashEvidence, (DISPUTE))
        );
        require(!ok, "same adjudicator appeal");
    }

    function testProviderWinOrNonAdverseDispositionCannotAuthorize() public {
        IComputeVerifierDisputeReview420.VerificationReview memory r = _valid(false);
        r.providerWins = true;
        r.adverseToOriginalVerification = false;
        disputes.set(DISPUTE, r);

        (bool ok,) = address(adapter).staticcall(
            abi.encodeCall(adapter.slashEvidence, (DISPUTE))
        );
        require(!ok, "provider win slashed verifier");
    }
}

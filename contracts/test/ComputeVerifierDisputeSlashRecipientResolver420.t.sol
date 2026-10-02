// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeVerifierDisputeSlashRecipientResolver420.sol";

contract MockSlashDistributionEntitlements420 is IComputeSlashDistributionEntitlements420 {
    address public payer = address(0x1111);
    bool public claimExists = true;
    bool public paid;

    function set(bool exists_, bool paid_) external {
        claimExists = exists_;
        paid = paid_;
    }

    function disputeSnapshot(bytes32) external view returns (
        bytes32 entitlementRef,
        bytes32 claimRef,
        bytes32 providerObligationId,
        bytes32 payerResidualObligationId,
        address payer_,
        address beneficiary,
        uint256 providerAmount,
        uint256 residualAmount,
        uint64 claimCreatedAt,
        bool claimExists_,
        bool paid_
    ) {
        return (
            keccak256("entitlement"),
            keccak256("claim"),
            bytes32(0),
            bytes32(0),
            payer,
            address(0x2222),
            1,
            0,
            1,
            claimExists,
            paid
        );
    }
}

contract MockSlashDistributionDisputes420 is IComputeSlashDistributionDisputes420 {
    VerificationReview private _review;
    address public override entitlements;

    constructor(address entitlements_) {
        entitlements = entitlements_;
    }

    function set(VerificationReview calldata review) external {
        _review = review;
    }

    function verificationReview(bytes32) external view returns (VerificationReview memory) {
        return _review;
    }
}

contract MockVerifierEvidenceAdapter420 {}

contract ComputeVerifierDisputeSlashRecipientResolver420Test {
    address private constant VERIFIER = address(0xB0B);
    address private constant CHALLENGER = address(0xCAFE);

    MockSlashDistributionEntitlements420 private entitlements;
    MockSlashDistributionDisputes420 private disputes;
    MockVerifierEvidenceAdapter420 private evidenceAdapter;
    ComputeVerifierDisputeSlashRecipientResolver420 private resolver;

    function setUp() public {
        entitlements = new MockSlashDistributionEntitlements420();
        disputes = new MockSlashDistributionDisputes420(address(entitlements));
        evidenceAdapter = new MockVerifierEvidenceAdapter420();
        resolver = new ComputeVerifierDisputeSlashRecipientResolver420(
            address(disputes), address(evidenceAdapter)
        );

        disputes.set(
            IComputeSlashDistributionDisputes420.VerificationReview({
                disputeId: keccak256("dispute"),
                jobId: keccak256("job"),
                verificationRef: keccak256("verification"),
                resultCommitment: keccak256("result"),
                verifier: VERIFIER,
                verificationPolicyId: keccak256("policy"),
                verificationPolicyRevision: 1,
                verificationPolicyCommitment: keccak256("policy-commitment"),
                groundsCode: keccak256("ground"),
                evidenceCommitment: keccak256("evidence"),
                responseCommitment: keccak256("response"),
                decisionCommitment: keccak256("decision"),
                appealCommitment: bytes32(0),
                appealDecisionCommitment: bytes32(0),
                resolutionRef: keccak256("resolution"),
                claimant: CHALLENGER,
                respondent: address(0xDEAD),
                initialAdjudicator: address(0xAAAA),
                appealAdjudicator: address(0),
                openedAt: 1,
                responseDeadline: 2,
                decisionDeadline: 3,
                appealDeadline: 4,
                appealDecisionDeadline: 0,
                status: 5,
                holdActive: false,
                appealed: false,
                appealResolved: false,
                providerWins: false,
                finalDisposition: true,
                adverseToOriginalVerification: true
            })
        );
    }

    function testResolvesCanonicalPayerAndChallenger() public view {
        IComputeSlashRecipientResolver420.Recipients memory r = resolver.resolve(
            keccak256("auth"),
            keccak256("dispute"),
            address(evidenceAdapter),
            bytes32(uint256(uint160(VERIFIER))),
            VERIFIER
        );
        require(r.harmedPayer == entitlements.payer(), "payer");
        require(r.challenger == CHALLENGER, "challenger");
        require(r.replacementWorker == address(0), "invented replacement");
    }

    function testEvidenceAdapterOrSubjectMismatchFailsClosed() public {
        (bool ok,) = address(resolver).staticcall(
            abi.encodeCall(
                resolver.resolve,
                (
                    keccak256("auth"),
                    keccak256("dispute"),
                    address(0x1234),
                    bytes32(0),
                    VERIFIER
                )
            )
        );
        require(!ok, "wrong evidence adapter");

        (ok,) = address(resolver).staticcall(
            abi.encodeCall(
                resolver.resolve,
                (
                    keccak256("auth"),
                    keccak256("dispute"),
                    address(evidenceAdapter),
                    bytes32(0),
                    address(0x9999)
                )
            )
        );
        require(!ok, "wrong verifier subject");
    }

    function testPaidOrMissingClaimCannotResolvePayer() public {
        entitlements.set(true, true);
        (bool ok,) = address(resolver).staticcall(
            abi.encodeCall(
                resolver.resolve,
                (
                    keccak256("auth"),
                    keccak256("dispute"),
                    address(evidenceAdapter),
                    bytes32(0),
                    VERIFIER
                )
            )
        );
        require(!ok, "paid claim resolved");
    }
}

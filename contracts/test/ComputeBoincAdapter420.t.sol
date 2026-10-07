// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeBoincAdapter420.sol";

contract ComputeBoincAdapter420Test {
    ComputeBoincAdapter420 private adapter;

    function setUp() public {
        adapter = new ComputeBoincAdapter420();
    }

    function _record() private pure returns (ComputeBoincAdapter420.BoincRecord memory r) {
        r = ComputeBoincAdapter420.BoincRecord({
            projectIdentityCommitment: keccak256("boinc-project"),
            applicationCommitment: keccak256("boinc-application"),
            workUnitCommitment: keccak256("boinc-work-unit"),
            participantIdentityCommitment: keccak256("boinc-participant"),
            hostIdentityCommitment: keccak256("boinc-host"),
            assignmentCommitment: keccak256("boinc-assignment"),
            resultCommitment: keccak256("boinc-result"),
            issuedAt: 1_760_000_000,
            reportDeadline: 1_760_086_400,
            reportedAt: 1_760_003_600,
            grantedCredit: 420,
            evidenceCommitment: keccak256("boinc-evidence")
        });
    }

    function testNormalizesCanonicalRecordDeterministically() public {
        ComputeBoincAdapter420.BoincRecord memory r = _record();
        (bytes32 contribution, bytes32 normalized) = adapter.normalize(r);
        require(contribution != bytes32(0), "missing contribution");
        require(normalized != bytes32(0), "missing normalized record");
        require(contribution == adapter.contributionId(r), "contribution drift");
        require(normalized == adapter.recordCommitment(r), "record drift");
        require(adapter.protocolCommitment() != bytes32(0), "protocol missing");
    }

    function testContributionIdentityBindsProjectWorkUnitParticipantHostAndAssignment() public {
        ComputeBoincAdapter420.BoincRecord memory base = _record();
        bytes32 expected = adapter.contributionId(base);

        ComputeBoincAdapter420.BoincRecord memory changed = base;
        changed.projectIdentityCommitment = keccak256("other-project");
        require(adapter.contributionId(changed) != expected, "project substitution");

        changed = base;
        changed.workUnitCommitment = keccak256("other-work-unit");
        require(adapter.contributionId(changed) != expected, "work-unit substitution");

        changed = base;
        changed.participantIdentityCommitment = keccak256("other-participant");
        require(adapter.contributionId(changed) != expected, "participant substitution");

        changed = base;
        changed.hostIdentityCommitment = keccak256("other-host");
        require(adapter.contributionId(changed) != expected, "host substitution");

        changed = base;
        changed.assignmentCommitment = keccak256("other-assignment");
        require(adapter.contributionId(changed) != expected, "assignment substitution");
    }

    function testRecordCommitmentBindsApplicationResultTimingCreditAndEvidence() public {
        ComputeBoincAdapter420.BoincRecord memory base = _record();
        bytes32 expectedId = adapter.contributionId(base);
        bytes32 expectedRecord = adapter.recordCommitment(base);

        ComputeBoincAdapter420.BoincRecord memory changed = base;
        changed.applicationCommitment = keccak256("other-app");
        require(adapter.contributionId(changed) == expectedId, "identity changed with app");
        require(adapter.recordCommitment(changed) != expectedRecord, "app not bound");

        changed = base;
        changed.resultCommitment = keccak256("other-result");
        require(adapter.recordCommitment(changed) != expectedRecord, "result not bound");

        changed = base;
        changed.reportDeadline += 1;
        require(adapter.recordCommitment(changed) != expectedRecord, "deadline not bound");

        changed = base;
        changed.reportedAt += 1;
        require(adapter.recordCommitment(changed) != expectedRecord, "reported time not bound");

        changed = base;
        changed.grantedCredit += 1;
        require(adapter.recordCommitment(changed) != expectedRecord, "credit not bound");

        changed = base;
        changed.evidenceCommitment = keccak256("other-evidence");
        require(adapter.recordCommitment(changed) != expectedRecord, "evidence not bound");
    }

    function testRejectsMissingRequiredBindings() public {
        ComputeBoincAdapter420.BoincRecord memory r = _record();
        r.projectIdentityCommitment = bytes32(0);
        _expectInvalid(r);

        r = _record();
        r.applicationCommitment = bytes32(0);
        _expectInvalid(r);

        r = _record();
        r.workUnitCommitment = bytes32(0);
        _expectInvalid(r);

        r = _record();
        r.participantIdentityCommitment = bytes32(0);
        _expectInvalid(r);

        r = _record();
        r.assignmentCommitment = bytes32(0);
        _expectInvalid(r);

        r = _record();
        r.resultCommitment = bytes32(0);
        _expectInvalid(r);

        r = _record();
        r.evidenceCommitment = bytes32(0);
        _expectInvalid(r);
    }

    function testRejectsImpossibleTimeOrdering() public {
        ComputeBoincAdapter420.BoincRecord memory r = _record();
        r.issuedAt = 0;
        _expectInvalid(r);

        r = _record();
        r.reportDeadline = r.issuedAt - 1;
        _expectInvalid(r);

        r = _record();
        r.reportedAt = r.issuedAt - 1;
        _expectInvalid(r);
    }

    function testAllowsOptionalHostAndZeroCreditWithoutClaimingRewardEligibility() public {
        ComputeBoincAdapter420.BoincRecord memory r = _record();
        bytes32 withHost = adapter.recordCommitment(r);

        r.hostIdentityCommitment = bytes32(0);
        r.grantedCredit = 0;
        bytes32 withoutHostZeroCredit = adapter.recordCommitment(r);
        require(withHost != withoutHostZeroCredit, "optional fields not committed");
        require(withoutHostZeroCredit != bytes32(0), "valid zero-credit record rejected");
    }

    function _expectInvalid(ComputeBoincAdapter420.BoincRecord memory r) private {
        (bool ok,) = address(adapter).call(abi.encodeCall(adapter.normalize, (r)));
        require(!ok, "invalid BOINC record accepted");
    }
}

// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeFoldingAtHomeAdapter420.sol";

contract ComputeFoldingAtHomeAdapter420Test {
    ComputeFoldingAtHomeAdapter420 private adapter;

    function setUp() public {
        adapter = new ComputeFoldingAtHomeAdapter420();
    }

    function _record() private pure returns (ComputeFoldingAtHomeAdapter420.FoldingRecord memory r) {
        r = ComputeFoldingAtHomeAdapter420.FoldingRecord({
            projectNumber: 18452,
            workUnitCommitment: keccak256("fah-work-unit"),
            donorIdentityCommitment: keccak256("fah-donor"),
            teamIdentityCommitment: keccak256("fah-team"),
            assignmentCommitment: keccak256("fah-assignment"),
            resultCommitment: keccak256("fah-result"),
            assignedAt: 1_760_000_000,
            completedAt: 1_760_003_600,
            creditedPoints: 42_000,
            evidenceCommitment: keccak256("fah-evidence")
        });
    }

    function testNormalizesCanonicalRecordDeterministically() public {
        ComputeFoldingAtHomeAdapter420.FoldingRecord memory r = _record();
        (bytes32 contribution, bytes32 normalized) = adapter.normalize(r);
        require(contribution != bytes32(0), "missing contribution id");
        require(normalized != bytes32(0), "missing normalized record");
        require(contribution == adapter.contributionId(r), "contribution not deterministic");
        require(normalized == adapter.recordCommitment(r), "record not deterministic");
        require(adapter.protocolCommitment() != bytes32(0), "protocol missing");
    }

    function testContributionIdentityBindsProjectWorkUnitDonorAndAssignment() public {
        ComputeFoldingAtHomeAdapter420.FoldingRecord memory base = _record();
        bytes32 expected = adapter.contributionId(base);

        ComputeFoldingAtHomeAdapter420.FoldingRecord memory changed = base;
        changed.projectNumber += 1;
        require(adapter.contributionId(changed) != expected, "project substitution");

        changed = base;
        changed.workUnitCommitment = keccak256("other-wu");
        require(adapter.contributionId(changed) != expected, "work-unit substitution");

        changed = base;
        changed.donorIdentityCommitment = keccak256("other-donor");
        require(adapter.contributionId(changed) != expected, "donor substitution");

        changed = base;
        changed.assignmentCommitment = keccak256("other-assignment");
        require(adapter.contributionId(changed) != expected, "assignment substitution");
    }

    function testRecordCommitmentBindsResultTeamCreditTimeAndEvidence() public {
        ComputeFoldingAtHomeAdapter420.FoldingRecord memory base = _record();
        bytes32 expectedId = adapter.contributionId(base);
        bytes32 expectedRecord = adapter.recordCommitment(base);

        ComputeFoldingAtHomeAdapter420.FoldingRecord memory changed = base;
        changed.resultCommitment = keccak256("other-result");
        require(adapter.contributionId(changed) == expectedId, "identity changed with result");
        require(adapter.recordCommitment(changed) != expectedRecord, "result not bound");

        changed = base;
        changed.teamIdentityCommitment = keccak256("other-team");
        require(adapter.recordCommitment(changed) != expectedRecord, "team not bound");

        changed = base;
        changed.creditedPoints += 1;
        require(adapter.recordCommitment(changed) != expectedRecord, "credit not bound");

        changed = base;
        changed.completedAt += 1;
        require(adapter.recordCommitment(changed) != expectedRecord, "completion not bound");

        changed = base;
        changed.evidenceCommitment = keccak256("other-evidence");
        require(adapter.recordCommitment(changed) != expectedRecord, "evidence not bound");
    }

    function testRejectsZeroRequiredBindings() public {
        ComputeFoldingAtHomeAdapter420.FoldingRecord memory r = _record();

        r.projectNumber = 0;
        _expectInvalid(r);

        r = _record();
        r.workUnitCommitment = bytes32(0);
        _expectInvalid(r);

        r = _record();
        r.donorIdentityCommitment = bytes32(0);
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

    function testRejectsInvalidTimeAndZeroCredit() public {
        ComputeFoldingAtHomeAdapter420.FoldingRecord memory r = _record();
        r.assignedAt = 0;
        _expectInvalid(r);

        r = _record();
        r.completedAt = r.assignedAt - 1;
        _expectInvalid(r);

        r = _record();
        r.creditedPoints = 0;
        _expectInvalid(r);
    }

    function testTeamIdentityIsOptionalButStillCommittedWhenPresent() public {
        ComputeFoldingAtHomeAdapter420.FoldingRecord memory r = _record();
        bytes32 withTeam = adapter.recordCommitment(r);
        r.teamIdentityCommitment = bytes32(0);
        bytes32 withoutTeam = adapter.recordCommitment(r);
        require(withTeam != withoutTeam, "optional team not committed");
    }

    function _expectInvalid(ComputeFoldingAtHomeAdapter420.FoldingRecord memory r) private {
        (bool ok,) = address(adapter).call(
            abi.encodeCall(adapter.normalize, (r))
        );
        require(!ok, "invalid record accepted");
    }
}

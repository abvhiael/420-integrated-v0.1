// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeUniversityHpcGateway420.sol";

contract ComputeUniversityHpcGateway420Test {
    ComputeUniversityHpcGateway420 private gateway;

    function setUp() public {
        gateway = new ComputeUniversityHpcGateway420();
    }

    function _record()
        private pure returns (ComputeUniversityHpcGateway420.HpcRecord memory r)
    {
        r = ComputeUniversityHpcGateway420.HpcRecord({
            institutionIdentityCommitment: keccak256("university"),
            gatewayIdentityCommitment: keccak256("gateway"),
            schedulerIdentityCommitment: keccak256("scheduler"),
            accountIdentityCommitment: keccak256("account"),
            researchProjectCommitment: keccak256("project"),
            workloadCommitment: keccak256("workload"),
            allocationCommitment: keccak256("allocation"),
            queueOrPartitionCommitment: keccak256("partition"),
            resultCommitment: keccak256("result"),
            submittedAt: 1_760_000_000,
            startedAt: 1_760_000_060,
            completedAt: 1_760_007_200,
            resourceUsageCommitment: keccak256("usage"),
            accountingCommitment: keccak256("accounting"),
            evidenceCommitment: keccak256("evidence")
        });
    }

    function testNormalizesCanonicalHpcRecordDeterministically() public {
        ComputeUniversityHpcGateway420.HpcRecord memory r = _record();
        (bytes32 contribution, bytes32 normalized) = gateway.normalize(r);
        require(contribution != bytes32(0), "missing contribution");
        require(normalized != bytes32(0), "missing record");
        require(contribution == gateway.contributionId(r), "contribution drift");
        require(normalized == gateway.recordCommitment(r), "record drift");
        require(gateway.protocolCommitment() != bytes32(0), "protocol missing");
    }

    function testContributionIdentityBindsInstitutionGatewaySchedulerAccountProjectWorkloadAllocation()
        public
    {
        ComputeUniversityHpcGateway420.HpcRecord memory base = _record();
        bytes32 expected = gateway.contributionId(base);

        ComputeUniversityHpcGateway420.HpcRecord memory changed = base;
        changed.institutionIdentityCommitment = keccak256("other-institution");
        require(gateway.contributionId(changed) != expected, "institution substitution");

        changed = base;
        changed.gatewayIdentityCommitment = keccak256("other-gateway");
        require(gateway.contributionId(changed) != expected, "gateway substitution");

        changed = base;
        changed.schedulerIdentityCommitment = keccak256("other-scheduler");
        require(gateway.contributionId(changed) != expected, "scheduler substitution");

        changed = base;
        changed.accountIdentityCommitment = keccak256("other-account");
        require(gateway.contributionId(changed) != expected, "account substitution");

        changed = base;
        changed.researchProjectCommitment = keccak256("other-project");
        require(gateway.contributionId(changed) != expected, "project substitution");

        changed = base;
        changed.workloadCommitment = keccak256("other-workload");
        require(gateway.contributionId(changed) != expected, "workload substitution");

        changed = base;
        changed.allocationCommitment = keccak256("other-allocation");
        require(gateway.contributionId(changed) != expected, "allocation substitution");
    }

    function testRecordCommitmentBindsPartitionResultLifecycleUsageAccountingAndEvidence() public {
        ComputeUniversityHpcGateway420.HpcRecord memory base = _record();
        bytes32 expectedId = gateway.contributionId(base);
        bytes32 expectedRecord = gateway.recordCommitment(base);

        ComputeUniversityHpcGateway420.HpcRecord memory changed = base;
        changed.queueOrPartitionCommitment = keccak256("other-partition");
        require(gateway.contributionId(changed) == expectedId, "identity changed with partition");
        require(gateway.recordCommitment(changed) != expectedRecord, "partition not bound");

        changed = base;
        changed.resultCommitment = keccak256("other-result");
        require(gateway.recordCommitment(changed) != expectedRecord, "result not bound");

        changed = base;
        changed.startedAt += 1;
        require(gateway.recordCommitment(changed) != expectedRecord, "start not bound");

        changed = base;
        changed.completedAt += 1;
        require(gateway.recordCommitment(changed) != expectedRecord, "completion not bound");

        changed = base;
        changed.resourceUsageCommitment = keccak256("other-usage");
        require(gateway.recordCommitment(changed) != expectedRecord, "usage not bound");

        changed = base;
        changed.accountingCommitment = keccak256("other-accounting");
        require(gateway.recordCommitment(changed) != expectedRecord, "accounting not bound");

        changed = base;
        changed.evidenceCommitment = keccak256("other-evidence");
        require(gateway.recordCommitment(changed) != expectedRecord, "evidence not bound");
    }

    function testRejectsMissingRequiredBindings() public {
        ComputeUniversityHpcGateway420.HpcRecord memory r = _record();
        r.institutionIdentityCommitment = bytes32(0);
        _expectInvalid(r);

        r = _record();
        r.gatewayIdentityCommitment = bytes32(0);
        _expectInvalid(r);

        r = _record();
        r.schedulerIdentityCommitment = bytes32(0);
        _expectInvalid(r);

        r = _record();
        r.accountIdentityCommitment = bytes32(0);
        _expectInvalid(r);

        r = _record();
        r.researchProjectCommitment = bytes32(0);
        _expectInvalid(r);

        r = _record();
        r.workloadCommitment = bytes32(0);
        _expectInvalid(r);

        r = _record();
        r.allocationCommitment = bytes32(0);
        _expectInvalid(r);

        r = _record();
        r.resultCommitment = bytes32(0);
        _expectInvalid(r);

        r = _record();
        r.resourceUsageCommitment = bytes32(0);
        _expectInvalid(r);

        r = _record();
        r.accountingCommitment = bytes32(0);
        _expectInvalid(r);

        r = _record();
        r.evidenceCommitment = bytes32(0);
        _expectInvalid(r);
    }

    function testRejectsImpossibleLifecycleOrdering() public {
        ComputeUniversityHpcGateway420.HpcRecord memory r = _record();
        r.submittedAt = 0;
        _expectInvalid(r);

        r = _record();
        r.startedAt = r.submittedAt - 1;
        _expectInvalid(r);

        r = _record();
        r.completedAt = r.startedAt - 1;
        _expectInvalid(r);
    }

    function testAllowsOptionalQueueOrPartitionCommitment() public {
        ComputeUniversityHpcGateway420.HpcRecord memory r = _record();
        bytes32 withPartition = gateway.recordCommitment(r);
        r.queueOrPartitionCommitment = bytes32(0);
        bytes32 withoutPartition = gateway.recordCommitment(r);
        require(withPartition != withoutPartition, "partition not committed");
        require(withoutPartition != bytes32(0), "optional partition rejected");
    }

    function _expectInvalid(ComputeUniversityHpcGateway420.HpcRecord memory r) private {
        (bool ok,) = address(gateway).call(abi.encodeCall(gateway.normalize, (r)));
        require(!ok, "invalid HPC record accepted");
    }
}

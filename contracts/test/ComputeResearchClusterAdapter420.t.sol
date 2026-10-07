// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeResearchClusterAdapter420.sol";

contract ComputeResearchClusterAdapter420Test {
    ComputeResearchClusterAdapter420 private adapter;

    function setUp() public {
        adapter = new ComputeResearchClusterAdapter420();
    }

    function _record()
        private pure returns (ComputeResearchClusterAdapter420.ClusterRecord memory r)
    {
        r = ComputeResearchClusterAdapter420.ClusterRecord({
            clusterIdentityCommitment: keccak256("cluster"),
            schedulerIdentityCommitment: keccak256("scheduler"),
            researchProjectCommitment: keccak256("research-project"),
            workloadCommitment: keccak256("cluster-workload"),
            submitterIdentityCommitment: keccak256("submitter"),
            allocationCommitment: keccak256("allocation"),
            nodeSetCommitment: keccak256("node-set"),
            resultCommitment: keccak256("cluster-result"),
            submittedAt: 1_760_000_000,
            startedAt: 1_760_000_060,
            completedAt: 1_760_003_600,
            resourceUsageCommitment: keccak256("resource-usage"),
            evidenceCommitment: keccak256("cluster-evidence")
        });
    }

    function testNormalizesCanonicalClusterRecordDeterministically() public {
        ComputeResearchClusterAdapter420.ClusterRecord memory r = _record();
        (bytes32 contribution, bytes32 normalized) = adapter.normalize(r);
        require(contribution != bytes32(0), "missing contribution");
        require(normalized != bytes32(0), "missing normalized record");
        require(contribution == adapter.contributionId(r), "contribution drift");
        require(normalized == adapter.recordCommitment(r), "record drift");
        require(adapter.protocolCommitment() != bytes32(0), "protocol missing");
    }

    function testContributionIdentityBindsClusterSchedulerProjectWorkloadSubmitterAndAllocation()
        public
    {
        ComputeResearchClusterAdapter420.ClusterRecord memory base = _record();
        bytes32 expected = adapter.contributionId(base);

        ComputeResearchClusterAdapter420.ClusterRecord memory changed = base;
        changed.clusterIdentityCommitment = keccak256("other-cluster");
        require(adapter.contributionId(changed) != expected, "cluster substitution");

        changed = base;
        changed.schedulerIdentityCommitment = keccak256("other-scheduler");
        require(adapter.contributionId(changed) != expected, "scheduler substitution");

        changed = base;
        changed.researchProjectCommitment = keccak256("other-project");
        require(adapter.contributionId(changed) != expected, "project substitution");

        changed = base;
        changed.workloadCommitment = keccak256("other-workload");
        require(adapter.contributionId(changed) != expected, "workload substitution");

        changed = base;
        changed.submitterIdentityCommitment = keccak256("other-submitter");
        require(adapter.contributionId(changed) != expected, "submitter substitution");

        changed = base;
        changed.allocationCommitment = keccak256("other-allocation");
        require(adapter.contributionId(changed) != expected, "allocation substitution");
    }

    function testRecordCommitmentBindsNodeResultTimesUsageAndEvidence() public {
        ComputeResearchClusterAdapter420.ClusterRecord memory base = _record();
        bytes32 expectedId = adapter.contributionId(base);
        bytes32 expectedRecord = adapter.recordCommitment(base);

        ComputeResearchClusterAdapter420.ClusterRecord memory changed = base;
        changed.nodeSetCommitment = keccak256("other-node-set");
        require(adapter.contributionId(changed) == expectedId, "identity changed with node set");
        require(adapter.recordCommitment(changed) != expectedRecord, "node set not bound");

        changed = base;
        changed.resultCommitment = keccak256("other-result");
        require(adapter.recordCommitment(changed) != expectedRecord, "result not bound");

        changed = base;
        changed.startedAt += 1;
        require(adapter.recordCommitment(changed) != expectedRecord, "start time not bound");

        changed = base;
        changed.completedAt += 1;
        require(adapter.recordCommitment(changed) != expectedRecord, "completion time not bound");

        changed = base;
        changed.resourceUsageCommitment = keccak256("other-resource-usage");
        require(adapter.recordCommitment(changed) != expectedRecord, "resource usage not bound");

        changed = base;
        changed.evidenceCommitment = keccak256("other-evidence");
        require(adapter.recordCommitment(changed) != expectedRecord, "evidence not bound");
    }

    function testRejectsMissingRequiredBindings() public {
        ComputeResearchClusterAdapter420.ClusterRecord memory r = _record();
        r.clusterIdentityCommitment = bytes32(0);
        _expectInvalid(r);

        r = _record();
        r.schedulerIdentityCommitment = bytes32(0);
        _expectInvalid(r);

        r = _record();
        r.researchProjectCommitment = bytes32(0);
        _expectInvalid(r);

        r = _record();
        r.workloadCommitment = bytes32(0);
        _expectInvalid(r);

        r = _record();
        r.submitterIdentityCommitment = bytes32(0);
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
        r.evidenceCommitment = bytes32(0);
        _expectInvalid(r);
    }

    function testRejectsImpossibleLifecycleOrdering() public {
        ComputeResearchClusterAdapter420.ClusterRecord memory r = _record();
        r.submittedAt = 0;
        _expectInvalid(r);

        r = _record();
        r.startedAt = r.submittedAt - 1;
        _expectInvalid(r);

        r = _record();
        r.completedAt = r.startedAt - 1;
        _expectInvalid(r);
    }

    function testAllowsOptionalNodeSetWithoutWeakeningRemainingRecord() public {
        ComputeResearchClusterAdapter420.ClusterRecord memory r = _record();
        bytes32 withNodes = adapter.recordCommitment(r);
        r.nodeSetCommitment = bytes32(0);
        bytes32 withoutNodes = adapter.recordCommitment(r);
        require(withNodes != withoutNodes, "optional node set not committed");
        require(withoutNodes != bytes32(0), "optional node set rejected");
    }

    function _expectInvalid(ComputeResearchClusterAdapter420.ClusterRecord memory r) private {
        (bool ok,) = address(adapter).call(abi.encodeCall(adapter.normalize, (r)));
        require(!ok, "invalid cluster record accepted");
    }
}

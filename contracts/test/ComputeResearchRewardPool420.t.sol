// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeResearchRewardPool420.sol";

contract MockResearchPoolFunding420 is IComputeUsefulRewardPoolFunding420 {
    uint8 public constant TARGET_POOL = 2;
    mapping(bytes32 => uint256) public fundedByTarget;

    function setFunded(bytes32 poolId, uint256 amount) external {
        fundedByTarget[keccak256(abi.encode(TARGET_POOL, poolId))] = amount;
    }
}

contract MockResearchPoolAccounting420 is IComputeUsefulContributionAccountingPool420 {
    mapping(bytes32 => ContributionRecord) private _records;

    function set(bytes32 contributionId, ContributionRecord calldata r) external {
        _records[contributionId] = r;
    }

    function contribution(bytes32 contributionId)
        external
        view
        returns (ContributionRecord memory r)
    {
        r = _records[contributionId];
        require(r.exists, "unknown contribution");
    }
}

contract MockResearchMetricSource420 {
    function contributionEvidence(bytes32) external pure returns (bytes32) {
        return bytes32(0);
    }
}

contract ComputeResearchRewardPool420Test {
    bytes32 private constant POLICY_ID = keccak256("cmp6/policy/project-credit");
    bytes32 private constant METRIC_ID = keccak256("cmp6/metric/project-credit");
    bytes32 private constant CONTRIBUTION_ID = keccak256("cmp6/contribution/1");

    ComputeResearchProjectRegistry420 private projects;
    ComputeUsefulContributionPolicy420 private policies;
    MockResearchPoolFunding420 private funding;
    MockResearchPoolAccounting420 private accounting;
    MockResearchMetricSource420 private source;
    ComputeResearchRewardPool420 private pools;

    function setUp() public {
        projects = new ComputeResearchProjectRegistry420();
        policies = new ComputeUsefulContributionPolicy420(address(this));
        funding = new MockResearchPoolFunding420();
        accounting = new MockResearchPoolAccounting420();
        source = new MockResearchMetricSource420();
        pools = new ComputeResearchRewardPool420(
            address(projects),
            address(policies),
            address(funding),
            address(accounting)
        );

        policies.publish(
            POLICY_ID,
            policies.METRIC_PROJECT_CREDIT(),
            METRIC_ID,
            address(source),
            1e24
        );
    }

    function _createProject(bytes32 domain) private returns (bytes32 projectId) {
        projectId = projects.registerProject(
            domain,
            keccak256(abi.encode("definition", domain))
        );
    }

    function _createPool(bytes32 projectId) private returns (bytes32 poolId) {
        bytes32 projectCommitment = projects.currentCommitment(projectId);
        poolId = pools.createPool(
            projectId,
            1,
            projectCommitment,
            POLICY_ID,
            1
        );
    }

    function _record(
        bytes32 poolId,
        bytes32 projectId,
        bytes32 policyId,
        uint32 revision,
        bytes32 policyCommitment,
        bytes32 metricId
    ) private {
        funding.setFunded(poolId, 50 ether);
        accounting.set(
            CONTRIBUTION_ID,
            IComputeUsefulContributionAccountingPool420.ContributionRecord({
                contributionId: CONTRIBUTION_ID,
                contributionRef: keccak256("cmp6/source/ref"),
                gateId: keccak256("cmp6/gate"),
                jobId: keccak256("cmp6/job"),
                contributor: address(0xA11CE),
                projectRef: projectId,
                policyId: policyId,
                policyRevision: revision,
                policyCommitment: policyCommitment,
                metricKind: policies.METRIC_PROJECT_CREDIT(),
                metricId: metricId,
                amount: 250,
                observedAt: uint64(block.timestamp),
                evidenceCommitment: keccak256("cmp6/evidence"),
                recordedAt: uint64(block.timestamp),
                exists: true
            })
        );
    }

    function testCanonicalResearchDomainsCanCreateDistinctPools() public {
        bytes32[5] memory domains = [
            keccak256("cancer-research"),
            keccak256("protein-folding"),
            keccak256("climate-simulation"),
            keccak256("astronomy"),
            keccak256("drug-discovery")
        ];

        bytes32 previous;
        for (uint256 i; i < domains.length; ++i) {
            bytes32 projectId = _createProject(domains[i]);
            bytes32 poolId = _createPool(projectId);
            ComputeResearchRewardPool420.Pool memory p = pools.pool(poolId);
            require(p.researchDomain == domains[i], "domain drift");
            require(p.projectId == projectId, "project drift");
            require(poolId != previous, "pool collision");
            previous = poolId;
        }
    }

    function testPoolFreezesExactProjectAndMetricPolicy() public {
        bytes32 projectId = _createProject(keccak256("cancer-research"));
        bytes32 projectCommitment = projects.currentCommitment(projectId);
        bytes32 policyCommitment = policies.commitment(POLICY_ID, 1);

        bytes32 poolId = _createPool(projectId);
        ComputeResearchRewardPool420.Pool memory p = pools.pool(poolId);

        require(p.projectRevision == 1, "project revision drift");
        require(p.projectCommitment == projectCommitment, "project commitment drift");
        require(p.policyId == POLICY_ID, "policy id drift");
        require(p.policyRevision == 1, "policy revision drift");
        require(p.policyCommitment == policyCommitment, "policy commitment drift");
        require(p.metricKind == policies.METRIC_PROJECT_CREDIT(), "metric kind drift");
        require(p.metricId == METRIC_ID, "metric id drift");
        require(p.owner == address(this), "owner drift");
        require(p.acceptingContributions, "pool not active");
    }

    function testPoolFundingIsReportedButNotConsumed() public {
        bytes32 projectId = _createProject(keccak256("protein-folding"));
        bytes32 poolId = _createPool(projectId);

        require(pools.fundedAmount(poolId) == 0, "unexpected funding");
        funding.setFunded(poolId, 100 ether);
        require(pools.fundedAmount(poolId) == 100 ether, "funding report drift");
        require(pools.fundedAmount(poolId) == 100 ether, "funding was consumed");
    }

    function testCompatibleVerifiedContributionIsEligibleOnlyWhenFundedAndOpen() public {
        bytes32 projectId = _createProject(keccak256("climate-simulation"));
        bytes32 poolId = _createPool(projectId);
        bytes32 policyCommitment = policies.commitment(POLICY_ID, 1);

        _record(poolId, projectId, POLICY_ID, 1, policyCommitment, METRIC_ID);
        require(pools.eligibleContribution(poolId, CONTRIBUTION_ID), "compatible contribution rejected");

        pools.setAcceptance(poolId, false);
        require(!pools.eligibleContribution(poolId, CONTRIBUTION_ID), "paused pool accepted contribution");

        pools.setAcceptance(poolId, true);
        funding.setFunded(poolId, 0);
        require(!pools.eligibleContribution(poolId, CONTRIBUTION_ID), "unfunded pool accepted contribution");
    }

    function testProjectPolicyAndMetricMismatchFailClosed() public {
        bytes32 projectId = _createProject(keccak256("astronomy"));
        bytes32 otherProject = _createProject(keccak256("drug-discovery"));
        bytes32 poolId = _createPool(projectId);
        bytes32 policyCommitment = policies.commitment(POLICY_ID, 1);

        _record(poolId, otherProject, POLICY_ID, 1, policyCommitment, METRIC_ID);
        require(!pools.eligibleContribution(poolId, CONTRIBUTION_ID), "wrong project accepted");

        _record(poolId, projectId, keccak256("other/policy"), 1, policyCommitment, METRIC_ID);
        require(!pools.eligibleContribution(poolId, CONTRIBUTION_ID), "wrong policy accepted");

        _record(poolId, projectId, POLICY_ID, 1, policyCommitment, keccak256("other/metric"));
        require(!pools.eligibleContribution(poolId, CONTRIBUTION_ID), "wrong metric accepted");
    }

    function testStaleProjectRevisionCannotCreatePool() public {
        bytes32 projectId = _createProject(keccak256("cancer-research"));
        bytes32 oldCommitment = projects.currentCommitment(projectId);

        projects.reviseProject(
            projectId,
            1,
            keccak256("cancer-research"),
            keccak256("definition/v2")
        );

        (bool ok,) = address(pools).call(
            abi.encodeCall(
                pools.createPool,
                (projectId, uint64(1), oldCommitment, POLICY_ID, uint32(1))
            )
        );
        require(!ok, "stale project revision accepted");
    }

    function testPoolIdentityIsReplaySafeAndOwnerControlsAcceptance() public {
        bytes32 projectId = _createProject(keccak256("protein-folding"));
        bytes32 projectCommitment = projects.currentCommitment(projectId);
        bytes32 poolId = _createPool(projectId);

        (bool ok,) = address(pools).call(
            abi.encodeCall(
                pools.createPool,
                (projectId, uint64(1), projectCommitment, POLICY_ID, uint32(1))
            )
        );
        require(!ok, "duplicate pool accepted");

        pools.setAcceptance(poolId, false);
        ComputeResearchRewardPool420.Pool memory p = pools.pool(poolId);
        require(!p.acceptingContributions, "acceptance not paused");
    }
}

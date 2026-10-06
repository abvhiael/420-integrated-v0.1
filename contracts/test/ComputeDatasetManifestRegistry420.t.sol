// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeResearchProjectRegistry420.sol";
import "../src/compute/ComputeDatasetManifestRegistry420.sol";

interface VmDatasetManifest420 {
    function prank(address actor) external;
}

contract ComputeDatasetManifestRegistry420Test {
    VmDatasetManifest420 constant vm =
        VmDatasetManifest420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant OWNER = address(0xA11CE);
    address constant OUTSIDER = address(0xB0B);
    bytes32 constant PROJECT_DOMAIN = keccak256("oncology");
    bytes32 constant PROJECT_DEF_A = keccak256("project-a");
    bytes32 constant PROJECT_DEF_B = keccak256("project-b");
    bytes32 constant CONTENT_A = keccak256("dataset-content-a");
    bytes32 constant CONTENT_B = keccak256("dataset-content-b");
    bytes32 constant SCHEMA_A = keccak256("schema-a");
    bytes32 constant SCHEMA_B = keccak256("schema-b");
    bytes32 constant ACCESS_A = keccak256("access-policy-a");
    bytes32 constant ACCESS_B = keccak256("access-policy-b");
    bytes32 constant PROVENANCE_A = keccak256("provenance-a");
    bytes32 constant PROVENANCE_B = keccak256("provenance-b");
    bytes32 constant PARTITION_A = keccak256("partition-a");
    bytes32 constant PARTITION_B = keccak256("partition-b");

    ComputeResearchProjectRegistry420 projects;
    ComputeDatasetManifestRegistry420 datasets;
    bytes32 projectId;

    function setUp() public {
        projects = new ComputeResearchProjectRegistry420();
        datasets = new ComputeDatasetManifestRegistry420(
            IComputeResearchProjectDatasetSource420(address(projects))
        );
        vm.prank(OWNER);
        projectId = projects.registerProject(PROJECT_DOMAIN, PROJECT_DEF_A);
    }

    function _projectRef() private view returns (uint64 revision_, bytes32 commitment_) {
        ComputeResearchProjectRegistry420.Project memory p = projects.project(projectId);
        revision_ = p.revision;
        commitment_ = projects.currentCommitment(projectId);
    }

    function _register() private returns (bytes32 id) {
        (uint64 projectRevision, bytes32 projectCommitment) = _projectRef();
        vm.prank(OWNER);
        id = datasets.registerDataset(
            projectId,
            projectRevision,
            projectCommitment,
            CONTENT_A,
            SCHEMA_A,
            ACCESS_A,
            PROVENANCE_A,
            PARTITION_A,
            4096
        );
    }

    function _attempt(address actor, bytes memory call_) private returns (bool ok) {
        vm.prank(actor);
        (ok,) = address(datasets).call(call_);
    }

    function testCanonicalIdentityCommitmentAndInputBindingAreReconstructable() public {
        bytes32 id = _register();
        bytes32 expectedId = keccak256(abi.encode(
            datasets.DATASET_DOMAIN(), block.chainid, address(datasets), projectId, OWNER, uint64(1)
        ));
        require(id == expectedId, "dataset id");

        ComputeDatasetManifestRegistry420.DatasetManifest memory d = datasets.dataset(id);
        require(d.controller == OWNER && d.projectId == projectId, "controller/project");
        require(d.contentCommitment == CONTENT_A && d.byteLength == 4096, "content");
        require(d.revision == 1 && d.active, "revision");

        bytes32 c = datasets.commitment(id, 1);
        require(datasets.currentCommitment(id) == c, "current commitment");
        require(datasets.isCurrentUsable(id, 1, c, CONTENT_A), "usable");
        require(!datasets.isCurrentUsable(id, 1, c, CONTENT_B), "wrong input accepted");
    }

    function testInvalidRegistrationRejectsWithoutConsumingIdentity() public {
        (uint64 projectRevision, bytes32 projectCommitment) = _projectRef();
        require(
            !_attempt(
                OWNER,
                abi.encodeCall(
                    datasets.registerDataset,
                    (
                        projectId,
                        projectRevision,
                        projectCommitment,
                        bytes32(0),
                        SCHEMA_A,
                        ACCESS_A,
                        PROVENANCE_A,
                        PARTITION_A,
                        uint64(4096)
                    )
                )
            ),
            "zero content"
        );
        require(datasets.nextDatasetNonce() == 0, "nonce consumed");
        require(_register() != bytes32(0) && datasets.nextDatasetNonce() == 1, "allocation");
    }

    function testOwnerOnlyRevisionIsAppendOnlyAndStaleSafe() public {
        bytes32 id = _register();
        bytes32 oldCommitment = datasets.commitment(id, 1);
        (uint64 projectRevision, bytes32 projectCommitment) = _projectRef();

        require(
            !_attempt(
                OUTSIDER,
                abi.encodeCall(
                    datasets.reviseDataset,
                    (
                        id,
                        uint64(1),
                        projectRevision,
                        projectCommitment,
                        CONTENT_B,
                        SCHEMA_B,
                        ACCESS_B,
                        PROVENANCE_B,
                        PARTITION_B,
                        uint64(8192)
                    )
                )
            ),
            "outsider revised"
        );

        vm.prank(OWNER);
        datasets.reviseDataset(
            id,
            1,
            projectRevision,
            projectCommitment,
            CONTENT_B,
            SCHEMA_B,
            ACCESS_B,
            PROVENANCE_B,
            PARTITION_B,
            8192
        );

        ComputeDatasetManifestRegistry420.DatasetManifest memory oldD = datasets.revision(id, 1);
        ComputeDatasetManifestRegistry420.DatasetManifest memory current = datasets.dataset(id);
        require(oldD.contentCommitment == CONTENT_A && oldD.byteLength == 4096, "history drift");
        require(current.contentCommitment == CONTENT_B && current.byteLength == 8192, "revision");
        require(current.predecessorCommitment == oldCommitment && current.revision == 2, "chain");
        require(datasets.commitment(id, 1) == oldCommitment, "old commitment drift");

        require(
            !_attempt(
                OWNER,
                abi.encodeCall(
                    datasets.reviseDataset,
                    (
                        id,
                        uint64(2),
                        projectRevision,
                        projectCommitment,
                        CONTENT_B,
                        SCHEMA_B,
                        ACCESS_B,
                        PROVENANCE_B,
                        PARTITION_B,
                        uint64(8192)
                    )
                )
            ),
            "noop revision"
        );
        require(
            !_attempt(
                OWNER,
                abi.encodeCall(
                    datasets.reviseDataset,
                    (
                        id,
                        uint64(1),
                        projectRevision,
                        projectCommitment,
                        CONTENT_A,
                        SCHEMA_A,
                        ACCESS_A,
                        PROVENANCE_A,
                        PARTITION_A,
                        uint64(4096)
                    )
                )
            ),
            "stale revision"
        );
    }

    function testProjectRevisionDriftFailsClosedUntilExplicitManifestRefresh() public {
        bytes32 id = _register();
        bytes32 c1 = datasets.commitment(id, 1);
        require(datasets.isCurrentUsable(id, 1, c1, CONTENT_A), "initial unusable");

        vm.prank(OWNER);
        projects.reviseProject(projectId, 1, PROJECT_DOMAIN, PROJECT_DEF_B);
        require(!datasets.isCurrentUsable(id, 1, c1, CONTENT_A), "stale project accepted");

        (uint64 projectRevision, bytes32 projectCommitment) = _projectRef();
        vm.prank(OWNER);
        datasets.reviseDataset(
            id,
            1,
            projectRevision,
            projectCommitment,
            CONTENT_A,
            SCHEMA_A,
            ACCESS_A,
            PROVENANCE_A,
            PARTITION_A,
            4096
        );
        bytes32 c2 = datasets.commitment(id, 2);
        require(datasets.isCurrentUsable(id, 2, c2, CONTENT_A), "refresh unusable");
        require(!datasets.isCurrentUsable(id, 1, c1, CONTENT_A), "stale manifest replay");
    }

    function testProjectPauseAndDatasetActivationFailClosedForNewWork() public {
        bytes32 id = _register();

        vm.prank(OWNER);
        datasets.setActive(id, 1, false);
        bytes32 c2 = datasets.commitment(id, 2);
        require(!datasets.isCurrentUsable(id, 2, c2, CONTENT_A), "inactive accepted");

        vm.prank(OWNER);
        datasets.setActive(id, 2, true);
        bytes32 c3 = datasets.commitment(id, 3);
        require(datasets.isCurrentUsable(id, 3, c3, CONTENT_A), "reactivation failed");

        vm.prank(OWNER);
        projects.setNewWorkAcceptance(projectId, 1, false);
        require(!datasets.isCurrentUsable(id, 3, c3, CONTENT_A), "paused project accepted");

        require(
            _attempt(OWNER, abi.encodeCall(datasets.setActive, (id, uint64(3), false))),
            "controller cannot deactivate"
        );
        require(!datasets.dataset(id).active, "deactivation failed");
        require(
            !_attempt(OWNER, abi.encodeCall(datasets.setActive, (id, uint64(4), true))),
            "reactivated against paused project"
        );
    }

    function testCrossDatasetAndCommitmentReplayFailsClosed() public {
        bytes32 first = _register();
        vm.prank(OWNER);
        bytes32 second = datasets.registerDataset(
            projectId,
            1,
            projects.currentCommitment(projectId),
            CONTENT_A,
            SCHEMA_A,
            ACCESS_A,
            PROVENANCE_A,
            PARTITION_A,
            4096
        );
        bytes32 firstCommitment = datasets.commitment(first, 1);
        bytes32 secondCommitment = datasets.commitment(second, 1);
        require(first != second && firstCommitment != secondCommitment, "identity collision");
        require(!datasets.isCurrentUsable(second, 1, firstCommitment, CONTENT_A), "cross replay");
    }

    function testManifestDoesNotGrantAccessOrProtocolAuthority() public {
        bytes32 id = _register();
        bytes32 c = datasets.commitment(id, 1);
        require(datasets.isCurrentUsable(id, 1, c, CONTENT_A), "manifest invalid");
        require(address(datasets.projectRegistry()) == address(projects), "project source");
    }
}

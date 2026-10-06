// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeResearchProjectRegistry420.sol";
import "../src/compute/ComputeExecutionEnvironmentRegistry420.sol";

interface VmExecutionEnvironment420 { function prank(address actor) external; }

contract ComputeExecutionEnvironmentRegistry420Test {
    VmExecutionEnvironment420 constant vm = VmExecutionEnvironment420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant OWNER = address(0xA11CE);
    address constant OUTSIDER = address(0xB0B);
    bytes32 constant PROJECT_DOMAIN = keccak256("protein-folding");
    bytes32 constant PROJECT_DEF_A = keccak256("project-a");
    bytes32 constant PROJECT_DEF_B = keccak256("project-b");
    bytes32 constant ARTIFACT_A = keccak256("oci-image-a");
    bytes32 constant ARTIFACT_B = keccak256("oci-image-b");
    bytes32 constant RUNTIME_A = keccak256("runtime-profile-a");
    bytes32 constant RUNTIME_B = keccak256("runtime-profile-b");
    bytes32 constant DEPS_A = keccak256("dependency-lock-a");
    bytes32 constant DEPS_B = keccak256("dependency-lock-b");
    bytes32 constant COMMAND_A = keccak256("command-spec-a");
    bytes32 constant COMMAND_B = keccak256("command-spec-b");
    bytes32 constant PLATFORM_A = keccak256("linux-amd64");
    bytes32 constant PLATFORM_B = keccak256("linux-arm64");
    bytes32 constant SANDBOX_A = keccak256("sandbox-profile-a");
    bytes32 constant SANDBOX_B = keccak256("sandbox-profile-b");
    bytes32 constant REPRO_A = keccak256("repro-policy-a");
    bytes32 constant REPRO_B = keccak256("repro-policy-b");

    ComputeResearchProjectRegistry420 projects;
    ComputeExecutionEnvironmentRegistry420 environments;
    bytes32 projectId;

    function setUp() public {
        projects = new ComputeResearchProjectRegistry420();
        environments = new ComputeExecutionEnvironmentRegistry420(IComputeResearchProjectEnvironmentSource420(address(projects)));
        vm.prank(OWNER);
        projectId = projects.registerProject(PROJECT_DOMAIN, PROJECT_DEF_A);
    }

    function _projectRef() private view returns (uint64 revision_, bytes32 commitment_) {
        ComputeResearchProjectRegistry420.Project memory p = projects.project(projectId);
        revision_ = p.revision;
        commitment_ = projects.currentCommitment(projectId);
    }

    function _register() private returns (bytes32 id) {
        (uint64 pr, bytes32 pc) = _projectRef();
        vm.prank(OWNER);
        id = environments.registerEnvironment(projectId, pr, pc, ARTIFACT_A, RUNTIME_A, DEPS_A, COMMAND_A, PLATFORM_A, SANDBOX_A, REPRO_A);
    }

    function _attempt(address actor, bytes memory call_) private returns (bool ok) {
        vm.prank(actor);
        (ok,) = address(environments).call(call_);
    }

    function testCanonicalIdentityAndCommitmentAreReconstructable() public {
        bytes32 id = _register();
        bytes32 expectedId = keccak256(abi.encode(environments.ENVIRONMENT_DOMAIN(), block.chainid, address(environments), projectId, OWNER, uint64(1)));
        require(id == expectedId, "environment id");
        ComputeExecutionEnvironmentRegistry420.Environment memory e = environments.environment(id);
        require(e.controller == OWNER && e.projectId == projectId, "controller/project");
        require(e.artifactCommitment == ARTIFACT_A && e.runtimeProfileCommitment == RUNTIME_A, "runtime");
        require(e.dependencyLockCommitment == DEPS_A && e.commandSpecCommitment == COMMAND_A, "deps/command");
        require(e.revision == 1 && e.active, "revision");
        bytes32 c = environments.commitment(id, 1);
        require(environments.currentCommitment(id) == c, "current");
        require(environments.isCurrentReproducible(id, 1, c), "reproducible");
        require(!environments.isCurrentReproducible(id, 1, bytes32(uint256(1))), "wrong commitment");
    }

    function testInvalidRegistrationRejectsWithoutConsumingIdentity() public {
        (uint64 pr, bytes32 pc) = _projectRef();
        require(!_attempt(OWNER, abi.encodeCall(environments.registerEnvironment,(projectId,pr,pc,bytes32(0),RUNTIME_A,DEPS_A,COMMAND_A,PLATFORM_A,SANDBOX_A,REPRO_A))), "zero artifact");
        require(environments.nextEnvironmentNonce() == 0, "nonce consumed");
        require(_register() != bytes32(0) && environments.nextEnvironmentNonce() == 1, "allocation");
    }

    function testOwnerOnlyRevisionIsAppendOnlyAndStaleSafe() public {
        bytes32 id = _register();
        bytes32 oldCommitment = environments.commitment(id, 1);
        (uint64 pr, bytes32 pc) = _projectRef();
        require(!_attempt(OUTSIDER, abi.encodeCall(environments.reviseEnvironment,(id,uint64(1),pr,pc,ARTIFACT_B,RUNTIME_B,DEPS_B,COMMAND_B,PLATFORM_B,SANDBOX_B,REPRO_B))), "outsider revised");
        vm.prank(OWNER);
        environments.reviseEnvironment(id,1,pr,pc,ARTIFACT_B,RUNTIME_B,DEPS_B,COMMAND_B,PLATFORM_B,SANDBOX_B,REPRO_B);
        ComputeExecutionEnvironmentRegistry420.Environment memory oldE = environments.revision(id,1);
        ComputeExecutionEnvironmentRegistry420.Environment memory current = environments.environment(id);
        require(oldE.artifactCommitment == ARTIFACT_A && oldE.runtimeProfileCommitment == RUNTIME_A, "history drift");
        require(current.artifactCommitment == ARTIFACT_B && current.runtimeProfileCommitment == RUNTIME_B, "revision");
        require(current.predecessorCommitment == oldCommitment && current.revision == 2, "chain");
        require(environments.commitment(id,1) == oldCommitment, "old commitment drift");
        require(!_attempt(OWNER, abi.encodeCall(environments.reviseEnvironment,(id,uint64(2),pr,pc,ARTIFACT_B,RUNTIME_B,DEPS_B,COMMAND_B,PLATFORM_B,SANDBOX_B,REPRO_B))), "noop revision");
        require(!_attempt(OWNER, abi.encodeCall(environments.reviseEnvironment,(id,uint64(1),pr,pc,ARTIFACT_A,RUNTIME_A,DEPS_A,COMMAND_A,PLATFORM_A,SANDBOX_A,REPRO_A))), "stale revision");
    }

    function testProjectRevisionDriftFailsClosedUntilExplicitEnvironmentRefresh() public {
        bytes32 id = _register();
        bytes32 c1 = environments.commitment(id,1);
        require(environments.isCurrentReproducible(id,1,c1), "initial unusable");
        vm.prank(OWNER);
        projects.reviseProject(projectId,1,PROJECT_DOMAIN,PROJECT_DEF_B);
        require(!environments.isCurrentReproducible(id,1,c1), "stale project accepted");
        (uint64 pr, bytes32 pc) = _projectRef();
        vm.prank(OWNER);
        environments.reviseEnvironment(id,1,pr,pc,ARTIFACT_A,RUNTIME_A,DEPS_A,COMMAND_A,PLATFORM_A,SANDBOX_A,REPRO_A);
        bytes32 c2 = environments.commitment(id,2);
        require(environments.isCurrentReproducible(id,2,c2), "refresh unusable");
        require(!environments.isCurrentReproducible(id,1,c1), "stale replay");
    }

    function testProjectPauseAndEnvironmentActivationFailClosedForNewWork() public {
        bytes32 id = _register();
        vm.prank(OWNER);
        environments.setActive(id,1,false);
        bytes32 c2 = environments.commitment(id,2);
        require(!environments.isCurrentReproducible(id,2,c2), "inactive accepted");
        vm.prank(OWNER);
        environments.setActive(id,2,true);
        bytes32 c3 = environments.commitment(id,3);
        require(environments.isCurrentReproducible(id,3,c3), "reactivation failed");
        vm.prank(OWNER);
        projects.setNewWorkAcceptance(projectId,1,false);
        require(!environments.isCurrentReproducible(id,3,c3), "paused project accepted");
        require(_attempt(OWNER,abi.encodeCall(environments.setActive,(id,uint64(3),false))), "controller cannot deactivate");
        require(!environments.environment(id).active, "deactivation failed");
        require(!_attempt(OWNER,abi.encodeCall(environments.setActive,(id,uint64(4),true))), "reactivated against paused project");
    }

    function testCrossEnvironmentCommitmentReplayFailsClosed() public {
        bytes32 first = _register();
        bytes32 pc = projects.currentCommitment(projectId);
        vm.prank(OWNER);
        bytes32 second = environments.registerEnvironment(projectId,1,pc,ARTIFACT_A,RUNTIME_A,DEPS_A,COMMAND_A,PLATFORM_A,SANDBOX_A,REPRO_A);
        bytes32 c1 = environments.commitment(first,1);
        bytes32 c2 = environments.commitment(second,1);
        require(first != second && c1 != c2, "identity collision");
        require(!environments.isCurrentReproducible(second,1,c1), "cross replay");
    }

    function testEnvironmentCommitmentDoesNotGrantExecutionOrCorrectnessAuthority() public {
        bytes32 id = _register();
        bytes32 c = environments.commitment(id,1);
        require(environments.isCurrentReproducible(id,1,c), "environment invalid");
        require(address(environments.projectRegistry()) == address(projects), "project source");
    }
}

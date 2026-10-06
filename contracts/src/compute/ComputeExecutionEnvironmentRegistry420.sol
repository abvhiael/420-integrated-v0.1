// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";

interface IComputeResearchProjectEnvironmentSource420 {
    struct ProjectView {
        address owner;
        bytes32 researchDomain;
        bytes32 definitionCommitment;
        bytes32 predecessorCommitment;
        uint64 createdAt;
        uint64 updatedAt;
        uint64 revision;
        bool acceptingNewWork;
        uint8 status;
    }
    function systemName() external view returns (string memory);
    function protocolVersion() external view returns (uint32);
    function project(bytes32 projectId) external view returns (ProjectView memory);
    function isCurrentAcceptable(bytes32 projectId, uint64 revision, bytes32 exactCommitment)
        external view returns (bool);
}

/// @notice CMP-4.5 revisioned reproducible execution-environment manifests.
/// @dev Stores only immutable commitments needed to reconstruct an accepted scientific runtime.
///      It does not execute workloads, grant dataset access, choose workers/verifiers, or settle jobs.
contract ComputeExecutionEnvironmentRegistry420 is I420System {
    bytes32 public constant ENVIRONMENT_DOMAIN =
        keccak256("420/COMPUTE/EXECUTION_ENVIRONMENT/V1");
    bytes32 public constant COMMITMENT_DOMAIN =
        keccak256("420/COMPUTE/EXECUTION_ENVIRONMENT_COMMITMENT/V1");

    struct Environment {
        address controller;
        bytes32 projectId;
        uint64 projectRevision;
        bytes32 projectCommitment;
        bytes32 artifactCommitment;
        bytes32 runtimeProfileCommitment;
        bytes32 dependencyLockCommitment;
        bytes32 commandSpecCommitment;
        bytes32 platformCommitment;
        bytes32 sandboxProfileCommitment;
        bytes32 reproducibilityPolicyCommitment;
        bytes32 predecessorCommitment;
        uint64 revision;
        bool active;
    }

    IComputeResearchProjectEnvironmentSource420 public immutable projectRegistry;
    uint64 public nextEnvironmentNonce;
    mapping(bytes32 => Environment) private _environments;
    mapping(bytes32 => mapping(uint64 => Environment)) private _history;

    error InvalidProjectSource();
    error InvalidEnvironment();
    error UnknownEnvironment();
    error Unauthorized();
    error StaleRevision();
    error SerialExhausted();
    error NoChange();

    event ExecutionEnvironmentRegistered(bytes32 indexed environmentId, bytes32 indexed projectId, address indexed controller, uint64 revision, bytes32 environmentCommitment);
    event ExecutionEnvironmentRevised(bytes32 indexed environmentId, uint64 indexed previousRevision, uint64 indexed currentRevision, bytes32 environmentCommitment);
    event ExecutionEnvironmentActivationSet(bytes32 indexed environmentId, bool active, uint64 revision, bytes32 environmentCommitment);

    constructor(IComputeResearchProjectEnvironmentSource420 projectRegistry_) {
        address source = address(projectRegistry_);
        if (source == address(0) || source.code.length == 0) revert InvalidProjectSource();
        if (
            keccak256(bytes(projectRegistry_.systemName())) != keccak256(bytes("ComputeResearchProjectRegistry420"))
                || projectRegistry_.protocolVersion() != 1
        ) revert InvalidProjectSource();
        projectRegistry = projectRegistry_;
    }

    function systemName() external pure returns (string memory) { return "ComputeExecutionEnvironmentRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function registerEnvironment(
        bytes32 projectId,
        uint64 projectRevision,
        bytes32 projectCommitment,
        bytes32 artifactCommitment,
        bytes32 runtimeProfileCommitment,
        bytes32 dependencyLockCommitment,
        bytes32 commandSpecCommitment,
        bytes32 platformCommitment,
        bytes32 sandboxProfileCommitment,
        bytes32 reproducibilityPolicyCommitment
    ) external returns (bytes32 environmentId) {
        _validateFields(artifactCommitment, runtimeProfileCommitment, dependencyLockCommitment, commandSpecCommitment, platformCommitment, sandboxProfileCommitment, reproducibilityPolicyCommitment);
        _requireProjectController(projectId, msg.sender);
        if (!projectRegistry.isCurrentAcceptable(projectId, projectRevision, projectCommitment)) revert InvalidEnvironment();
        if (nextEnvironmentNonce == type(uint64).max) revert SerialExhausted();

        uint64 nonce = ++nextEnvironmentNonce;
        environmentId = keccak256(abi.encode(ENVIRONMENT_DOMAIN, block.chainid, address(this), projectId, msg.sender, nonce));
        if (_environments[environmentId].revision != 0) revert InvalidEnvironment();

        Environment memory e = Environment({
            controller: msg.sender,
            projectId: projectId,
            projectRevision: projectRevision,
            projectCommitment: projectCommitment,
            artifactCommitment: artifactCommitment,
            runtimeProfileCommitment: runtimeProfileCommitment,
            dependencyLockCommitment: dependencyLockCommitment,
            commandSpecCommitment: commandSpecCommitment,
            platformCommitment: platformCommitment,
            sandboxProfileCommitment: sandboxProfileCommitment,
            reproducibilityPolicyCommitment: reproducibilityPolicyCommitment,
            predecessorCommitment: bytes32(0),
            revision: 1,
            active: true
        });
        _environments[environmentId] = e;
        _history[environmentId][1] = e;
        emit ExecutionEnvironmentRegistered(environmentId, projectId, msg.sender, 1, _commitment(environmentId, e));
    }

    function reviseEnvironment(
        bytes32 environmentId,
        uint64 expectedRevision,
        uint64 projectRevision,
        bytes32 projectCommitment,
        bytes32 artifactCommitment,
        bytes32 runtimeProfileCommitment,
        bytes32 dependencyLockCommitment,
        bytes32 commandSpecCommitment,
        bytes32 platformCommitment,
        bytes32 sandboxProfileCommitment,
        bytes32 reproducibilityPolicyCommitment
    ) external {
        Environment storage e = _guardController(environmentId, expectedRevision);
        _validateFields(artifactCommitment, runtimeProfileCommitment, dependencyLockCommitment, commandSpecCommitment, platformCommitment, sandboxProfileCommitment, reproducibilityPolicyCommitment);
        if (!projectRegistry.isCurrentAcceptable(e.projectId, projectRevision, projectCommitment)) revert InvalidEnvironment();
        if (
            e.projectRevision == projectRevision
                && e.projectCommitment == projectCommitment
                && e.artifactCommitment == artifactCommitment
                && e.runtimeProfileCommitment == runtimeProfileCommitment
                && e.dependencyLockCommitment == dependencyLockCommitment
                && e.commandSpecCommitment == commandSpecCommitment
                && e.platformCommitment == platformCommitment
                && e.sandboxProfileCommitment == sandboxProfileCommitment
                && e.reproducibilityPolicyCommitment == reproducibilityPolicyCommitment
        ) revert NoChange();

        uint64 previousRevision = e.revision;
        bytes32 predecessor = _commitment(environmentId, e);
        e.projectRevision = projectRevision;
        e.projectCommitment = projectCommitment;
        e.artifactCommitment = artifactCommitment;
        e.runtimeProfileCommitment = runtimeProfileCommitment;
        e.dependencyLockCommitment = dependencyLockCommitment;
        e.commandSpecCommitment = commandSpecCommitment;
        e.platformCommitment = platformCommitment;
        e.sandboxProfileCommitment = sandboxProfileCommitment;
        e.reproducibilityPolicyCommitment = reproducibilityPolicyCommitment;
        e.predecessorCommitment = predecessor;
        e.revision = previousRevision + 1;
        _history[environmentId][e.revision] = e;
        emit ExecutionEnvironmentRevised(environmentId, previousRevision, e.revision, _commitment(environmentId, e));
    }

    function setActive(bytes32 environmentId, uint64 expectedRevision, bool active) external {
        Environment storage e = _guardController(environmentId, expectedRevision);
        if (e.active == active) revert NoChange();
        if (active && !projectRegistry.isCurrentAcceptable(e.projectId, e.projectRevision, e.projectCommitment)) revert InvalidEnvironment();
        bytes32 predecessor = _commitment(environmentId, e);
        e.active = active;
        e.predecessorCommitment = predecessor;
        e.revision += 1;
        _history[environmentId][e.revision] = e;
        emit ExecutionEnvironmentActivationSet(environmentId, active, e.revision, _commitment(environmentId, e));
    }

    function environment(bytes32 environmentId) external view returns (Environment memory) {
        Environment memory e = _environments[environmentId];
        if (e.revision == 0) revert UnknownEnvironment();
        return e;
    }

    function revision(bytes32 environmentId, uint64 revision_) external view returns (Environment memory) {
        Environment memory e = _history[environmentId][revision_];
        if (e.revision == 0) revert UnknownEnvironment();
        return e;
    }

    function commitment(bytes32 environmentId, uint64 revision_) public view returns (bytes32) {
        Environment memory e = _history[environmentId][revision_];
        if (e.revision == 0) revert UnknownEnvironment();
        return _commitment(environmentId, e);
    }

    function currentCommitment(bytes32 environmentId) external view returns (bytes32) {
        Environment memory e = _environments[environmentId];
        if (e.revision == 0) revert UnknownEnvironment();
        return _commitment(environmentId, e);
    }

    function isCurrentReproducible(bytes32 environmentId, uint64 revision_, bytes32 exactEnvironmentCommitment)
        external view returns (bool)
    {
        Environment memory e = _environments[environmentId];
        if (
            e.revision == 0 || !e.active || e.revision != revision_
                || exactEnvironmentCommitment == bytes32(0)
                || exactEnvironmentCommitment != _commitment(environmentId, e)
        ) return false;
        return projectRegistry.isCurrentAcceptable(e.projectId, e.projectRevision, e.projectCommitment);
    }

    function _guardController(bytes32 environmentId, uint64 expectedRevision) private view returns (Environment storage e) {
        e = _environments[environmentId];
        if (e.revision == 0) revert UnknownEnvironment();
        if (e.revision != expectedRevision) revert StaleRevision();
        _requireProjectController(e.projectId, msg.sender);
        if (msg.sender != e.controller) revert Unauthorized();
    }

    function _requireProjectController(bytes32 projectId, address actor) private view {
        IComputeResearchProjectEnvironmentSource420.ProjectView memory p = projectRegistry.project(projectId);
        if (p.owner == address(0) || p.owner != actor) revert Unauthorized();
    }

    function _validateFields(
        bytes32 artifactCommitment,
        bytes32 runtimeProfileCommitment,
        bytes32 dependencyLockCommitment,
        bytes32 commandSpecCommitment,
        bytes32 platformCommitment,
        bytes32 sandboxProfileCommitment,
        bytes32 reproducibilityPolicyCommitment
    ) private pure {
        if (
            artifactCommitment == bytes32(0) || runtimeProfileCommitment == bytes32(0)
                || dependencyLockCommitment == bytes32(0) || commandSpecCommitment == bytes32(0)
                || platformCommitment == bytes32(0) || sandboxProfileCommitment == bytes32(0)
                || reproducibilityPolicyCommitment == bytes32(0)
        ) revert InvalidEnvironment();
    }

    function _commitment(bytes32 environmentId, Environment memory e) private view returns (bytes32) {
        return keccak256(abi.encode(
            COMMITMENT_DOMAIN, block.chainid, address(this), address(projectRegistry),
            environmentId, e.controller, e.projectId, e.projectRevision, e.projectCommitment,
            e.artifactCommitment, e.runtimeProfileCommitment, e.dependencyLockCommitment,
            e.commandSpecCommitment, e.platformCommitment, e.sandboxProfileCommitment,
            e.reproducibilityPolicyCommitment, e.predecessorCommitment, e.revision, e.active
        ));
    }
}

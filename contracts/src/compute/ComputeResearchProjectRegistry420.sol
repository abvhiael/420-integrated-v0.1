// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";

/// @notice Canonical CMP-4.2 registry for revisioned scientific research projects.
/// @dev Owns project identity/revision/acceptance only. It grants no job, funding, dataset,
/// worker, verifier, settlement, reward, governance, bridge, wallet or validator authority.
contract ComputeResearchProjectRegistry420 is I420System {
    bytes32 public constant PROJECT_DOMAIN = keccak256("420/COMPUTE/RESEARCH_PROJECT/V1");
    bytes32 public constant COMMITMENT_DOMAIN = keccak256("420/COMPUTE/RESEARCH_PROJECT_COMMITMENT/V1");

    enum Status { NONE, ACTIVE, RETIRED }

    struct Project {
        address owner;
        bytes32 researchDomain;
        bytes32 definitionCommitment;
        bytes32 predecessorCommitment;
        uint64 createdAt;
        uint64 updatedAt;
        uint64 revision;
        bool acceptingNewWork;
        Status status;
    }

    uint64 public nextProjectNonce;
    mapping(bytes32 => Project) private _projects;
    mapping(bytes32 => mapping(uint64 => Project)) private _history;

    error InvalidProject();
    error UnknownProject();
    error Unauthorized();
    error StaleRevision();
    error WrongState();
    error SerialExhausted();

    event ResearchProjectRegistered(
        bytes32 indexed projectId,
        address indexed owner,
        bytes32 indexed researchDomain,
        uint64 revision,
        bytes32 projectCommitment
    );
    event ResearchProjectRevised(
        bytes32 indexed projectId,
        uint64 indexed previousRevision,
        uint64 indexed currentRevision,
        bytes32 projectCommitment
    );
    event ResearchProjectAcceptanceSet(
        bytes32 indexed projectId,
        bool acceptingNewWork,
        uint64 revision,
        bytes32 projectCommitment
    );
    event ResearchProjectRetired(
        bytes32 indexed projectId,
        uint64 indexed revision,
        bytes32 projectCommitment
    );

    function systemName() external pure returns (string memory) {
        return "ComputeResearchProjectRegistry420";
    }

    function protocolVersion() external pure returns (uint32) {
        return 1;
    }

    /// @notice Register a project owned by the caller.
    /// @dev Researcher/institution identity attestation is intentionally deferred to CMP-4.3.
    function registerProject(bytes32 researchDomain, bytes32 definitionCommitment)
        external returns (bytes32 projectId)
    {
        if (researchDomain == bytes32(0) || definitionCommitment == bytes32(0))
            revert InvalidProject();
        if (nextProjectNonce == type(uint64).max) revert SerialExhausted();

        uint64 nonce = ++nextProjectNonce;
        projectId = keccak256(abi.encode(
            PROJECT_DOMAIN, block.chainid, address(this), msg.sender, nonce
        ));
        if (_projects[projectId].status != Status.NONE) revert InvalidProject();

        uint64 now_ = uint64(block.timestamp);
        Project memory p = Project({
            owner: msg.sender,
            researchDomain: researchDomain,
            definitionCommitment: definitionCommitment,
            predecessorCommitment: bytes32(0),
            createdAt: now_,
            updatedAt: now_,
            revision: 1,
            acceptingNewWork: true,
            status: Status.ACTIVE
        });
        _projects[projectId] = p;
        _history[projectId][1] = p;
        emit ResearchProjectRegistered(
            projectId, msg.sender, researchDomain, 1, _commitment(projectId, p)
        );
    }

    /// @notice Publish a new immutable project-definition revision.
    function reviseProject(
        bytes32 projectId,
        uint64 expectedRevision,
        bytes32 researchDomain,
        bytes32 definitionCommitment
    ) external {
        Project storage p = _guardOwner(projectId, expectedRevision);
        if (researchDomain == bytes32(0) || definitionCommitment == bytes32(0))
            revert InvalidProject();

        uint64 previousRevision = p.revision;
        bytes32 predecessor = _commitment(projectId, p);
        p.researchDomain = researchDomain;
        p.definitionCommitment = definitionCommitment;
        p.predecessorCommitment = predecessor;
        p.updatedAt = uint64(block.timestamp);
        p.revision = previousRevision + 1;
        _history[projectId][p.revision] = p;

        emit ResearchProjectRevised(
            projectId, previousRevision, p.revision, _commitment(projectId, p)
        );
    }

    /// @notice Pause or resume admission of NEW scientific work against the current project.
    /// @dev Existing bound scientific work units retain their exact historical project commitment.
    function setNewWorkAcceptance(
        bytes32 projectId,
        uint64 expectedRevision,
        bool accepting
    ) external {
        Project storage p = _guardOwner(projectId, expectedRevision);
        if (p.acceptingNewWork == accepting) revert InvalidProject();

        bytes32 predecessor = _commitment(projectId, p);
        p.acceptingNewWork = accepting;
        p.predecessorCommitment = predecessor;
        p.updatedAt = uint64(block.timestamp);
        p.revision += 1;
        _history[projectId][p.revision] = p;

        emit ResearchProjectAcceptanceSet(
            projectId, accepting, p.revision, _commitment(projectId, p)
        );
    }

    /// @notice Permanently stop new project revisions/work admission.
    /// @dev Retirement is terminal and does not invalidate historic work-unit bindings.
    function retireProject(bytes32 projectId, uint64 expectedRevision) external {
        Project storage p = _guardOwner(projectId, expectedRevision);
        bytes32 predecessor = _commitment(projectId, p);
        p.acceptingNewWork = false;
        p.status = Status.RETIRED;
        p.predecessorCommitment = predecessor;
        p.updatedAt = uint64(block.timestamp);
        p.revision += 1;
        _history[projectId][p.revision] = p;

        emit ResearchProjectRetired(
            projectId, p.revision, _commitment(projectId, p)
        );
    }

    function project(bytes32 projectId) external view returns (Project memory) {
        Project memory p = _projects[projectId];
        if (p.status == Status.NONE) revert UnknownProject();
        return p;
    }

    function revision(bytes32 projectId, uint64 revision_) external view returns (Project memory) {
        Project memory p = _history[projectId][revision_];
        if (p.status == Status.NONE) revert UnknownProject();
        return p;
    }

    function commitment(bytes32 projectId, uint64 revision_) public view returns (bytes32) {
        Project memory p = _history[projectId][revision_];
        if (p.status == Status.NONE) revert UnknownProject();
        return _commitment(projectId, p);
    }

    function currentCommitment(bytes32 projectId) external view returns (bytes32) {
        Project memory p = _projects[projectId];
        if (p.status == Status.NONE) revert UnknownProject();
        return _commitment(projectId, p);
    }

    /// @notice New scientific work must bind the exact current active project revision.
    function isCurrentAcceptable(
        bytes32 projectId,
        uint64 revision_,
        bytes32 exactCommitment
    ) external view returns (bool) {
        Project memory p = _projects[projectId];
        if (
            p.status != Status.ACTIVE || !p.acceptingNewWork || p.revision != revision_
                || exactCommitment == bytes32(0)
        ) return false;
        return exactCommitment == _commitment(projectId, p);
    }

    function _guardOwner(bytes32 projectId, uint64 expectedRevision)
        private view returns (Project storage p)
    {
        p = _projects[projectId];
        if (p.status == Status.NONE) revert UnknownProject();
        if (p.status != Status.ACTIVE) revert WrongState();
        if (p.revision != expectedRevision) revert StaleRevision();
        if (msg.sender != p.owner) revert Unauthorized();
    }

    function _commitment(bytes32 projectId, Project memory p)
        private view returns (bytes32)
    {
        return keccak256(abi.encode(
            COMMITMENT_DOMAIN,
            block.chainid,
            address(this),
            projectId,
            p.owner,
            p.researchDomain,
            p.definitionCommitment,
            p.predecessorCommitment,
            p.revision,
            p.acceptingNewWork,
            p.status
        ));
    }
}

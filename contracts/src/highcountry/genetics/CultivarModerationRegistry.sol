// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import { IHighCountryAuthorization } from "../interfaces/IHighCountryAuthorization.sol";
import { AuthorizationRequest } from "../types/HighCountryTypes.sol";

/// @notice Auditable publication status for bred cultivars. Does not rewrite genome ancestry.
contract CultivarModerationRegistry {
    error InvalidRecord();
    error InvalidTransition();
    error Unauthorized();
    bytes32 public constant MODULE_ID = keccak256("HC.CULTIVAR_MODERATION.V1");
    bytes32 public constant SUBMIT = keccak256("HC.CULTIVAR.SUBMIT.V1");
    bytes32 public constant REVIEW = keccak256("HC.CULTIVAR.REVIEW.V1");
    bytes32 public constant APPEAL = keccak256("HC.CULTIVAR.APPEAL.V1");
    enum Status {
        NONE,
        PENDING,
        PUBLISHED,
        HIDDEN,
        RETIRED
    }

    struct Record {
        address breeder;
        bytes32 genomeId;
        bytes32 nameHash;
        bytes32 parentA;
        bytes32 parentB;
        Status status;
        uint64 revision;
        bool customName;
    }
    IHighCountryAuthorization public immutable authorization;
    mapping(bytes32 => Record) private records;
    mapping(bytes32 => bool) public blockedNameHash;
    event Proposed(bytes32 indexed cultivarId, bytes32 indexed genomeId, address indexed breeder, bool customName);
    event Reviewed(
        bytes32 indexed cultivarId, Status status, bytes32 indexed reasonHash, address reviewer, uint64 revision
    );
    event RenameRequested(bytes32 indexed cultivarId, bytes32 indexed nameHash, uint64 revision);

    constructor(
        address auth
    ) {
        if (auth.code.length == 0) revert InvalidRecord();
        authorization = IHighCountryAuthorization(auth);
    }

    function _auth(
        bytes32 action,
        bytes32 cultivarId
    ) private view {
        authorization.requireAuthorized(AuthorizationRequest(msg.sender, MODULE_ID, action, cultivarId, 0));
    }

    function propose(
        bytes32 id,
        bytes32 genome,
        bytes32 parentA,
        bytes32 parentB,
        bytes32 nameHash,
        bool customName
    ) external {
        if (
            id == 0 || genome == 0 || parentA == 0 || parentB == 0 || parentA == parentB || nameHash == 0
                || records[id].status != Status.NONE || blockedNameHash[nameHash]
        ) revert InvalidRecord();
        _auth(SUBMIT, id);
        records[id] = Record(msg.sender, genome, nameHash, parentA, parentB, Status.PENDING, 1, customName);
        emit Proposed(id, genome, msg.sender, customName);
    }

    function review(
        bytes32 id,
        bool publish,
        bool retire,
        bytes32 reasonHash
    ) external {
        Record storage r = records[id];
        if (r.status == Status.NONE || reasonHash == 0) revert InvalidRecord();
        _auth(REVIEW, id);
        if (publish) {
            if (r.status != Status.PENDING && r.status != Status.HIDDEN) revert InvalidTransition();
            r.status = Status.PUBLISHED;
        } else if (retire) {
            if (r.status == Status.RETIRED) revert InvalidTransition();
            r.status = Status.RETIRED;
            blockedNameHash[r.nameHash] = true;
        } else {
            if (r.status == Status.RETIRED || r.status == Status.HIDDEN) revert InvalidTransition();
            r.status = Status.HIDDEN;
            blockedNameHash[r.nameHash] = true;
        }
        r.revision++;
        emit Reviewed(id, r.status, reasonHash, msg.sender, r.revision);
    }

    function requestRename(
        bytes32 id,
        bytes32 newNameHash
    ) external {
        Record storage r = records[id];
        if (
            r.breeder != msg.sender || newNameHash == 0 || newNameHash == r.nameHash || blockedNameHash[newNameHash]
                || r.status == Status.NONE || r.status == Status.RETIRED
        ) revert InvalidTransition();
        _auth(APPEAL, id);
        r.nameHash = newNameHash;
        r.status = Status.PENDING;
        r.revision++;
        emit RenameRequested(id, newNameHash, r.revision);
    }

    function status(
        bytes32 id
    ) external view returns (Status) {
        return records[id].status;
    }

    function get(
        bytes32 id
    ) external view returns (Record memory) {
        return records[id];
    }

    function usable(
        bytes32 id
    ) external view returns (bool) {
        return records[id].status == Status.PUBLISHED;
    }
}

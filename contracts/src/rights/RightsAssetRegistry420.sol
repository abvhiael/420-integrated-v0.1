// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./RightsAuthorization420.sol";
import "./RightsIds420.sol";

contract RightsAssetRegistry420 is I420System {
    struct Subject {
        bytes32 subjectType;
        address controller;
        bytes32 metadataHash;
        bytes32 provenanceHash;
        uint32 revision;
        bool exists;
    }

    RightsAuthorization420 public immutable authorization;
    mapping(bytes32 => Subject) private _subjects;

    error InvalidSubject();
    error Unauthorized();
    error SubjectExists();
    error SubjectNotFound();

    event SubjectRegistered(bytes32 indexed subjectId, bytes32 indexed subjectType, address indexed controller, bytes32 metadataHash, bytes32 provenanceHash);
    event SubjectMetadataUpdated(bytes32 indexed subjectId, bytes32 metadataHash, uint32 revision);

    constructor(address authorization_) {
        require(authorization_ != address(0), "authorization");
        authorization = RightsAuthorization420(authorization_);
    }

    function systemName() external pure returns (string memory) { return "RightsAssetRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function registerSubject(bytes32 subjectId, bytes32 subjectType, address controller, bytes32 metadataHash, bytes32 provenanceHash) external {
        if (subjectId == bytes32(0) || subjectType == bytes32(0) || controller == address(0)) revert InvalidSubject();
        if (_subjects[subjectId].exists) revert SubjectExists();
        if (msg.sender != controller && !authorization.isSubjectAuthorized(msg.sender, subjectId, RightsIds420.ACTION_REGISTER_ASSET)) revert Unauthorized();
        _subjects[subjectId] = Subject(subjectType, controller, metadataHash, provenanceHash, 1, true);
        emit SubjectRegistered(subjectId, subjectType, controller, metadataHash, provenanceHash);
    }

    function updateMetadata(bytes32 subjectId, bytes32 metadataHash) external {
        Subject storage s = _subjects[subjectId];
        if (!s.exists) revert SubjectNotFound();
        if (msg.sender != s.controller && !authorization.isSubjectAuthorized(msg.sender, subjectId, RightsIds420.ACTION_UPDATE_ASSET)) revert Unauthorized();
        s.metadataHash = metadataHash;
        unchecked { ++s.revision; }
        emit SubjectMetadataUpdated(subjectId, metadataHash, s.revision);
    }

    function subject(bytes32 subjectId) external view returns (Subject memory s) {
        s = _subjects[subjectId];
        if (!s.exists) revert SubjectNotFound();
    }

    function exists(bytes32 subjectId) external view returns (bool) { return _subjects[subjectId].exists; }
}

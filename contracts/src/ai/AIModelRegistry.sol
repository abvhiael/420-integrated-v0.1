
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../system/SystemAccess.sol";
import "../interfaces/I420System.sol";

contract AIModelRegistry is SystemAccess, I420System {
    struct Model {
        bytes32 providerId;
        bytes32 artifactHash;
        bytes32 metadataHash;
        uint32 version;
        bool active;
    }
    mapping(bytes32 => Model) public models;
    event ModelRegistered(bytes32 indexed modelId, bytes32 indexed providerId, uint32 version);

    constructor(address timelock_) SystemAccess(timelock_) {}
    function systemName() external pure returns (string memory) { return "AIModelRegistry"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function register(
        bytes32 modelId, bytes32 providerId, bytes32 artifactHash, bytes32 metadataHash, uint32 version
    ) external onlyGovernance {
        require(modelId != bytes32(0) && models[modelId].version == 0, "invalid/exists");
        models[modelId] = Model(providerId, artifactHash, metadataHash, version, true);
        emit ModelRegistered(modelId, providerId, version);
    }
}

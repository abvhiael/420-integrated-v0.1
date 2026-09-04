// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../system/SystemAccess.sol";

contract LaunchpadProjectRegistry420 is I420System, SystemAccess {
    struct Project { address controller; address saleAsset; bytes32 metadataHash; bytes32 issuanceCommitment; bool active; bool exists; }
    mapping(bytes32 => Project) private _projects;
    error InvalidProject(); error ProjectExists(); error ProjectNotFound();
    event ProjectRegistered(bytes32 indexed projectId, address indexed controller, address indexed saleAsset, bytes32 metadataHash, bytes32 issuanceCommitment);
    constructor(address timelock_) SystemAccess(timelock_) {}
    function systemName() external pure returns (string memory) { return "LaunchpadProjectRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }
    function canonicalId(address controller, address saleAsset, bytes32 metadataHash, bytes32 issuanceCommitment) public pure returns (bytes32) { return keccak256(abi.encode(keccak256("420/LAUNCHPAD/PROJECT/V1"), controller, saleAsset, metadataHash, issuanceCommitment)); }
    function registerProject(bytes32 projectId, address controller, address saleAsset, bytes32 metadataHash, bytes32 issuanceCommitment) external onlyGovernance {
        if (controller == address(0) || saleAsset == address(0) || metadataHash == bytes32(0) || issuanceCommitment == bytes32(0) || projectId != canonicalId(controller, saleAsset, metadataHash, issuanceCommitment)) revert InvalidProject();
        if (_projects[projectId].exists) revert ProjectExists();
        _projects[projectId] = Project(controller, saleAsset, metadataHash, issuanceCommitment, true, true);
        emit ProjectRegistered(projectId, controller, saleAsset, metadataHash, issuanceCommitment);
    }
    function project(bytes32 projectId) external view returns (Project memory) { Project memory p = _projects[projectId]; if (!p.exists) revert ProjectNotFound(); return p; }
}

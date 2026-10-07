// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/creative/deployment/HzDeploymentGraph420.sol";

interface VmHzConsolidatedDeploy420 {
    function envAddress(
        string calldata name
    ) external returns (address);
    function startBroadcast() external;
    function stopBroadcast() external;
    function serializeAddress(
        string calldata objectKey,
        string calldata valueKey,
        address value
    ) external returns (string memory json);
    function serializeString(
        string calldata objectKey,
        string calldata valueKey,
        string calldata value
    ) external returns (string memory json);
    function serializeUint(
        string calldata objectKey,
        string calldata valueKey,
        uint256 value
    ) external returns (string memory json);
    function writeJson(
        string calldata json,
        string calldata path
    ) external;
}

/// @notice HZ-AUDIT-2 deploy phase for the complete HZ-1..HZ-4 constructor graph.
/// @dev This script intentionally does not impersonate GovernanceTimelock. Governance-only wiring,
///      submitter grants, STREAM schedules and external Registry publication are performed in later
///      governed phases described by the retained deployment package.
contract HzConsolidatedDeploy420 {
    VmHzConsolidatedDeploy420 private constant vm =
        VmHzConsolidatedDeploy420(address(uint160(uint256(keccak256("hevm cheat code")))));

    string public constant MANIFEST_PATH = "../artifacts/contracts/420hz-deployment.json";
    string public constant MANIFEST_SCHEMA = "420.hz.deployment.v1";

    function run() external returns (HzDeploymentGraph420.Deployment memory d) {
        address governanceTimelock = vm.envAddress("HZ_GOVERNANCE_TIMELOCK");
        address protocolTreasury = vm.envAddress("HZ_PROTOCOL_TREASURY");

        vm.startBroadcast();
        d = HzDeploymentGraph420.deploy(governanceTimelock, protocolTreasury);
        vm.stopBroadcast();

        _writeManifest(d, governanceTimelock, protocolTreasury);
    }

    function _writeManifest(
        HzDeploymentGraph420.Deployment memory d,
        address governanceTimelock,
        address protocolTreasury
    ) internal {
        string memory key = "hzDeployment";
        vm.serializeString(key, "schema", MANIFEST_SCHEMA);
        vm.serializeUint(key, "chainId", block.chainid);
        vm.serializeAddress(key, "governanceTimelock", governanceTimelock);
        vm.serializeAddress(key, "protocolTreasury", protocolTreasury);

        vm.serializeAddress(key, "creativeProtocolRegistry", address(d.creativeProtocolRegistry));
        vm.serializeAddress(key, "creatorProfileRegistry", address(d.creatorProfileRegistry));
        vm.serializeAddress(key, "workRegistry", address(d.workRegistry));
        vm.serializeAddress(key, "recordingRegistry", address(d.recordingRegistry));
        vm.serializeAddress(key, "contributorRegistry", address(d.contributorRegistry));
        vm.serializeAddress(key, "rightsRegistry", address(d.rightsRegistry));
        vm.serializeAddress(key, "authorizationRegistry", address(d.authorizationRegistry));
        vm.serializeAddress(key, "licenseRegistry", address(d.licenseRegistry));
        vm.serializeAddress(key, "royaltyScheduleRegistry", address(d.royaltyScheduleRegistry));
        vm.serializeAddress(key, "royaltyVault", address(d.royaltyVault));
        vm.serializeAddress(key, "royaltyRouter", address(d.royaltyRouter));
        vm.serializeAddress(key, "catalogRegistry", address(d.catalogRegistry));
        vm.serializeAddress(key, "catalogMetadataRegistry", address(d.catalogMetadataRegistry));
        vm.serializeAddress(key, "mediaManifestRegistry", address(d.mediaManifestRegistry));
        vm.serializeAddress(key, "storageSourceRegistry", address(d.storageSourceRegistry));
        vm.serializeAddress(key, "playbackResolver", address(d.playbackResolver));
        vm.serializeAddress(key, "playbackAccounting", address(d.playbackAccounting));
        vm.serializeAddress(key, "streamingSettlementEpoch", address(d.streamingSettlementEpoch));
        vm.serializeAddress(key, "streamingRevenueAllocator", address(d.streamingRevenueAllocator));
        string memory json =
            vm.serializeAddress(key, "streamingRoyaltySettlement", address(d.streamingRoyaltySettlement));
        vm.writeJson(json, MANIFEST_PATH);
    }
}

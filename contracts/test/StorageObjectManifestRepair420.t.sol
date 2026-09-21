// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./StorageObjectManifestRegistry420.t.sol";

contract StorageObjectManifestRepair420Test is StorageObjectManifestRegistry420Test {
    // Enter a fresh EVM call frame after vm.warp: the compiler must not reuse
    // the prior block.timestamp when calculating the replacement service window.
    function activateReplacementAfterWarp(Env memory e, uint256 nonce)
        external returns (bytes32 agreementId, uint64 startTime, uint64 endTime)
    {
        require(msg.sender == address(this), "test helper only");
        return activateAgreement(e, nonce);
    }

    function testLivePlacementCannotBeReplaced() public {
        Env memory e = setup();
        (bytes32 agreementId, uint64 startTime,) = activateAgreement(e, 101);
        bytes32 manifestId = registerManifest(e);
        bytes32 shardRoot = keccak256("repair-shard-root");
        vm.prank(CONSUMER);
        e.manifests.registerPlacement(manifestId, 0, agreementId, shardRoot, 1_048_576);
        vm.prank(CONSUMER);
        e.manifests.sealManifest(manifestId);
        vm.warp(startTime);
        vm.prank(CONSUMER);
        (bool ok,) = address(e.manifests).call(
            abi.encodeWithSelector(e.manifests.replacePlacement.selector, manifestId, uint32(0), keccak256("replacement"))
        );
        require(!ok, "live placement replaced");
    }

    function testPreStartPlacementCannotBeReplaced() public {
        Env memory e = setup();
        (bytes32 agreementId,,) = activateAgreement(e, 102);
        bytes32 manifestId = registerManifest(e);
        vm.prank(CONSUMER);
        e.manifests.registerPlacement(manifestId, 0, agreementId, keccak256("repair-shard-root"), 1_048_576);
        vm.prank(CONSUMER);
        e.manifests.sealManifest(manifestId);
        vm.prank(CONSUMER);
        (bool ok,) = address(e.manifests).call(
            abi.encodeWithSelector(e.manifests.replacePlacement.selector, manifestId, uint32(0), keccak256("replacement"))
        );
        require(!ok, "pre-start placement replaced");
    }

    function testExpiredPlacementRotatesBackingWithoutChangingContent() public {
        Env memory e = setup();
        (bytes32 oldAgreementId,, uint64 oldEndTime) = activateAgreement(e, 103);
        bytes32 manifestId = registerManifest(e);
        bytes32 shardRoot = keccak256("repair-shard-root");
        vm.prank(CONSUMER);
        bytes32 placementId = e.manifests.registerPlacement(manifestId, 0, oldAgreementId, shardRoot, 1_048_576);
        vm.prank(CONSUMER);
        e.manifests.sealManifest(manifestId);
        StorageObjectManifestRegistry420.Placement memory beforePlacement = e.manifests.getPlacement(placementId);
        vm.warp(uint256(oldEndTime) + 1);
        (bytes32 newAgreementId, uint64 newStartTime,) = this.activateReplacementAfterWarp(e, 104);
        vm.prank(CONSUMER);
        bytes32 returnedPlacementId = e.manifests.replacePlacement(manifestId, 0, newAgreementId);
        StorageObjectManifestRegistry420.Placement memory afterPlacement = e.manifests.getPlacement(placementId);
        StorageAgreementRegistry420.Agreement memory newAgreement = e.agreements.getAgreement(newAgreementId);
        require(returnedPlacementId == placementId, "placement id changed");
        require(afterPlacement.manifestId == beforePlacement.manifestId, "manifest changed");
        require(afterPlacement.shardIndex == beforePlacement.shardIndex, "index changed");
        require(afterPlacement.shardRoot == beforePlacement.shardRoot, "root changed");
        require(afterPlacement.shardSizeBytes == beforePlacement.shardSizeBytes, "size changed");
        require(afterPlacement.agreementId == newAgreementId, "agreement not rotated");
        require(afterPlacement.commitmentId == newAgreement.commitmentId, "commitment not rotated");
        require(!e.manifests.isRetrievable(manifestId), "retrievable before replacement start");
        vm.warp(newStartTime);
        require(e.manifests.isRetrievable(manifestId), "replacement not retrievable");
    }

    function testForeignControllerCannotReplaceExpiredPlacement() public {
        Env memory e = setup();
        (bytes32 oldAgreementId,, uint64 oldEndTime) = activateAgreement(e, 105);
        bytes32 manifestId = registerManifest(e);
        vm.prank(CONSUMER);
        e.manifests.registerPlacement(manifestId, 0, oldAgreementId, keccak256("repair-shard-root"), 1_048_576);
        vm.prank(CONSUMER);
        e.manifests.sealManifest(manifestId);
        vm.warp(uint256(oldEndTime) + 1);
        (bytes32 newAgreementId,,) = this.activateReplacementAfterWarp(e, 106);
        vm.prank(PROVIDER);
        (bool ok,) = address(e.manifests).call(
            abi.encodeWithSelector(e.manifests.replacePlacement.selector, manifestId, uint32(0), newAgreementId)
        );
        require(!ok, "foreign replacement accepted");
    }
}

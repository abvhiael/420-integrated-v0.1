// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/ai/AIModelRegistry.sol";

interface VmModelRegistryHardening420 {
    function prank(address) external;
    function warp(uint256) external;
    function expectRevert(bytes4) external;
}

contract AIModelRegistryHardening420Test {
    VmModelRegistryHardening420 constant vm =
        VmModelRegistryHardening420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant CREATOR = address(0xC0FFEE);
    address constant CONTROLLER = address(0xCAFE);
    address constant NEXT_CONTROLLER = address(0xBEEF);
    address constant GRANTEE = address(0xA11CE);
    address constant OTHER = address(0xB0B);

    bytes32 constant MODEL_ID = keccak256("hardening/model");
    bytes32 constant VERSION_ID = keccak256("hardening/model/v1");
    bytes32 constant OTHER_VERSION_ID = keccak256("hardening/model/v2");
    bytes32 constant SCOPE = keccak256("fine-tune/customer-a/dataset-1");
    bytes32 constant OTHER_SCOPE = keccak256("distill/customer-a/dataset-1");

    function _registry() private returns (AIModelRegistry registry) {
        registry = new AIModelRegistry(address(this));
        vm.prank(CREATOR);
        registry.registerModel(MODEL_ID, keccak256("family-meta"), keccak256("ordinary-license"));
    }

    function _registration(bytes32 versionId, uint32 version)
        private
        pure
        returns (AIModelRegistry.Model420Registration memory r)
    {
        r = AIModelRegistry.Model420Registration({
            modelVersionId: versionId,
            modelId: MODEL_ID,
            version: version,
            storageManifestHash: keccak256(abi.encode("manifest", version)),
            weightsHash: keccak256(abi.encode("weights", version)),
            runtimeProfileId: keccak256("runtime"),
            computeRequirementId: keccak256("compute"),
            schemaHash: keccak256("schema"),
            verificationProfileId: keccak256("verify"),
            licensePolicyId: keccak256("permissive-use-license"),
            architectureHash: keccak256("architecture"),
            capabilitiesHash: keccak256("capabilities"),
            aiDisclosureHash: keccak256("ai-disclosure"),
            trainingRightsDeclarationHash: keccak256("training-rights-declaration"),
            trainingRightsController: CONTROLLER,
            trainingRightsMode: AIModelRegistry.TrainingRightsMode.GRANT_ONLY
        });
    }

    function _registerGrantable(AIModelRegistry registry, bytes32 versionId, uint32 version) private {
        AIModelRegistry.Model420Registration memory r = _registration(versionId, version);
        vm.prank(CREATOR);
        registry.registerModel420Version(r);
    }

    function testOrdinaryLicenseAndCreatorAuthorityCannotGrantTraining() public {
        AIModelRegistry registry = _registry();
        _registerGrantable(registry, VERSION_ID, 1);

        require(!registry.isTrainingAuthorized(VERSION_ID, GRANTEE, SCOPE), "default must deny");

        vm.prank(CREATOR);
        registry.updateModel(MODEL_ID, keccak256("updated-meta"), keccak256("maximally-permissive-license"));
        require(!registry.isTrainingAuthorized(VERSION_ID, GRANTEE, SCOPE), "license must not grant training");

        vm.prank(CREATOR);
        vm.expectRevert(AIModelRegistry.NotTrainingRightsController.selector);
        registry.grantTraining(VERSION_ID, GRANTEE, SCOPE, 0);

        vm.expectRevert(AIModelRegistry.NotTrainingRightsController.selector);
        registry.grantTraining(VERSION_ID, GRANTEE, SCOPE, 0);
    }

    function testGrantIsBoundToVersionGranteeAndScope() public {
        AIModelRegistry registry = _registry();
        _registerGrantable(registry, VERSION_ID, 1);
        _registerGrantable(registry, OTHER_VERSION_ID, 2);

        vm.prank(CONTROLLER);
        registry.grantTraining(VERSION_ID, GRANTEE, SCOPE, 0);

        require(registry.isTrainingAuthorized(VERSION_ID, GRANTEE, SCOPE), "exact grant authorized");
        require(!registry.isTrainingAuthorized(VERSION_ID, OTHER, SCOPE), "wrong grantee denied");
        require(!registry.isTrainingAuthorized(VERSION_ID, GRANTEE, OTHER_SCOPE), "wrong scope denied");
        require(!registry.isTrainingAuthorized(OTHER_VERSION_ID, GRANTEE, SCOPE), "wrong version denied");
    }

    function testExpiredAndRevokedGrantsFailClosed() public {
        AIModelRegistry registry = _registry();
        _registerGrantable(registry, VERSION_ID, 1);

        uint64 expiry = uint64(block.timestamp + 100);
        vm.prank(CONTROLLER);
        bytes32 grantId = registry.grantTraining(VERSION_ID, GRANTEE, SCOPE, expiry);
        require(registry.isTrainingAuthorized(VERSION_ID, GRANTEE, SCOPE), "active grant authorized");

        vm.warp(expiry + 1);
        require(!registry.isTrainingAuthorized(VERSION_ID, GRANTEE, SCOPE), "expired grant denied");

        vm.prank(CONTROLLER);
        registry.revokeTrainingGrant(grantId);
        require(!registry.isTrainingAuthorized(VERSION_ID, GRANTEE, SCOPE), "revoked grant denied");
    }

    function testWrongControllerCannotTransferGrantOrRevoke() public {
        AIModelRegistry registry = _registry();
        _registerGrantable(registry, VERSION_ID, 1);

        vm.prank(CONTROLLER);
        bytes32 grantId = registry.grantTraining(VERSION_ID, GRANTEE, SCOPE, 0);

        vm.prank(OTHER);
        vm.expectRevert(AIModelRegistry.NotTrainingRightsController.selector);
        registry.transferTrainingRightsController(VERSION_ID, NEXT_CONTROLLER);

        vm.prank(OTHER);
        vm.expectRevert(AIModelRegistry.NotTrainingRightsController.selector);
        registry.revokeTrainingGrant(grantId);

        vm.prank(CONTROLLER);
        registry.transferTrainingRightsController(VERSION_ID, NEXT_CONTROLLER);

        vm.prank(CONTROLLER);
        vm.expectRevert(AIModelRegistry.NotTrainingRightsController.selector);
        registry.revokeTrainingGrant(grantId);

        vm.prank(NEXT_CONTROLLER);
        registry.revokeTrainingGrant(grantId);
        require(!registry.isTrainingAuthorized(VERSION_ID, GRANTEE, SCOPE), "new controller revokes");
    }

    function testModelAndVersionLifecycleImmediatelyInvalidateTraining() public {
        AIModelRegistry registry = _registry();
        _registerGrantable(registry, VERSION_ID, 1);
        _registerGrantable(registry, OTHER_VERSION_ID, 2);

        vm.prank(CONTROLLER);
        registry.grantTraining(VERSION_ID, GRANTEE, SCOPE, 0);
        vm.prank(CONTROLLER);
        registry.grantTraining(OTHER_VERSION_ID, GRANTEE, SCOPE, 0);

        vm.prank(CREATOR);
        registry.deprecateVersion(VERSION_ID);
        require(!registry.isTrainingAuthorized(VERSION_ID, GRANTEE, SCOPE), "deprecated version denied");
        require(registry.isTrainingAuthorized(OTHER_VERSION_ID, GRANTEE, SCOPE), "other version remains active");

        registry.suspendModel(MODEL_ID);
        require(!registry.isTrainingAuthorized(OTHER_VERSION_ID, GRANTEE, SCOPE), "suspended model denied");
        registry.reactivateModel(MODEL_ID);
        require(registry.isTrainingAuthorized(OTHER_VERSION_ID, GRANTEE, SCOPE), "reactivated model restores grant");

        vm.prank(CREATOR);
        registry.retireModel(MODEL_ID);
        require(!registry.isTrainingAuthorized(OTHER_VERSION_ID, GRANTEE, SCOPE), "retired model denied");
    }

    function testRevokedGrantCannotSilentlyRegainAuthorizationWithoutNewState() public {
        AIModelRegistry registry = _registry();
        _registerGrantable(registry, VERSION_ID, 1);

        vm.prank(CONTROLLER);
        bytes32 grantId = registry.grantTraining(VERSION_ID, GRANTEE, SCOPE, 0);
        vm.prank(CONTROLLER);
        registry.revokeTrainingGrant(grantId);
        require(!registry.isTrainingAuthorized(VERSION_ID, GRANTEE, SCOPE), "revocation fail closed");

        // This test intentionally captures the hardening requirement that one deterministic
        // authorization identity must not be overwritten after revocation.
        vm.prank(CONTROLLER);
        vm.expectRevert(AIModelRegistry.AlreadyExists.selector);
        registry.grantTraining(VERSION_ID, GRANTEE, SCOPE, 0);
    }
}

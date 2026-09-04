// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/ai/AIModelRegistry.sol";

interface VmModelRights420 {
    function prank(address) external;
    function warp(uint256) external;
    function expectRevert(bytes4) external;
}

contract AIModelTrainingRights420Test {
    VmModelRights420 constant vm = VmModelRights420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant ALICE = address(0xA11CE);
    address constant BOB = address(0xB0B);
    address constant RIGHTS = address(0xA17E5);
    address constant RIGHTS_2 = address(0xA17E6);

    bytes32 constant MODEL_ID = keccak256("ai/model/rights-example");
    bytes32 constant VERSION_ID = keccak256("ai/model/rights-example/v1");
    bytes32 constant LEGACY_VERSION_ID = keccak256("ai/model/rights-example/v2");
    bytes32 constant SCOPE = keccak256("training/scope/fine-tune/text");

    function _registry() private returns (AIModelRegistry registry) {
        registry = new AIModelRegistry(address(this));
        vm.prank(ALICE);
        registry.registerModel(MODEL_ID, keccak256("family-meta"), keccak256("ordinary-license"));
    }

    function _registerGrantOnly(AIModelRegistry registry) private {
        AIModelRegistry.Model420Registration memory r = AIModelRegistry.Model420Registration({
            modelVersionId: VERSION_ID,
            modelId: MODEL_ID,
            version: 1,
            storageManifestHash: keccak256("storage-manifest"),
            weightsHash: keccak256("weights"),
            runtimeProfileId: keccak256("runtime"),
            computeRequirementId: keccak256("compute"),
            schemaHash: keccak256("schema"),
            verificationProfileId: keccak256("verification"),
            licensePolicyId: keccak256("ordinary-license"),
            architectureHash: keccak256("transformer-architecture"),
            capabilitiesHash: keccak256("capabilities"),
            aiDisclosureHash: keccak256("ai-disclosure"),
            trainingRightsDeclarationHash: keccak256("training-rights-declaration"),
            trainingRightsController: RIGHTS,
            trainingRightsMode: AIModelRegistry.TrainingRightsMode.GRANT_ONLY
        });
        vm.prank(ALICE);
        registry.registerModel420Version(r);
    }

    function testTrainingPermissionDefaultsDeniedAndOrdinaryLicenseCannotGrantIt() public {
        AIModelRegistry registry = _registry();

        vm.prank(ALICE);
        registry.registerVersion(
            LEGACY_VERSION_ID,
            MODEL_ID,
            2,
            keccak256("manifest-v2"),
            keccak256("weights-v2"),
            bytes32(0),
            bytes32(0),
            bytes32(0),
            bytes32(0),
            keccak256("permissive-ordinary-license")
        );

        require(!registry.isTrainingAuthorized(LEGACY_VERSION_ID, BOB, SCOPE), "legacy registration must deny training");

        vm.prank(ALICE);
        registry.updateModel(MODEL_ID, keccak256("family-meta-2"), keccak256("even-more-permissive-license"));
        require(!registry.isTrainingAuthorized(LEGACY_VERSION_ID, BOB, SCOPE), "license update must not grant training");

        vm.prank(ALICE);
        vm.expectRevert(AIModelRegistry.TrainingRightsDenied.selector);
        registry.grantTraining(LEGACY_VERSION_ID, BOB, SCOPE, 0);
    }

    function testGrantOnlyRequiresExplicitScopedGrantAndSupportsRevocation() public {
        AIModelRegistry registry = _registry();
        _registerGrantOnly(registry);

        require(!registry.isTrainingAuthorized(VERSION_ID, BOB, SCOPE), "declaration alone must not authorize training");

        vm.prank(RIGHTS);
        bytes32 grantId = registry.grantTraining(VERSION_ID, BOB, SCOPE, 0);
        require(registry.isTrainingAuthorized(VERSION_ID, BOB, SCOPE), "explicit grant should authorize scope");
        require(!registry.isTrainingAuthorized(VERSION_ID, ALICE, SCOPE), "grant must not transfer to creator");
        require(!registry.isTrainingAuthorized(VERSION_ID, BOB, keccak256("other-scope")), "grant must be scope bound");

        vm.prank(RIGHTS);
        registry.revokeTrainingGrant(grantId);
        require(!registry.isTrainingAuthorized(VERSION_ID, BOB, SCOPE), "revocation must fail closed");
    }

    function testTrainingGrantExpiryFailsClosedAtBoundary() public {
        AIModelRegistry registry = _registry();
        _registerGrantOnly(registry);

        uint64 expiry = uint64(block.timestamp + 100);
        vm.prank(RIGHTS);
        registry.grantTraining(VERSION_ID, BOB, SCOPE, expiry);
        require(registry.isTrainingAuthorized(VERSION_ID, BOB, SCOPE), "active grant");

        vm.warp(expiry);
        require(!registry.isTrainingAuthorized(VERSION_ID, BOB, SCOPE), "expiry boundary must deny");
    }

    function testTrainingRightsControllerIsIndependentFromCreatorAndLicenseAuthority() public {
        AIModelRegistry registry = _registry();
        _registerGrantOnly(registry);

        vm.prank(ALICE);
        vm.expectRevert(AIModelRegistry.NotTrainingRightsController.selector);
        registry.grantTraining(VERSION_ID, BOB, SCOPE, 0);

        vm.prank(RIGHTS);
        registry.transferTrainingRightsController(VERSION_ID, RIGHTS_2);

        vm.prank(RIGHTS);
        vm.expectRevert(AIModelRegistry.NotTrainingRightsController.selector);
        registry.grantTraining(VERSION_ID, BOB, SCOPE, 0);

        vm.prank(RIGHTS_2);
        registry.grantTraining(VERSION_ID, BOB, SCOPE, 0);
        require(registry.isTrainingAuthorized(VERSION_ID, BOB, SCOPE), "new rights controller should authorize");
    }

    function testModel420ViewExposesPermanentIdentityAndDisclosure() public {
        AIModelRegistry registry = _registry();
        _registerGrantOnly(registry);

        (
            bytes32 modelId,
            address creator,
            bytes32 architectureHash,
            uint32 version,
            bytes32 weightsHash,
            bytes32 licensePolicyId,
            bytes32 storageManifestHash,
            bytes32 capabilitiesHash,
            bytes32 aiDisclosureHash,
            bytes32 trainingDeclarationHash,
            AIModelRegistry.TrainingRightsMode mode,
            address rightsController,
            AIModelRegistry.VersionState state,
            bool exists
        ) = registry.model420(VERSION_ID);

        require(modelId == MODEL_ID, "model id");
        require(creator == ALICE, "creator");
        require(architectureHash == keccak256("transformer-architecture"), "architecture");
        require(version == 1, "version");
        require(weightsHash == keccak256("weights"), "weights");
        require(licensePolicyId == keccak256("ordinary-license"), "license");
        require(storageManifestHash == keccak256("storage-manifest"), "storage manifest");
        require(capabilitiesHash == keccak256("capabilities"), "capabilities");
        require(aiDisclosureHash == keccak256("ai-disclosure"), "disclosure");
        require(trainingDeclarationHash == keccak256("training-rights-declaration"), "training declaration");
        require(mode == AIModelRegistry.TrainingRightsMode.GRANT_ONLY, "training mode");
        require(rightsController == RIGHTS, "rights controller");
        require(state == AIModelRegistry.VersionState.ACTIVE, "state");
        require(exists, "exists");
    }
}

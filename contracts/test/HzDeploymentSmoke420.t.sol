// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/creative/deployment/HzDeploymentGraph420.sol";
import "../src/creative/deployment/HzRegistryAuthorityPlan420.sol";
import "../src/creative/economics/HzStreamEconomicsPlan420.sol";
import "../src/apps/ProtocolRegistry.sol";
import "../src/interfaces/genesis/Types420.sol";

contract HzDeploymentSmoke420Test {
    address private constant TREASURY = address(0x4200);
    address private constant PLAYBACK_SUBMITTER = address(0xBEEF);
    address private constant SETTLEMENT_SUBMITTER = address(0xCAFE);

    function testDeploymentSmokeMaterializesInitializedHzGraph() public {
        HzDeploymentGraph420.Deployment memory d = HzDeploymentGraph420.deploy(address(this), TREASURY);
        ProtocolRegistry registry = new ProtocolRegistry(address(this));

        _wireGovernance(d);
        _registerModules(d);
        _registerStreamEconomics(d);
        _publishExternalRegistry(d, registry);

        _assertCodeMaterialized(d);
        _assertInitializedState(d, registry);

        CreatorId creatorId =
            d.creatorProfileRegistry.createProfile(IdentityType.ARTIST_PROJECT, keccak256("hz-audit-5/creator"));

        WorkId workId = d.workRegistry
            .registerWork(
                creatorId,
                WorkId.wrap(0),
                keccak256("hz-audit-5/composition"),
                keccak256("hz-audit-5/work-metadata"),
                keccak256("hz-audit-5/work-provenance"),
                ProvenanceClass.NATIVE_VERIFIED,
                RightsStatus.RIGHTS_VERIFIED
            );
        _finalizeSingleHolderSplit(d, CreativeAssetType.WORK, WorkId.unwrap(workId), creatorId);
        d.workRegistry.activateWork(workId);

        RecordingId recordingId = d.recordingRegistry
            .registerRecording(
                RecordingRegistration420({
                    registrantProfileId: creatorId,
                    workId: workId,
                    parentRecordingId: RecordingId.wrap(0),
                    supersedesRecordingId: RecordingId.wrap(0),
                    recordingClass: RecordingClass.ORIGINAL,
                    masterHash: keccak256("hz-audit-5/original-master"),
                    metadataHash: keccak256("hz-audit-5/original-metadata"),
                    provenanceHash: keccak256("hz-audit-5/original-provenance"),
                    mediaManifestHash: keccak256("hz-audit-5/media-manifest"),
                    authorizationManifestHash: bytes32(0),
                    provenanceClass: ProvenanceClass.NATIVE_VERIFIED,
                    rightsStatus: RightsStatus.RIGHTS_VERIFIED,
                    royaltyScheduleVersion: 1,
                    authorizationPolicyVersion: 1
                })
            );
        _finalizeSingleHolderSplit(d, CreativeAssetType.RECORDING, RecordingId.unwrap(recordingId), creatorId);
        d.recordingRegistry.activateRecording(recordingId, LicenseId.wrap(0));

        require(d.workRegistry.statusOf(workId) == AssetStatus.ACTIVE, "smoke/work-not-active");
        require(d.recordingRegistry.statusOf(recordingId) == AssetStatus.ACTIVE, "smoke/recording-not-active");

        (WorkId routedWork, RecordingId parent, RecordingClass class_, uint32 scheduleVersion) =
            d.recordingRegistry.royaltyContext(recordingId);
        require(WorkId.unwrap(routedWork) == WorkId.unwrap(workId), "smoke/royalty-work");
        require(RecordingId.unwrap(parent) == 0, "smoke/original-parent");
        require(class_ == RecordingClass.ORIGINAL, "smoke/recording-class");
        require(scheduleVersion == 1, "smoke/schedule-version");

        RoyaltySchedule420 memory streamV1 =
            d.royaltyScheduleRegistry.schedule(RecordingClass.ORIGINAL, RevenueType.STREAM, 1);
        require(streamV1.termsHash == HzStreamEconomicsPlan420.originalSchedule().termsHash, "smoke/stream-terms");
    }

    function testDeploymentSmokeFailsClosedBeforeRequiredInitialization() public {
        HzDeploymentGraph420.Deployment memory d = HzDeploymentGraph420.deploy(address(this), TREASURY);

        CreatorId creatorId =
            d.creatorProfileRegistry.createProfile(IdentityType.ARTIST_PROJECT, keccak256("hz-audit-5/uninitialized"));

        WorkId workId = d.workRegistry
            .registerWork(
                creatorId,
                WorkId.wrap(0),
                keccak256("hz-audit-5/uninitialized-composition"),
                bytes32(0),
                keccak256("hz-audit-5/uninitialized-provenance"),
                ProvenanceClass.NATIVE_VERIFIED,
                RightsStatus.RIGHTS_VERIFIED
            );

        (bool activationOk,) = address(d.workRegistry).call(abi.encodeCall(WorkRegistry420.activateWork, (workId)));
        require(!activationOk, "smoke/unwired-work-activated");

        (bool streamScheduleOk,) = address(d.royaltyScheduleRegistry)
            .call(
                abi.encodeCall(
                    RoyaltyScheduleRegistry420.schedule, (RecordingClass.ORIGINAL, RevenueType.STREAM, uint32(1))
                )
            );
        require(!streamScheduleOk, "smoke/uninitialized-stream-schedule");
    }

    function _wireGovernance(
        HzDeploymentGraph420.Deployment memory d
    ) private {
        d.workRegistry.setRightsRegistry(address(d.rightsRegistry));
        d.recordingRegistry.configureDependencies(address(d.rightsRegistry), address(d.authorizationRegistry));
        d.rightsRegistry.setRoyaltyAccounting(address(d.royaltyVault));
        d.authorizationRegistry.setLicenseRegistry(address(d.licenseRegistry));
        d.licenseRegistry.setRoyaltyRouter(address(d.royaltyRouter));
        d.royaltyVault.setRoyaltyRouter(address(d.royaltyRouter));
        d.royaltyRouter.setSettlementSource(address(d.licenseRegistry), true);
        d.royaltyRouter.setSettlementSource(address(d.streamingRoyaltySettlement), true);
        d.playbackAccounting.setSubmitter(PLAYBACK_SUBMITTER, true);
        d.streamingSettlementEpoch.setSubmitter(SETTLEMENT_SUBMITTER, true);
    }

    function _registerStreamEconomics(
        HzDeploymentGraph420.Deployment memory d
    ) private {
        d.royaltyScheduleRegistry
            .registerSchedule(RecordingClass.ORIGINAL, RevenueType.STREAM, HzStreamEconomicsPlan420.originalSchedule());
        d.royaltyScheduleRegistry
            .registerSchedule(RecordingClass.REMIX, RevenueType.STREAM, HzStreamEconomicsPlan420.remixSchedule());
    }

    function _registerModules(
        HzDeploymentGraph420.Deployment memory d
    ) private {
        bytes32 manifest = HzRegistryAuthorityPlan420.moduleManifestHash();
        _register(
            d.creativeProtocolRegistry, "CREATIVE_PROTOCOL_REGISTRY", address(d.creativeProtocolRegistry), manifest
        );
        _register(d.creativeProtocolRegistry, "CREATOR_PROFILE_REGISTRY", address(d.creatorProfileRegistry), manifest);
        _register(d.creativeProtocolRegistry, "WORK_REGISTRY", address(d.workRegistry), manifest);
        _register(d.creativeProtocolRegistry, "RECORDING_REGISTRY", address(d.recordingRegistry), manifest);
        _register(d.creativeProtocolRegistry, "CONTRIBUTOR_REGISTRY", address(d.contributorRegistry), manifest);
        _register(d.creativeProtocolRegistry, "RIGHTS_REGISTRY", address(d.rightsRegistry), manifest);
        _register(d.creativeProtocolRegistry, "AUTHORIZATION_REGISTRY", address(d.authorizationRegistry), manifest);
        _register(d.creativeProtocolRegistry, "LICENSE_REGISTRY", address(d.licenseRegistry), manifest);
        _register(d.creativeProtocolRegistry, "ROYALTY_SCHEDULE_REGISTRY", address(d.royaltyScheduleRegistry), manifest);
        _register(d.creativeProtocolRegistry, "ROYALTY_VAULT", address(d.royaltyVault), manifest);
        _register(d.creativeProtocolRegistry, "ROYALTY_ROUTER", address(d.royaltyRouter), manifest);
        _register(d.creativeProtocolRegistry, "CATALOG_REGISTRY", address(d.catalogRegistry), manifest);
        _register(d.creativeProtocolRegistry, "CATALOG_METADATA_REGISTRY", address(d.catalogMetadataRegistry), manifest);
        _register(d.creativeProtocolRegistry, "MEDIA_MANIFEST_REGISTRY", address(d.mediaManifestRegistry), manifest);
        _register(d.creativeProtocolRegistry, "STORAGE_SOURCE_REGISTRY", address(d.storageSourceRegistry), manifest);
        _register(d.creativeProtocolRegistry, "PLAYBACK_RESOLVER", address(d.playbackResolver), manifest);
        _register(d.creativeProtocolRegistry, "PLAYBACK_ACCOUNTING", address(d.playbackAccounting), manifest);
        _register(
            d.creativeProtocolRegistry, "STREAMING_SETTLEMENT_EPOCH", address(d.streamingSettlementEpoch), manifest
        );
        _register(
            d.creativeProtocolRegistry, "STREAMING_REVENUE_ALLOCATOR", address(d.streamingRevenueAllocator), manifest
        );
        _register(
            d.creativeProtocolRegistry, "STREAMING_ROYALTY_SETTLEMENT", address(d.streamingRoyaltySettlement), manifest
        );
    }

    function _register(
        CreativeProtocolRegistry420 protocol,
        string memory label,
        address implementation,
        bytes32 manifest
    ) private {
        protocol.registerModule(keccak256(bytes(label)), implementation, 1, manifest);
    }

    function _publishExternalRegistry(
        HzDeploymentGraph420.Deployment memory d,
        ProtocolRegistry registry
    ) private {
        registry.registerComponent(
            HzRegistryAuthorityPlan420.componentId(),
            address(d.creativeProtocolRegistry),
            Types420.Version({ major: 1, minor: 0, patch: 0 }),
            Types420.Lifecycle.ACTIVE
        );
        registry.approveServiceId(
            HzRegistryAuthorityPlan420.serviceId(), HzRegistryAuthorityPlan420.serviceDescriptorHash()
        );
        registry.publishRegisteredService(
            HzRegistryAuthorityPlan420.serviceId(),
            address(d.creativeProtocolRegistry),
            HzRegistryAuthorityPlan420.metadataHash(),
            1,
            true,
            ProtocolRegistry.ComponentType.APPLICATION,
            HzRegistryAuthorityPlan420.registryManifestHash(),
            HzRegistryAuthorityPlan420.dependencyRoot(d),
            HzRegistryAuthorityPlan420.interfaceHash()
        );
    }

    function _finalizeSingleHolderSplit(
        HzDeploymentGraph420.Deployment memory d,
        CreativeAssetType assetType,
        uint256 assetId,
        CreatorId creatorId
    ) private {
        uint256[] memory holders = new uint256[](1);
        uint16[] memory shares = new uint16[](1);
        holders[0] = CreatorId.unwrap(creatorId);
        shares[0] = 10_000;
        d.rightsRegistry.proposeInitialSplit(assetType, assetId, holders, shares);
        d.rightsRegistry.acceptInitialShare(assetType, assetId);
        d.rightsRegistry.finalizeInitialSplit(assetType, assetId);
    }

    function _assertInitializedState(
        HzDeploymentGraph420.Deployment memory d,
        ProtocolRegistry registry
    ) private view {
        require(d.workRegistry.rightsRegistry() == address(d.rightsRegistry), "smoke/work-rights");
        require(d.recordingRegistry.rightsRegistry() == address(d.rightsRegistry), "smoke/recording-rights");
        require(
            d.recordingRegistry.authorizationRegistry() == address(d.authorizationRegistry),
            "smoke/recording-authorization"
        );
        require(d.rightsRegistry.royaltyAccounting() == address(d.royaltyVault), "smoke/rights-accounting");
        require(d.authorizationRegistry.licenseRegistry() == address(d.licenseRegistry), "smoke/auth-license");
        require(d.licenseRegistry.royaltyRouter() == address(d.royaltyRouter), "smoke/license-router");
        require(d.royaltyVault.royaltyRouter() == address(d.royaltyRouter), "smoke/vault-router");
        require(d.royaltyRouter.settlementSource(address(d.licenseRegistry)), "smoke/license-source");
        require(d.royaltyRouter.settlementSource(address(d.streamingRoyaltySettlement)), "smoke/stream-source");
        require(d.playbackAccounting.submitters(PLAYBACK_SUBMITTER), "smoke/playback-submitter");
        require(d.streamingSettlementEpoch.submitters(SETTLEMENT_SUBMITTER), "smoke/settlement-submitter");

        (address resolved, uint32 version) = registry.resolveActive(HzRegistryAuthorityPlan420.serviceId());
        require(resolved == address(d.creativeProtocolRegistry), "smoke/service-root");
        require(version == 1, "smoke/service-version");

        RoyaltySchedule420 memory original =
            d.royaltyScheduleRegistry.schedule(RecordingClass.ORIGINAL, RevenueType.STREAM, 1);
        RoyaltySchedule420 memory remix =
            d.royaltyScheduleRegistry.schedule(RecordingClass.REMIX, RevenueType.STREAM, 1);
        require(original.termsHash == HzStreamEconomicsPlan420.originalSchedule().termsHash, "smoke/original-schedule");
        require(remix.termsHash == HzStreamEconomicsPlan420.remixSchedule().termsHash, "smoke/remix-schedule");
    }

    function _assertCodeMaterialized(
        HzDeploymentGraph420.Deployment memory d
    ) private view {
        require(address(d.creativeProtocolRegistry).code.length != 0, "smoke/code/protocol");
        require(address(d.creatorProfileRegistry).code.length != 0, "smoke/code/profiles");
        require(address(d.workRegistry).code.length != 0, "smoke/code/works");
        require(address(d.recordingRegistry).code.length != 0, "smoke/code/recordings");
        require(address(d.contributorRegistry).code.length != 0, "smoke/code/contributors");
        require(address(d.rightsRegistry).code.length != 0, "smoke/code/rights");
        require(address(d.authorizationRegistry).code.length != 0, "smoke/code/authorization");
        require(address(d.licenseRegistry).code.length != 0, "smoke/code/licenses");
        require(address(d.royaltyScheduleRegistry).code.length != 0, "smoke/code/schedules");
        require(address(d.royaltyVault).code.length != 0, "smoke/code/vault");
        require(address(d.royaltyRouter).code.length != 0, "smoke/code/router");
        require(address(d.catalogRegistry).code.length != 0, "smoke/code/catalog");
        require(address(d.catalogMetadataRegistry).code.length != 0, "smoke/code/catalog-metadata");
        require(address(d.mediaManifestRegistry).code.length != 0, "smoke/code/media");
        require(address(d.storageSourceRegistry).code.length != 0, "smoke/code/storage");
        require(address(d.playbackResolver).code.length != 0, "smoke/code/resolver");
        require(address(d.playbackAccounting).code.length != 0, "smoke/code/playback");
        require(address(d.streamingSettlementEpoch).code.length != 0, "smoke/code/settlement");
        require(address(d.streamingRevenueAllocator).code.length != 0, "smoke/code/allocator");
        require(address(d.streamingRoyaltySettlement).code.length != 0, "smoke/code/royalty-settlement");
    }
}

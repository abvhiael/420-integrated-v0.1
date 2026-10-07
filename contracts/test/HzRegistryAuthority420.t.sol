// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/creative/deployment/HzDeploymentGraph420.sol";
import "../src/creative/deployment/HzRegistryAuthorityPlan420.sol";
import "../src/apps/ProtocolRegistry.sol";
import "../src/interfaces/genesis/Types420.sol";

interface VmHzAuthority420Test {
    function prank(
        address msgSender
    ) external;
}

contract HzRegistryAuthority420Test {
    VmHzAuthority420Test private constant vm =
        VmHzAuthority420Test(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant TREASURY = address(0x4200);
    address private constant PLAYBACK_SUBMITTER = address(0xBEEF);
    address private constant SETTLEMENT_SUBMITTER = address(0xCAFE);
    address private constant UNAUTHORIZED = address(0xBAD);

    function testAuthorityWiringAndRegistryPublication() public {
        HzDeploymentGraph420.Deployment memory d = HzDeploymentGraph420.deploy(address(this), TREASURY);
        ProtocolRegistry registry = new ProtocolRegistry(address(this));

        _wireGovernance(d);
        _registerModules(d);
        _publishExternalRegistry(d, registry);

        require(d.workRegistry.rightsRegistry() == address(d.rightsRegistry), "work/rights");
        require(d.recordingRegistry.rightsRegistry() == address(d.rightsRegistry), "recording/rights");
        require(
            d.recordingRegistry.authorizationRegistry() == address(d.authorizationRegistry), "recording/authorization"
        );
        require(d.rightsRegistry.royaltyAccounting() == address(d.royaltyVault), "rights/accounting");
        require(d.authorizationRegistry.licenseRegistry() == address(d.licenseRegistry), "authorization/license");
        require(d.licenseRegistry.royaltyRouter() == address(d.royaltyRouter), "license/router");
        require(d.royaltyVault.royaltyRouter() == address(d.royaltyRouter), "vault/router");
        require(d.royaltyRouter.settlementSource(address(d.licenseRegistry)), "license/source");
        require(d.royaltyRouter.settlementSource(address(d.streamingRoyaltySettlement)), "stream/source");
        require(d.playbackAccounting.submitters(PLAYBACK_SUBMITTER), "playback/submitter");
        require(d.streamingSettlementEpoch.submitters(SETTLEMENT_SUBMITTER), "settlement/submitter");

        _assertModules(d);

        bytes32 componentId = HzRegistryAuthorityPlan420.componentId();
        bytes32 serviceId = HzRegistryAuthorityPlan420.serviceId();

        Types420.ContractRef memory component = registry.component(componentId);
        require(component.implementation == address(d.creativeProtocolRegistry), "component/root");
        require(component.runtimeCodeHash == address(d.creativeProtocolRegistry).codehash, "component/codehash");
        require(
            component.version.major == 1 && component.version.minor == 0 && component.version.patch == 0,
            "component/version"
        );
        require(component.lifecycle == Types420.Lifecycle.ACTIVE, "component/lifecycle");
        require(registry.resolve(componentId) == address(d.creativeProtocolRegistry), "component/resolve");

        ProtocolRegistry.Service memory service = registry.getService(serviceId);
        require(service.implementation == address(d.creativeProtocolRegistry), "service/root");
        require(service.codeHash == address(d.creativeProtocolRegistry).codehash, "service/codehash");
        require(service.metadataHash == HzRegistryAuthorityPlan420.metadataHash(), "service/metadata");
        require(service.version == 1 && service.active, "service/version");
        (address resolved, uint32 version) = registry.resolveActive(serviceId);
        require(resolved == address(d.creativeProtocolRegistry) && version == 1, "service/resolve");

        ProtocolRegistry.RegistrationProfile memory profile = registry.getRegistrationProfile(serviceId, 1);
        require(profile.componentType == ProtocolRegistry.ComponentType.APPLICATION, "profile/type");
        require(profile.manifestHash == HzRegistryAuthorityPlan420.registryManifestHash(), "profile/manifest");
        require(profile.interfaceHash == HzRegistryAuthorityPlan420.interfaceHash(), "profile/interface");
        require(profile.dependencyRoot == HzRegistryAuthorityPlan420.dependencyRoot(d), "profile/dependencies");
    }

    function testGovernanceOnlyActionsFailClosedForUnauthorizedCallers() public {
        HzDeploymentGraph420.Deployment memory d = HzDeploymentGraph420.deploy(address(this), TREASURY);
        ProtocolRegistry registry = new ProtocolRegistry(address(this));

        vm.prank(UNAUTHORIZED);
        (bool submitterOk,) = address(d.playbackAccounting)
            .call(abi.encodeCall(PlaybackAccounting420.setSubmitter, (PLAYBACK_SUBMITTER, true)));
        require(!submitterOk, "unauthorized playback submitter");

        vm.prank(UNAUTHORIZED);
        (bool settlementOk,) = address(d.streamingSettlementEpoch)
            .call(abi.encodeCall(StreamingSettlementEpoch420.setSubmitter, (SETTLEMENT_SUBMITTER, true)));
        require(!settlementOk, "unauthorized settlement submitter");

        vm.prank(UNAUTHORIZED);
        (bool moduleOk,) = address(d.creativeProtocolRegistry)
            .call(
                abi.encodeCall(
                    CreativeProtocolRegistry420.registerModule,
                    (
                        keccak256("CREATIVE_PROTOCOL_REGISTRY"),
                        address(d.creativeProtocolRegistry),
                        uint32(1),
                        HzRegistryAuthorityPlan420.moduleManifestHash()
                    )
                )
            );
        require(!moduleOk, "unauthorized module registration");

        vm.prank(UNAUTHORIZED);
        (bool componentOk,) = address(registry)
            .call(
                abi.encodeCall(
                    ProtocolRegistry.registerComponent,
                    (
                        HzRegistryAuthorityPlan420.componentId(),
                        address(d.creativeProtocolRegistry),
                        Types420.Version({ major: 1, minor: 0, patch: 0 }),
                        Types420.Lifecycle.ACTIVE
                    )
                )
            );
        require(!componentOk, "unauthorized component registration");

        vm.prank(UNAUTHORIZED);
        (bool approvalOk,) = address(registry)
            .call(
                abi.encodeCall(
                    ProtocolRegistry.approveServiceId,
                    (HzRegistryAuthorityPlan420.serviceId(), HzRegistryAuthorityPlan420.serviceDescriptorHash())
                )
            );
        require(!approvalOk, "unauthorized service approval");
    }

    function testInvalidSubmittersAndUnapprovedServiceFailClosed() public {
        HzDeploymentGraph420.Deployment memory d = HzDeploymentGraph420.deploy(address(this), TREASURY);
        ProtocolRegistry registry = new ProtocolRegistry(address(this));

        (bool zeroPlayback,) =
            address(d.playbackAccounting).call(abi.encodeCall(PlaybackAccounting420.setSubmitter, (address(0), true)));
        require(!zeroPlayback, "zero playback submitter");

        (bool zeroSettlement,) = address(d.streamingSettlementEpoch)
            .call(abi.encodeCall(StreamingSettlementEpoch420.setSubmitter, (address(0), true)));
        require(!zeroSettlement, "zero settlement submitter");

        (bool unapproved,) = address(registry)
            .call(
                abi.encodeCall(
                    ProtocolRegistry.publishRegisteredService,
                    (
                        HzRegistryAuthorityPlan420.serviceId(),
                        address(d.creativeProtocolRegistry),
                        HzRegistryAuthorityPlan420.metadataHash(),
                        uint32(1),
                        true,
                        ProtocolRegistry.ComponentType.APPLICATION,
                        HzRegistryAuthorityPlan420.registryManifestHash(),
                        HzRegistryAuthorityPlan420.dependencyRoot(d),
                        HzRegistryAuthorityPlan420.interfaceHash()
                    )
                )
            );
        require(!unapproved, "unapproved extension service published");

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

        (bool replay,) = address(registry)
            .call(
                abi.encodeCall(
                    ProtocolRegistry.publishRegisteredService,
                    (
                        HzRegistryAuthorityPlan420.serviceId(),
                        address(d.creativeProtocolRegistry),
                        HzRegistryAuthorityPlan420.metadataHash(),
                        uint32(1),
                        true,
                        ProtocolRegistry.ComponentType.APPLICATION,
                        HzRegistryAuthorityPlan420.registryManifestHash(),
                        HzRegistryAuthorityPlan420.dependencyRoot(d),
                        HzRegistryAuthorityPlan420.interfaceHash()
                    )
                )
            );
        require(!replay, "service version replay accepted");
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

    function _assertModules(
        HzDeploymentGraph420.Deployment memory d
    ) private view {
        bytes32 manifest = HzRegistryAuthorityPlan420.moduleManifestHash();
        _assertModule(
            d.creativeProtocolRegistry, "CREATIVE_PROTOCOL_REGISTRY", address(d.creativeProtocolRegistry), manifest
        );
        _assertModule(
            d.creativeProtocolRegistry, "CREATOR_PROFILE_REGISTRY", address(d.creatorProfileRegistry), manifest
        );
        _assertModule(d.creativeProtocolRegistry, "WORK_REGISTRY", address(d.workRegistry), manifest);
        _assertModule(d.creativeProtocolRegistry, "RECORDING_REGISTRY", address(d.recordingRegistry), manifest);
        _assertModule(d.creativeProtocolRegistry, "CONTRIBUTOR_REGISTRY", address(d.contributorRegistry), manifest);
        _assertModule(d.creativeProtocolRegistry, "RIGHTS_REGISTRY", address(d.rightsRegistry), manifest);
        _assertModule(d.creativeProtocolRegistry, "AUTHORIZATION_REGISTRY", address(d.authorizationRegistry), manifest);
        _assertModule(d.creativeProtocolRegistry, "LICENSE_REGISTRY", address(d.licenseRegistry), manifest);
        _assertModule(
            d.creativeProtocolRegistry, "ROYALTY_SCHEDULE_REGISTRY", address(d.royaltyScheduleRegistry), manifest
        );
        _assertModule(d.creativeProtocolRegistry, "ROYALTY_VAULT", address(d.royaltyVault), manifest);
        _assertModule(d.creativeProtocolRegistry, "ROYALTY_ROUTER", address(d.royaltyRouter), manifest);
        _assertModule(d.creativeProtocolRegistry, "CATALOG_REGISTRY", address(d.catalogRegistry), manifest);
        _assertModule(
            d.creativeProtocolRegistry, "CATALOG_METADATA_REGISTRY", address(d.catalogMetadataRegistry), manifest
        );
        _assertModule(d.creativeProtocolRegistry, "MEDIA_MANIFEST_REGISTRY", address(d.mediaManifestRegistry), manifest);
        _assertModule(d.creativeProtocolRegistry, "STORAGE_SOURCE_REGISTRY", address(d.storageSourceRegistry), manifest);
        _assertModule(d.creativeProtocolRegistry, "PLAYBACK_RESOLVER", address(d.playbackResolver), manifest);
        _assertModule(d.creativeProtocolRegistry, "PLAYBACK_ACCOUNTING", address(d.playbackAccounting), manifest);
        _assertModule(
            d.creativeProtocolRegistry, "STREAMING_SETTLEMENT_EPOCH", address(d.streamingSettlementEpoch), manifest
        );
        _assertModule(
            d.creativeProtocolRegistry, "STREAMING_REVENUE_ALLOCATOR", address(d.streamingRevenueAllocator), manifest
        );
        _assertModule(
            d.creativeProtocolRegistry, "STREAMING_ROYALTY_SETTLEMENT", address(d.streamingRoyaltySettlement), manifest
        );
    }

    function _assertModule(
        CreativeProtocolRegistry420 protocol,
        string memory label,
        address implementation,
        bytes32 manifest
    ) private view {
        CreativeProtocolRegistry420.ModuleRef memory ref = protocol.module(keccak256(bytes(label)));
        require(ref.implementation == implementation, label);
        require(ref.version == 1, "module/version");
        require(ref.lifecycle == CreativeProtocolRegistry420.ModuleLifecycle.ACTIVE, "module/lifecycle");
        require(ref.manifestHash == manifest, "module/manifest");
    }
}

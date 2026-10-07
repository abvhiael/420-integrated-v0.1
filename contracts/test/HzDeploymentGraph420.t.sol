// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/creative/deployment/HzDeploymentGraph420.sol";

interface VmHzDeployment420Test {
    function prank(address msgSender) external;
}

contract HzDeploymentGraph420Test {
    VmHzDeployment420Test private constant vm =
        VmHzDeployment420Test(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant GOVERNANCE = address(0x0429);
    address private constant TREASURY = address(0x4200);
    address private constant PLAYBACK_SUBMITTER = address(0xBEEF);
    address private constant SETTLEMENT_SUBMITTER = address(0xCAFE);

    function testConsolidatedDeploymentBindsHz1ThroughHz4() public {
        HzDeploymentGraph420.Deployment memory d = HzDeploymentGraph420.deploy(GOVERNANCE, TREASURY);

        require(d.creativeProtocolRegistry.governanceTimelock() == GOVERNANCE, "protocol/governance");
        require(d.creatorProfileRegistry.governanceTimelock() == GOVERNANCE, "profiles/governance");
        require(d.workRegistry.governanceTimelock() == GOVERNANCE, "works/governance");
        require(d.recordingRegistry.governanceTimelock() == GOVERNANCE, "recordings/governance");
        require(d.rightsRegistry.governanceTimelock() == GOVERNANCE, "rights/governance");
        require(d.authorizationRegistry.governanceTimelock() == GOVERNANCE, "authorization/governance");
        require(d.licenseRegistry.governanceTimelock() == GOVERNANCE, "licenses/governance");
        require(d.royaltyScheduleRegistry.governanceTimelock() == GOVERNANCE, "schedules/governance");
        require(d.royaltyVault.governanceTimelock() == GOVERNANCE, "vault/governance");
        require(d.royaltyRouter.governanceTimelock() == GOVERNANCE, "router/governance");
        require(d.playbackAccounting.governanceTimelock() == GOVERNANCE, "playback/governance");
        require(d.streamingSettlementEpoch.governanceTimelock() == GOVERNANCE, "settlement/governance");

        require(address(d.workRegistry.creatorProfiles()) == address(d.creatorProfileRegistry), "work/profiles");
        require(address(d.recordingRegistry.creatorProfiles()) == address(d.creatorProfileRegistry), "recording/profiles");
        require(address(d.recordingRegistry.works()) == address(d.workRegistry), "recording/works");
        require(address(d.rightsRegistry.creatorProfiles()) == address(d.creatorProfileRegistry), "rights/profiles");
        require(address(d.rightsRegistry.works()) == address(d.workRegistry), "rights/works");
        require(address(d.rightsRegistry.recordings()) == address(d.recordingRegistry), "rights/recordings");
        require(address(d.authorizationRegistry.creatorProfiles()) == address(d.creatorProfileRegistry), "auth/profiles");
        require(address(d.authorizationRegistry.works()) == address(d.workRegistry), "auth/works");
        require(address(d.authorizationRegistry.recordings()) == address(d.recordingRegistry), "auth/recordings");
        require(address(d.licenseRegistry.creatorProfiles()) == address(d.creatorProfileRegistry), "license/profiles");
        require(address(d.licenseRegistry.recordings()) == address(d.recordingRegistry), "license/recordings");

        require(d.royaltyVault.rightsRegistry() == address(d.rightsRegistry), "vault/rights");
        require(address(d.royaltyVault.creatorProfiles()) == address(d.creatorProfileRegistry), "vault/profiles");
        require(d.royaltyVault.treasuryRecipient() == TREASURY, "vault/treasury");
        require(address(d.royaltyRouter.recordings()) == address(d.recordingRegistry), "router/recordings");
        require(address(d.royaltyRouter.schedules()) == address(d.royaltyScheduleRegistry), "router/schedules");
        require(address(d.royaltyRouter.vault()) == address(d.royaltyVault), "router/vault");

        require(address(d.catalogRegistry.creatorProfiles()) == address(d.creatorProfileRegistry), "catalog/profiles");
        require(address(d.catalogRegistry.recordings()) == address(d.recordingRegistry), "catalog/recordings");
        require(address(d.catalogMetadataRegistry.creatorProfiles()) == address(d.creatorProfileRegistry), "metadata/profiles");
        require(address(d.catalogMetadataRegistry.catalog()) == address(d.catalogRegistry), "metadata/catalog");

        require(address(d.mediaManifestRegistry.recordings()) == address(d.recordingRegistry), "media/recordings");
        require(address(d.mediaManifestRegistry.creatorProfiles()) == address(d.creatorProfileRegistry), "media/profiles");
        require(address(d.storageSourceRegistry.recordings()) == address(d.recordingRegistry), "storage/recordings");
        require(address(d.storageSourceRegistry.creatorProfiles()) == address(d.creatorProfileRegistry), "storage/profiles");
        require(address(d.playbackResolver.mediaManifests()) == address(d.mediaManifestRegistry), "resolver/media");
        require(address(d.playbackResolver.storageSources()) == address(d.storageSourceRegistry), "resolver/storage");
        require(address(d.playbackAccounting.recordings()) == address(d.recordingRegistry), "playback/recordings");

        require(
            d.streamingSettlementEpoch.playbackAccounting() == address(d.playbackAccounting),
            "settlement/playback"
        );
        require(
            address(d.streamingRevenueAllocator.settlements()) == address(d.streamingSettlementEpoch),
            "allocator/settlement"
        );
        require(
            address(d.streamingRevenueAllocator.playbackAccounting()) == address(d.playbackAccounting),
            "allocator/playback"
        );
        require(
            address(d.streamingRoyaltySettlement.allocator()) == address(d.streamingRevenueAllocator),
            "royalty/allocator"
        );
        require(
            address(d.streamingRoyaltySettlement.royaltyRouter()) == address(d.royaltyRouter),
            "royalty/router"
        );
    }

    function testGovernanceInitializationIsExplicitAndAuthorityBound() public {
        HzDeploymentGraph420.Deployment memory d = HzDeploymentGraph420.deploy(GOVERNANCE, TREASURY);

        (bool unauthorized,) =
            address(d.workRegistry).call(abi.encodeCall(WorkRegistry420.setRightsRegistry, (address(d.rightsRegistry))));
        require(!unauthorized, "non-governance wired work registry");

        vm.prank(GOVERNANCE);
        d.workRegistry.setRightsRegistry(address(d.rightsRegistry));
        vm.prank(GOVERNANCE);
        d.recordingRegistry.configureDependencies(address(d.rightsRegistry), address(d.authorizationRegistry));
        vm.prank(GOVERNANCE);
        d.rightsRegistry.setRoyaltyAccounting(address(d.royaltyVault));
        vm.prank(GOVERNANCE);
        d.authorizationRegistry.setLicenseRegistry(address(d.licenseRegistry));
        vm.prank(GOVERNANCE);
        d.licenseRegistry.setRoyaltyRouter(address(d.royaltyRouter));
        vm.prank(GOVERNANCE);
        d.royaltyVault.setRoyaltyRouter(address(d.royaltyRouter));
        vm.prank(GOVERNANCE);
        d.royaltyRouter.setSettlementSource(address(d.licenseRegistry), true);
        vm.prank(GOVERNANCE);
        d.royaltyRouter.setSettlementSource(address(d.streamingRoyaltySettlement), true);
        vm.prank(GOVERNANCE);
        d.playbackAccounting.setSubmitter(PLAYBACK_SUBMITTER, true);
        vm.prank(GOVERNANCE);
        d.streamingSettlementEpoch.setSubmitter(SETTLEMENT_SUBMITTER, true);

        require(d.workRegistry.rightsRegistry() == address(d.rightsRegistry), "work/rights");
        require(d.recordingRegistry.rightsRegistry() == address(d.rightsRegistry), "recording/rights");
        require(
            d.recordingRegistry.authorizationRegistry() == address(d.authorizationRegistry),
            "recording/authorization"
        );
        require(d.rightsRegistry.royaltyAccounting() == address(d.royaltyVault), "rights/accounting");
        require(d.authorizationRegistry.licenseRegistry() == address(d.licenseRegistry), "auth/license");
        require(d.licenseRegistry.royaltyRouter() == address(d.royaltyRouter), "license/router");
        require(d.royaltyVault.royaltyRouter() == address(d.royaltyRouter), "vault/router");
        require(d.royaltyRouter.settlementSource(address(d.licenseRegistry)), "license/source");
        require(d.royaltyRouter.settlementSource(address(d.streamingRoyaltySettlement)), "stream/source");
        require(d.playbackAccounting.submitters(PLAYBACK_SUBMITTER), "playback/submitter");
        require(d.streamingSettlementEpoch.submitters(SETTLEMENT_SUBMITTER), "settlement/submitter");
    }

    function testZeroAuthorityOrTreasuryFailsClosed() public {
        (bool zeroGovernance,) = address(this).call(
            abi.encodeWithSelector(this.deployForRevert.selector, address(0), TREASURY)
        );
        require(!zeroGovernance, "zero governance accepted");

        (bool zeroTreasury,) = address(this).call(
            abi.encodeWithSelector(this.deployForRevert.selector, GOVERNANCE, address(0))
        );
        require(!zeroTreasury, "zero treasury accepted");
    }

    function deployForRevert(address governance, address treasury) external {
        HzDeploymentGraph420.deploy(governance, treasury);
    }
}

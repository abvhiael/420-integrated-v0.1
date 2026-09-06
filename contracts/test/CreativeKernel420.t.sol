// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/creative/core/CreatorProfileRegistry420.sol";
import "../src/creative/music/WorkRegistry420.sol";
import "../src/creative/music/RecordingRegistry420.sol";
import "../src/creative/rights/RightsRegistry420.sol";
import "../src/creative/rights/AuthorizationRegistry420.sol";
import "../src/creative/rights/LicenseRegistry420.sol";
import "../src/creative/economics/RoyaltyScheduleRegistry420.sol";
import "../src/creative/economics/RoyaltyVault420.sol";
import "../src/creative/economics/RoyaltyRouter420.sol";

interface Vm420 {
    function deal(address who, uint256 newBalance) external;
    function prank(address msgSender) external;
}

contract CreativeKernel420Test {
    Vm420 private constant vm = Vm420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant ALICE = address(0xA11CE);
    address private constant BOB = address(0xB0B);
    address private constant PRODUCER = address(0xBEEF);
    address private constant REMIXER = address(0xCAFE);

    CreatorProfileRegistry420 profiles;
    WorkRegistry420 works;
    RecordingRegistry420 recordings;
    RightsRegistry420 rights;
    AuthorizationRegistry420 auth;
    LicenseRegistry420 licenses;
    RoyaltyScheduleRegistry420 schedules;
    RoyaltyVault420 vault;
    RoyaltyRouter420 router;

    CreatorId aliceId;
    CreatorId bobId;
    CreatorId producerId;
    CreatorId remixerId;

    function setUp() public {
        profiles = new CreatorProfileRegistry420(address(this));
        works = new WorkRegistry420(address(this), address(profiles));
        recordings = new RecordingRegistry420(address(this), address(profiles), address(works));
        rights = new RightsRegistry420(address(this), address(profiles), address(works), address(recordings));
        auth = new AuthorizationRegistry420(address(this), address(profiles), address(works), address(recordings));
        licenses = new LicenseRegistry420(address(this), address(profiles), address(recordings));
        schedules = new RoyaltyScheduleRegistry420(address(this));
        vault = new RoyaltyVault420(address(this), address(rights), address(profiles), address(this));
        router = new RoyaltyRouter420(address(this), address(recordings), address(schedules), address(vault));

        works.setRightsRegistry(address(rights));
        recordings.configureDependencies(address(rights), address(auth));
        rights.setRoyaltyAccounting(address(vault));
        auth.setLicenseRegistry(address(licenses));
        licenses.setRoyaltyRouter(address(router));
        vault.setRoyaltyRouter(address(router));
        router.setSettlementSource(address(this), true);
        router.setSettlementSource(address(licenses), true);

        vm.prank(ALICE);
        aliceId = profiles.createProfile(IdentityType.ARTIST_PROJECT, keccak256("alice"));
        vm.prank(BOB);
        bobId = profiles.createProfile(IdentityType.INDIVIDUAL, keccak256("bob"));
        vm.prank(PRODUCER);
        producerId = profiles.createProfile(IdentityType.INDIVIDUAL, keccak256("producer"));
        vm.prank(REMIXER);
        remixerId = profiles.createProfile(IdentityType.ARTIST_PROJECT, keccak256("remixer"));
        vm.deal(address(this), 1_000 ether);
        vm.deal(REMIXER, 100 ether);
    }

    function testDecision10KernelHappyPath() public {
        WorkId workId = _createWork();
        RecordingId originalId = _createOriginal(workId);
        _registerKernelSchedules();
        _assertOriginalSettlement(workId, originalId);
        LicenseId licenseId = _buyRemixLicense(originalId);
        RecordingId remixId = _createRemix(workId, originalId, licenseId);
        _assertRemixSettlement(originalId, remixId);
    }

    function _createWork() internal returns (WorkId workId) {
        vm.prank(ALICE);
        workId = works.registerWork(
            aliceId,
            WorkId.wrap(0),
            keccak256("composition"),
            keccak256("work-meta"),
            keccak256("work-prov"),
            ProvenanceClass.NATIVE_VERIFIED,
            RightsStatus.RIGHTS_VERIFIED
        );

        uint256[] memory holders = new uint256[](2);
        uint16[] memory bps = new uint16[](2);
        holders[0] = CreatorId.unwrap(aliceId);
        bps[0] = 6000;
        holders[1] = CreatorId.unwrap(bobId);
        bps[1] = 4000;
        vm.prank(ALICE);
        rights.proposeInitialSplit(CreativeAssetType.WORK, WorkId.unwrap(workId), holders, bps);
        vm.prank(ALICE);
        rights.acceptInitialShare(CreativeAssetType.WORK, WorkId.unwrap(workId));
        vm.prank(BOB);
        rights.acceptInitialShare(CreativeAssetType.WORK, WorkId.unwrap(workId));
        vm.prank(ALICE);
        rights.finalizeInitialSplit(CreativeAssetType.WORK, WorkId.unwrap(workId));
        vm.prank(ALICE);
        works.activateWork(workId);

        vm.prank(ALICE);
        auth.setPolicy(
            CreativeAssetType.WORK,
            WorkId.unwrap(workId),
            PolicyPreset.OPEN_REMIX,
            CreativePermissions420.CREATE_REMIX | CreativePermissions420.COMMERCIALIZE,
            0,
            0,
            0,
            keccak256("work-open-remix")
        );
    }

    function _createOriginal(WorkId workId) internal returns (RecordingId originalId) {
        RecordingRegistration420 memory request = RecordingRegistration420({
            registrantProfileId: aliceId,
            workId: workId,
            parentRecordingId: RecordingId.wrap(0),
            supersedesRecordingId: RecordingId.wrap(0),
            recordingClass: RecordingClass.ORIGINAL,
            masterHash: keccak256("master-original"),
            metadataHash: keccak256("recording-meta"),
            provenanceHash: keccak256("recording-prov"),
            mediaManifestHash: keccak256("media-manifest"),
            authorizationManifestHash: bytes32(0),
            provenanceClass: ProvenanceClass.NATIVE_VERIFIED,
            rightsStatus: RightsStatus.RIGHTS_VERIFIED,
            royaltyScheduleVersion: 1,
            authorizationPolicyVersion: 1
        });
        vm.prank(ALICE);
        originalId = recordings.registerRecording(request);

        uint256[] memory holders = new uint256[](2);
        uint16[] memory bps = new uint16[](2);
        holders[0] = CreatorId.unwrap(aliceId);
        bps[0] = 7000;
        holders[1] = CreatorId.unwrap(producerId);
        bps[1] = 3000;
        vm.prank(ALICE);
        rights.proposeInitialSplit(CreativeAssetType.RECORDING, RecordingId.unwrap(originalId), holders, bps);
        vm.prank(ALICE);
        rights.acceptInitialShare(CreativeAssetType.RECORDING, RecordingId.unwrap(originalId));
        vm.prank(PRODUCER);
        rights.acceptInitialShare(CreativeAssetType.RECORDING, RecordingId.unwrap(originalId));
        vm.prank(ALICE);
        rights.finalizeInitialSplit(CreativeAssetType.RECORDING, RecordingId.unwrap(originalId));

        vm.prank(ALICE);
        auth.setPolicy(
            CreativeAssetType.RECORDING,
            RecordingId.unwrap(originalId),
            PolicyPreset.APPROVAL_REQUIRED,
            CreativePermissions420.USE_MASTER,
            0,
            0,
            0,
            keccak256("source-approval")
        );
        vm.prank(ALICE);
        recordings.activateRecording(originalId, LicenseId.wrap(0));
    }

    function _registerKernelSchedules() internal {
        _registerSchedule(RecordingClass.ORIGINAL, RevenueType.DIRECT_SALE, 1250, 0, 8500, 250, 1);
        _registerSchedule(RecordingClass.ORIGINAL, RevenueType.REMIX_LICENSE, 1250, 0, 8500, 250, 1);
        _registerSchedule(RecordingClass.REMIX, RevenueType.DIRECT_SALE, 1000, 1500, 7250, 250, 1);
    }

    function _assertOriginalSettlement(WorkId workId, RecordingId originalId) internal {
        router.route{value: 100 ether}(originalId, RevenueType.DIRECT_SALE, keccak256("sale-1"));
        bytes32 workKey = CreativeAssetKeys420.key(CreativeAssetType.WORK, WorkId.unwrap(workId));
        bytes32 originalKey = CreativeAssetKeys420.key(CreativeAssetType.RECORDING, RecordingId.unwrap(originalId));
        require(vault.pending(workKey, CreatorId.unwrap(aliceId)) == 7.5 ether, "work/alice");
        require(vault.pending(workKey, CreatorId.unwrap(bobId)) == 5 ether, "work/bob");
        require(vault.pending(originalKey, CreatorId.unwrap(aliceId)) == 59.5 ether, "recording/alice");
        require(vault.pending(originalKey, CreatorId.unwrap(producerId)) == 25.5 ether, "recording/producer");
        require(vault.treasuryClaimable() == 2.5 ether, "treasury");
    }

    function _buyRemixLicense(RecordingId originalId) internal returns (LicenseId licenseId) {
        vm.prank(ALICE);
        uint256 offerId = licenses.createRecordingOffer(
            originalId,
            CreativePermissions420.CREATE_REMIX | CreativePermissions420.USE_MASTER
                | CreativePermissions420.COMMERCIALIZE,
            20 ether,
            0,
            0,
            1,
            keccak256("remix-license")
        );
        vm.prank(REMIXER);
        licenseId = licenses.acceptOffer{value: 20 ether}(offerId, remixerId);
    }

    function _createRemix(WorkId workId, RecordingId originalId, LicenseId licenseId)
        internal
        returns (RecordingId remixId)
    {
        RecordingRegistration420 memory request = RecordingRegistration420({
            registrantProfileId: remixerId,
            workId: workId,
            parentRecordingId: originalId,
            supersedesRecordingId: RecordingId.wrap(0),
            recordingClass: RecordingClass.REMIX,
            masterHash: keccak256("master-remix"),
            metadataHash: keccak256("remix-meta"),
            provenanceHash: keccak256("remix-prov"),
            mediaManifestHash: keccak256("remix-media"),
            authorizationManifestHash: keccak256("remix-auth"),
            provenanceClass: ProvenanceClass.NATIVE_VERIFIED,
            rightsStatus: RightsStatus.RIGHTS_VERIFIED,
            royaltyScheduleVersion: 1,
            authorizationPolicyVersion: 0
        });
        vm.prank(REMIXER);
        remixId = recordings.registerRecording(request);

        uint256[] memory holders = new uint256[](1);
        uint16[] memory bps = new uint16[](1);
        holders[0] = CreatorId.unwrap(remixerId);
        bps[0] = 10_000;
        vm.prank(REMIXER);
        rights.proposeInitialSplit(CreativeAssetType.RECORDING, RecordingId.unwrap(remixId), holders, bps);
        vm.prank(REMIXER);
        rights.acceptInitialShare(CreativeAssetType.RECORDING, RecordingId.unwrap(remixId));
        vm.prank(REMIXER);
        rights.finalizeInitialSplit(CreativeAssetType.RECORDING, RecordingId.unwrap(remixId));
        vm.prank(REMIXER);
        recordings.activateRecording(remixId, licenseId);
    }

    function _assertRemixSettlement(RecordingId originalId, RecordingId remixId) internal {
        bytes32 originalKey = CreativeAssetKeys420.key(CreativeAssetType.RECORDING, RecordingId.unwrap(originalId));
        uint256 parentBefore = vault.pool(originalKey).totalReceived;
        router.route{value: 100 ether}(remixId, RevenueType.DIRECT_SALE, keccak256("remix-sale-1"));
        uint256 parentAfter = vault.pool(originalKey).totalReceived;
        require(parentAfter - parentBefore == 15 ether, "one-hop source bucket");
        bytes32 remixKey = CreativeAssetKeys420.key(CreativeAssetType.RECORDING, RecordingId.unwrap(remixId));
        require(vault.pending(remixKey, CreatorId.unwrap(remixerId)) == 72.5 ether, "remixer current pool");
    }

    function _registerSchedule(
        RecordingClass class_,
        RevenueType revenueType_,
        uint16 workBps,
        uint16 sourceBps,
        uint16 currentBps,
        uint16 protocolBps,
        uint32 version
    ) internal {
        schedules.registerSchedule(
            class_,
            revenueType_,
            RoyaltySchedule420({
                workBps: workBps,
                sourceBps: sourceBps,
                currentRecordingBps: currentBps,
                protocolBps: protocolBps,
                version: version,
                effectiveAt: uint64(block.timestamp),
                termsHash: keccak256(abi.encode(class_, revenueType_, version))
            })
        );
    }

    receive() external payable {}
}

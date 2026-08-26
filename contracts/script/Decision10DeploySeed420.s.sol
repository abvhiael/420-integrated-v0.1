// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/creative/core/CreativeProtocolRegistry420.sol";
import "../src/creative/core/CreatorProfileRegistry420.sol";
import "../src/creative/music/WorkRegistry420.sol";
import "../src/creative/music/RecordingRegistry420.sol";
import "../src/creative/rights/ContributorRegistry420.sol";
import "../src/creative/rights/RightsRegistry420.sol";
import "../src/creative/rights/AuthorizationRegistry420.sol";
import "../src/creative/rights/LicenseRegistry420.sol";
import "../src/creative/economics/RoyaltyScheduleRegistry420.sol";
import "../src/creative/economics/RoyaltyVault420.sol";
import "../src/creative/economics/RoyaltyRouter420.sol";

interface VmDecision10Seed420 {
    function addr(uint256 privateKey) external returns (address);
    function deal(address who, uint256 newBalance) external;
    function startPrank(address msgSender) external;
    function stopPrank() external;
    function toString(address value) external pure returns (string memory);
    function toString(uint256 value) external pure returns (string memory);
    function toString(bytes32 value) external pure returns (string memory);
    function writeFile(string calldata path, string calldata data) external;
}

/// @notice Deterministic Decision #10 reference deployment and seeded chain-history harness.
/// @dev TEST/DEV ONLY. The fixture private keys below are public constants and MUST NEVER hold real value.
contract Decision10DeploySeed420 {
    VmDecision10Seed420 private constant vm =
        VmDecision10Seed420(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 private constant DEPLOYER_PK = 0x420420;
    uint256 private constant ALICE_PK = 0xA11CE;
    uint256 private constant BOB_PK = 0xB0B;
    uint256 private constant CAROL_PK = 0xCA401;
    uint256 private constant PRODUCER_PK = 0xBEEF;
    uint256 private constant REMIXER_PK = 0xCAFE;

    string public constant MANIFEST_PATH = "../artifacts/contracts/creative-kernel-v1.fixture.json";
    string public constant MANIFEST_SCHEMA = "420.creative.kernel.fixture.v1";

    struct Accounts {
        address deployer;
        address alice;
        address bob;
        address carol;
        address producer;
        address remixer;
    }

    struct Kernel {
        CreativeProtocolRegistry420 protocol;
        CreatorProfileRegistry420 profiles;
        WorkRegistry420 works;
        RecordingRegistry420 recordings;
        ContributorRegistry420 contributors;
        RightsRegistry420 rights;
        AuthorizationRegistry420 authorization;
        LicenseRegistry420 licenses;
        RoyaltyScheduleRegistry420 schedules;
        RoyaltyVault420 vault;
        RoyaltyRouter420 router;
    }

    struct Creators {
        CreatorId alice;
        CreatorId bob;
        CreatorId carol;
        CreatorId producer;
        CreatorId remixer;
    }

    struct Fixture {
        WorkId workId;
        RecordingId originalId;
        RecordingId remixId;
        LicenseId remixLicenseId;
        uint256 remixOfferId;
        uint256 rightsTransferId;
        bytes32 aliceWorkCreditId;
        bytes32 bobWorkCreditId;
        bytes32 aliceRecordingCreditId;
        bytes32 producerRecordingCreditId;
        bytes32 originalInitialSettlementId;
        bytes32 remixLicenseSettlementId;
        bytes32 remixSettlementId;
        bytes32 originalPostTransferSettlementId;
    }

    function run() external returns (Kernel memory kernel, Accounts memory accounts, Creators memory creators, Fixture memory fixture) {
        accounts = _accounts();
        _fund(accounts);
        kernel = _deploy(accounts.deployer);
        _wireAndRegister(kernel, accounts.deployer);
        creators = _createProfiles(kernel, accounts);
        _registerSchedules(kernel, accounts.deployer);
        fixture = _seed(kernel, accounts, creators);
        _writeManifest(kernel, accounts, creators, fixture);
        _assertSeed(kernel, creators, fixture);
    }

    function _accounts() internal returns (Accounts memory accounts) {
        accounts = Accounts({
            deployer: vm.addr(DEPLOYER_PK),
            alice: vm.addr(ALICE_PK),
            bob: vm.addr(BOB_PK),
            carol: vm.addr(CAROL_PK),
            producer: vm.addr(PRODUCER_PK),
            remixer: vm.addr(REMIXER_PK)
        });
    }

    function _fund(Accounts memory accounts) internal {
        vm.deal(accounts.deployer, 1_000 ether);
        vm.deal(accounts.alice, 1_000 ether);
        vm.deal(accounts.bob, 1_000 ether);
        vm.deal(accounts.carol, 1_000 ether);
        vm.deal(accounts.producer, 1_000 ether);
        vm.deal(accounts.remixer, 1_000 ether);
    }

    function _deploy(address deployer) internal returns (Kernel memory kernel) {
        vm.startPrank(deployer);
        kernel.protocol = new CreativeProtocolRegistry420(deployer);
        kernel.profiles = new CreatorProfileRegistry420(deployer);
        kernel.works = new WorkRegistry420(deployer, address(kernel.profiles));
        kernel.recordings = new RecordingRegistry420(deployer, address(kernel.profiles), address(kernel.works));
        kernel.contributors = new ContributorRegistry420(address(kernel.profiles), address(kernel.works), address(kernel.recordings));
        kernel.rights = new RightsRegistry420(deployer, address(kernel.profiles), address(kernel.works), address(kernel.recordings));
        kernel.authorization = new AuthorizationRegistry420(deployer, address(kernel.profiles), address(kernel.works), address(kernel.recordings));
        kernel.licenses = new LicenseRegistry420(deployer, address(kernel.profiles), address(kernel.recordings));
        kernel.schedules = new RoyaltyScheduleRegistry420(deployer);
        kernel.vault = new RoyaltyVault420(deployer, address(kernel.rights), address(kernel.profiles), deployer);
        kernel.router = new RoyaltyRouter420(deployer, address(kernel.recordings), address(kernel.schedules), address(kernel.vault));
        vm.stopPrank();
    }

    function _wireAndRegister(Kernel memory kernel, address deployer) internal {
        vm.startPrank(deployer);
        kernel.works.setRightsRegistry(address(kernel.rights));
        kernel.recordings.configureDependencies(address(kernel.rights), address(kernel.authorization));
        kernel.rights.setRoyaltyAccounting(address(kernel.vault));
        kernel.authorization.setLicenseRegistry(address(kernel.licenses));
        kernel.licenses.setRoyaltyRouter(address(kernel.router));
        kernel.vault.setRoyaltyRouter(address(kernel.router));
        kernel.router.setSettlementSource(deployer, true);
        kernel.router.setSettlementSource(address(kernel.licenses), true);

        bytes32 releaseManifest = keccak256("420.creative.kernel.v1");
        kernel.protocol.registerModule(keccak256("CREATIVE_PROTOCOL_REGISTRY"), address(kernel.protocol), 1, releaseManifest);
        kernel.protocol.registerModule(keccak256("CREATOR_PROFILE_REGISTRY"), address(kernel.profiles), 1, releaseManifest);
        kernel.protocol.registerModule(keccak256("WORK_REGISTRY"), address(kernel.works), 1, releaseManifest);
        kernel.protocol.registerModule(keccak256("RECORDING_REGISTRY"), address(kernel.recordings), 1, releaseManifest);
        kernel.protocol.registerModule(keccak256("CONTRIBUTOR_REGISTRY"), address(kernel.contributors), 1, releaseManifest);
        kernel.protocol.registerModule(keccak256("RIGHTS_REGISTRY"), address(kernel.rights), 1, releaseManifest);
        kernel.protocol.registerModule(keccak256("AUTHORIZATION_REGISTRY"), address(kernel.authorization), 1, releaseManifest);
        kernel.protocol.registerModule(keccak256("LICENSE_REGISTRY"), address(kernel.licenses), 1, releaseManifest);
        kernel.protocol.registerModule(keccak256("ROYALTY_SCHEDULE_REGISTRY"), address(kernel.schedules), 1, releaseManifest);
        kernel.protocol.registerModule(keccak256("ROYALTY_VAULT"), address(kernel.vault), 1, releaseManifest);
        kernel.protocol.registerModule(keccak256("ROYALTY_ROUTER"), address(kernel.router), 1, releaseManifest);
        vm.stopPrank();
    }

    function _createProfiles(Kernel memory kernel, Accounts memory accounts) internal returns (Creators memory creators) {
        vm.startPrank(accounts.alice);
        creators.alice = kernel.profiles.createProfile(IdentityType.ARTIST_PROJECT, keccak256("fixture/alice"));
        vm.stopPrank();
        vm.startPrank(accounts.bob);
        creators.bob = kernel.profiles.createProfile(IdentityType.INDIVIDUAL, keccak256("fixture/bob"));
        vm.stopPrank();
        vm.startPrank(accounts.carol);
        creators.carol = kernel.profiles.createProfile(IdentityType.INDIVIDUAL, keccak256("fixture/carol"));
        vm.stopPrank();
        vm.startPrank(accounts.producer);
        creators.producer = kernel.profiles.createProfile(IdentityType.INDIVIDUAL, keccak256("fixture/producer"));
        vm.stopPrank();
        vm.startPrank(accounts.remixer);
        creators.remixer = kernel.profiles.createProfile(IdentityType.ARTIST_PROJECT, keccak256("fixture/remixer"));
        vm.stopPrank();
    }

    function _registerSchedules(Kernel memory kernel, address deployer) internal {
        vm.startPrank(deployer);
        _registerSchedule(kernel.schedules, RecordingClass.ORIGINAL, RevenueType.DIRECT_SALE, 1250, 0, 8500, 250);
        _registerSchedule(kernel.schedules, RecordingClass.ORIGINAL, RevenueType.REMIX_LICENSE, 1250, 0, 8500, 250);
        _registerSchedule(kernel.schedules, RecordingClass.REMIX, RevenueType.DIRECT_SALE, 1000, 1500, 7250, 250);
        vm.stopPrank();
    }

    function _registerSchedule(
        RoyaltyScheduleRegistry420 schedules,
        RecordingClass class_,
        RevenueType revenueType_,
        uint16 workBps,
        uint16 sourceBps,
        uint16 currentBps,
        uint16 protocolBps
    ) internal {
        schedules.registerSchedule(
            class_,
            revenueType_,
            RoyaltySchedule420({
                workBps: workBps,
                sourceBps: sourceBps,
                currentRecordingBps: currentBps,
                protocolBps: protocolBps,
                version: 1,
                effectiveAt: uint64(block.timestamp),
                termsHash: keccak256(abi.encode("420.royalty.schedule.v1", class_, revenueType_))
            })
        );
    }

    function _seed(Kernel memory kernel, Accounts memory accounts, Creators memory creators)
        internal
        returns (Fixture memory fixture)
    {
        fixture.workId = _seedWork(kernel, accounts, creators, fixture);
        fixture.originalId = _seedOriginal(kernel, accounts, creators, fixture.workId, fixture);

        fixture.originalInitialSettlementId = keccak256("fixture/original/direct-sale/1");
        vm.startPrank(accounts.deployer);
        kernel.router.route{value: 100 ether}(fixture.originalId, RevenueType.DIRECT_SALE, fixture.originalInitialSettlementId);
        vm.stopPrank();

        (fixture.remixOfferId, fixture.remixLicenseId) = _seedLicense(kernel, accounts, creators, fixture.originalId);
        fixture.remixLicenseSettlementId = keccak256(
            abi.encode("420/LICENSE", block.chainid, address(kernel.licenses), LicenseId.unwrap(fixture.remixLicenseId), fixture.remixOfferId)
        );
        fixture.remixId = _seedRemix(kernel, accounts, creators, fixture.workId, fixture.originalId, fixture.remixLicenseId);

        fixture.remixSettlementId = keccak256("fixture/remix/direct-sale/1");
        vm.startPrank(accounts.deployer);
        kernel.router.route{value: 100 ether}(fixture.remixId, RevenueType.DIRECT_SALE, fixture.remixSettlementId);
        vm.stopPrank();

        vm.startPrank(accounts.alice);
        fixture.rightsTransferId = kernel.rights.proposeTransfer(
            CreativeAssetType.RECORDING,
            RecordingId.unwrap(fixture.originalId),
            CreatorId.unwrap(creators.alice),
            CreatorId.unwrap(creators.carol),
            1000,
            0
        );
        vm.stopPrank();
        vm.startPrank(accounts.carol);
        kernel.rights.acceptTransfer(fixture.rightsTransferId);
        vm.stopPrank();

        fixture.originalPostTransferSettlementId = keccak256("fixture/original/direct-sale/post-transfer/1");
        vm.startPrank(accounts.deployer);
        kernel.router.route{value: 40 ether}(
            fixture.originalId, RevenueType.DIRECT_SALE, fixture.originalPostTransferSettlementId
        );
        vm.stopPrank();
    }

    function _seedWork(Kernel memory kernel, Accounts memory accounts, Creators memory creators, Fixture memory fixture)
        internal
        returns (WorkId workId)
    {
        vm.startPrank(accounts.alice);
        workId = kernel.works.registerWork(
            creators.alice,
            WorkId.wrap(0),
            keccak256("fixture/composition/master"),
            keccak256("fixture/work/metadata"),
            keccak256("fixture/work/provenance"),
            ProvenanceClass.NATIVE_VERIFIED,
            RightsStatus.RIGHTS_VERIFIED
        );
        vm.stopPrank();

        uint256[] memory holders = new uint256[](2);
        uint16[] memory shares = new uint16[](2);
        holders[0] = CreatorId.unwrap(creators.alice);
        shares[0] = 6000;
        holders[1] = CreatorId.unwrap(creators.bob);
        shares[1] = 4000;
        vm.startPrank(accounts.alice);
        kernel.rights.proposeInitialSplit(CreativeAssetType.WORK, WorkId.unwrap(workId), holders, shares);
        vm.stopPrank();
        vm.startPrank(accounts.alice);
        kernel.rights.acceptInitialShare(CreativeAssetType.WORK, WorkId.unwrap(workId));
        vm.stopPrank();
        vm.startPrank(accounts.bob);
        kernel.rights.acceptInitialShare(CreativeAssetType.WORK, WorkId.unwrap(workId));
        vm.stopPrank();
        vm.startPrank(accounts.alice);
        kernel.rights.finalizeInitialSplit(CreativeAssetType.WORK, WorkId.unwrap(workId));
        kernel.works.activateWork(workId);
        kernel.authorization.setPolicy(
            CreativeAssetType.WORK,
            WorkId.unwrap(workId),
            PolicyPreset.OPEN_REMIX,
            CreativePermissions420.CREATE_REMIX | CreativePermissions420.COMMERCIALIZE,
            0,
            0,
            0,
            keccak256("fixture/work/open-remix")
        );
        vm.stopPrank();

        vm.startPrank(accounts.alice);
        fixture.aliceWorkCreditId = kernel.contributors.proposeCredit(
            CreativeAssetType.WORK, WorkId.unwrap(workId), creators.alice, 1, 1
        );
        vm.stopPrank();
        vm.startPrank(accounts.alice);
        kernel.contributors.acceptCredit(fixture.aliceWorkCreditId);
        vm.stopPrank();
        vm.startPrank(accounts.alice);
        fixture.bobWorkCreditId = kernel.contributors.proposeCredit(
            CreativeAssetType.WORK, WorkId.unwrap(workId), creators.bob, 1, 2
        );
        vm.stopPrank();
        vm.startPrank(accounts.bob);
        kernel.contributors.acceptCredit(fixture.bobWorkCreditId);
        vm.stopPrank();
    }

    function _seedOriginal(
        Kernel memory kernel,
        Accounts memory accounts,
        Creators memory creators,
        WorkId workId,
        Fixture memory fixture
    ) internal returns (RecordingId originalId) {
        RecordingRegistration420 memory request = RecordingRegistration420({
            registrantProfileId: creators.alice,
            workId: workId,
            parentRecordingId: RecordingId.wrap(0),
            supersedesRecordingId: RecordingId.wrap(0),
            recordingClass: RecordingClass.ORIGINAL,
            masterHash: keccak256("fixture/original/master"),
            metadataHash: keccak256("fixture/original/metadata"),
            provenanceHash: keccak256("fixture/original/provenance"),
            mediaManifestHash: keccak256("fixture/original/media-manifest"),
            authorizationManifestHash: bytes32(0),
            provenanceClass: ProvenanceClass.NATIVE_VERIFIED,
            rightsStatus: RightsStatus.RIGHTS_VERIFIED,
            royaltyScheduleVersion: 1,
            authorizationPolicyVersion: 1
        });
        vm.startPrank(accounts.alice);
        originalId = kernel.recordings.registerRecording(request);
        vm.stopPrank();

        uint256[] memory holders = new uint256[](2);
        uint16[] memory shares = new uint16[](2);
        holders[0] = CreatorId.unwrap(creators.alice);
        shares[0] = 7000;
        holders[1] = CreatorId.unwrap(creators.producer);
        shares[1] = 3000;
        vm.startPrank(accounts.alice);
        kernel.rights.proposeInitialSplit(CreativeAssetType.RECORDING, RecordingId.unwrap(originalId), holders, shares);
        vm.stopPrank();
        vm.startPrank(accounts.alice);
        kernel.rights.acceptInitialShare(CreativeAssetType.RECORDING, RecordingId.unwrap(originalId));
        vm.stopPrank();
        vm.startPrank(accounts.producer);
        kernel.rights.acceptInitialShare(CreativeAssetType.RECORDING, RecordingId.unwrap(originalId));
        vm.stopPrank();
        vm.startPrank(accounts.alice);
        kernel.rights.finalizeInitialSplit(CreativeAssetType.RECORDING, RecordingId.unwrap(originalId));
        kernel.authorization.setPolicy(
            CreativeAssetType.RECORDING,
            RecordingId.unwrap(originalId),
            PolicyPreset.APPROVAL_REQUIRED,
            CreativePermissions420.USE_MASTER,
            0,
            0,
            0,
            keccak256("fixture/original/approval-required")
        );
        kernel.recordings.activateRecording(originalId, LicenseId.wrap(0));
        vm.stopPrank();

        vm.startPrank(accounts.alice);
        fixture.aliceRecordingCreditId = kernel.contributors.proposeCredit(
            CreativeAssetType.RECORDING, RecordingId.unwrap(originalId), creators.alice, 1, 101
        );
        vm.stopPrank();
        vm.startPrank(accounts.alice);
        kernel.contributors.acceptCredit(fixture.aliceRecordingCreditId);
        vm.stopPrank();
        vm.startPrank(accounts.alice);
        fixture.producerRecordingCreditId = kernel.contributors.proposeCredit(
            CreativeAssetType.RECORDING, RecordingId.unwrap(originalId), creators.producer, 1, 105
        );
        vm.stopPrank();
        vm.startPrank(accounts.producer);
        kernel.contributors.acceptCredit(fixture.producerRecordingCreditId);
        vm.stopPrank();
    }

    function _seedLicense(Kernel memory kernel, Accounts memory accounts, Creators memory creators, RecordingId originalId)
        internal
        returns (uint256 offerId, LicenseId licenseId)
    {
        vm.startPrank(accounts.alice);
        offerId = kernel.licenses.createRecordingOffer(
            originalId,
            CreativePermissions420.CREATE_REMIX | CreativePermissions420.USE_MASTER
                | CreativePermissions420.COMMERCIALIZE,
            20 ether,
            0,
            0,
            1,
            keccak256("fixture/remix/license")
        );
        vm.stopPrank();
        vm.startPrank(accounts.remixer);
        licenseId = kernel.licenses.acceptOffer{value: 20 ether}(offerId, creators.remixer);
        vm.stopPrank();
    }

    function _seedRemix(
        Kernel memory kernel,
        Accounts memory accounts,
        Creators memory creators,
        WorkId workId,
        RecordingId originalId,
        LicenseId licenseId
    ) internal returns (RecordingId remixId) {
        RecordingRegistration420 memory request = RecordingRegistration420({
            registrantProfileId: creators.remixer,
            workId: workId,
            parentRecordingId: originalId,
            supersedesRecordingId: RecordingId.wrap(0),
            recordingClass: RecordingClass.REMIX,
            masterHash: keccak256("fixture/remix/master"),
            metadataHash: keccak256("fixture/remix/metadata"),
            provenanceHash: keccak256("fixture/remix/provenance"),
            mediaManifestHash: keccak256("fixture/remix/media-manifest"),
            authorizationManifestHash: keccak256("fixture/remix/authorization-manifest"),
            provenanceClass: ProvenanceClass.NATIVE_VERIFIED,
            rightsStatus: RightsStatus.RIGHTS_VERIFIED,
            royaltyScheduleVersion: 1,
            authorizationPolicyVersion: 0
        });
        vm.startPrank(accounts.remixer);
        remixId = kernel.recordings.registerRecording(request);
        vm.stopPrank();

        uint256[] memory holders = new uint256[](2);
        uint16[] memory shares = new uint16[](2);
        holders[0] = CreatorId.unwrap(creators.remixer);
        shares[0] = 8000;
        holders[1] = CreatorId.unwrap(creators.carol);
        shares[1] = 2000;
        vm.startPrank(accounts.remixer);
        kernel.rights.proposeInitialSplit(CreativeAssetType.RECORDING, RecordingId.unwrap(remixId), holders, shares);
        vm.stopPrank();
        vm.startPrank(accounts.remixer);
        kernel.rights.acceptInitialShare(CreativeAssetType.RECORDING, RecordingId.unwrap(remixId));
        vm.stopPrank();
        vm.startPrank(accounts.carol);
        kernel.rights.acceptInitialShare(CreativeAssetType.RECORDING, RecordingId.unwrap(remixId));
        vm.stopPrank();
        vm.startPrank(accounts.remixer);
        kernel.rights.finalizeInitialSplit(CreativeAssetType.RECORDING, RecordingId.unwrap(remixId));
        kernel.recordings.activateRecording(remixId, licenseId);
        vm.stopPrank();
    }

    function _assertSeed(Kernel memory kernel, Creators memory creators, Fixture memory fixture) internal view {
        bytes32 workKey = CreativeAssetKeys420.key(CreativeAssetType.WORK, WorkId.unwrap(fixture.workId));
        bytes32 originalKey = CreativeAssetKeys420.key(CreativeAssetType.RECORDING, RecordingId.unwrap(fixture.originalId));
        bytes32 remixKey = CreativeAssetKeys420.key(CreativeAssetType.RECORDING, RecordingId.unwrap(fixture.remixId));

        require(kernel.rights.rightsVersion(workKey) == 1, "work rightsVersion");
        require(kernel.rights.rightsVersion(originalKey) == 2, "original rightsVersion");
        require(kernel.rights.rightsVersion(remixKey) == 1, "remix rightsVersion");
        require(kernel.rights.currentShare(originalKey, CreatorId.unwrap(creators.alice)) == 6000, "alice current original");
        require(kernel.rights.currentShare(originalKey, CreatorId.unwrap(creators.producer)) == 3000, "producer current original");
        require(kernel.rights.currentShare(originalKey, CreatorId.unwrap(creators.carol)) == 1000, "carol current original");

        require(kernel.vault.pool(workKey).totalReceived == 30 ether, "work pool total");
        require(kernel.vault.pool(originalKey).totalReceived == 151 ether, "original pool total");
        require(kernel.vault.pool(remixKey).totalReceived == 72.5 ether, "remix pool total");
        require(kernel.vault.treasuryClaimable() == 6.5 ether, "treasury total");
        require(address(kernel.vault).balance == 260 ether, "gross conservation");

        require(kernel.vault.pending(workKey, CreatorId.unwrap(creators.alice)) == 18 ether, "alice work");
        require(kernel.vault.pending(workKey, CreatorId.unwrap(creators.bob)) == 12 ether, "bob work");
        require(kernel.vault.pending(originalKey, CreatorId.unwrap(creators.alice)) == 102.3 ether, "alice original");
        require(kernel.vault.pending(originalKey, CreatorId.unwrap(creators.producer)) == 45.3 ether, "producer original");
        require(kernel.vault.pending(originalKey, CreatorId.unwrap(creators.carol)) == 3.4 ether, "carol original");
        require(kernel.vault.pending(remixKey, CreatorId.unwrap(creators.remixer)) == 58 ether, "remixer remix");
        require(kernel.vault.pending(remixKey, CreatorId.unwrap(creators.carol)) == 14.5 ether, "carol remix");
    }

    function _writeManifest(Kernel memory kernel, Accounts memory accounts, Creators memory creators, Fixture memory fixture)
        internal
    {
        string memory json = string.concat(
            "{\n",
            '  "schema":"', MANIFEST_SCHEMA, '",\n',
            '  "chainId":', vm.toString(block.chainid), ',\n',
            '  "deployer":"', vm.toString(accounts.deployer), '",\n',
            '  "aliceAccount":"', vm.toString(accounts.alice), '",\n',
            '  "bobAccount":"', vm.toString(accounts.bob), '",\n',
            '  "carolAccount":"', vm.toString(accounts.carol), '",\n',
            '  "producerAccount":"', vm.toString(accounts.producer), '",\n',
            '  "remixerAccount":"', vm.toString(accounts.remixer), '",\n'
        );
        json = string.concat(
            json,
            '  "creativeProtocolRegistry":"', vm.toString(address(kernel.protocol)), '",\n',
            '  "creatorProfileRegistry":"', vm.toString(address(kernel.profiles)), '",\n',
            '  "workRegistry":"', vm.toString(address(kernel.works)), '",\n',
            '  "recordingRegistry":"', vm.toString(address(kernel.recordings)), '",\n',
            '  "contributorRegistry":"', vm.toString(address(kernel.contributors)), '",\n',
            '  "rightsRegistry":"', vm.toString(address(kernel.rights)), '",\n',
            '  "authorizationRegistry":"', vm.toString(address(kernel.authorization)), '",\n',
            '  "licenseRegistry":"', vm.toString(address(kernel.licenses)), '",\n',
            '  "royaltyScheduleRegistry":"', vm.toString(address(kernel.schedules)), '",\n',
            '  "royaltyVault":"', vm.toString(address(kernel.vault)), '",\n',
            '  "royaltyRouter":"', vm.toString(address(kernel.router)), '",\n'
        );
        json = string.concat(
            json,
            '  "aliceCreatorId":', vm.toString(CreatorId.unwrap(creators.alice)), ',\n',
            '  "bobCreatorId":', vm.toString(CreatorId.unwrap(creators.bob)), ',\n',
            '  "carolCreatorId":', vm.toString(CreatorId.unwrap(creators.carol)), ',\n',
            '  "producerCreatorId":', vm.toString(CreatorId.unwrap(creators.producer)), ',\n',
            '  "remixerCreatorId":', vm.toString(CreatorId.unwrap(creators.remixer)), ',\n',
            '  "workId":', vm.toString(WorkId.unwrap(fixture.workId)), ',\n',
            '  "originalRecordingId":', vm.toString(RecordingId.unwrap(fixture.originalId)), ',\n',
            '  "remixOfferId":', vm.toString(fixture.remixOfferId), ',\n',
            '  "remixLicenseId":', vm.toString(LicenseId.unwrap(fixture.remixLicenseId)), ',\n',
            '  "remixRecordingId":', vm.toString(RecordingId.unwrap(fixture.remixId)), ',\n',
            '  "rightsTransferId":', vm.toString(fixture.rightsTransferId), ',\n'
        );
        json = string.concat(
            json,
            '  "workRightsVersion":1,\n',
            '  "originalRightsVersion":2,\n',
            '  "remixRightsVersion":1,\n',
            '  "originalInitialSettlementId":"', vm.toString(fixture.originalInitialSettlementId), '",\n',
            '  "remixLicenseSettlementId":"', vm.toString(fixture.remixLicenseSettlementId), '",\n',
            '  "remixSettlementId":"', vm.toString(fixture.remixSettlementId), '",\n',
            '  "originalPostTransferSettlementId":"', vm.toString(fixture.originalPostTransferSettlementId), '",\n',
            '  "aliceWorkCreditId":"', vm.toString(fixture.aliceWorkCreditId), '",\n',
            '  "bobWorkCreditId":"', vm.toString(fixture.bobWorkCreditId), '",\n',
            '  "aliceRecordingCreditId":"', vm.toString(fixture.aliceRecordingCreditId), '",\n',
            '  "producerRecordingCreditId":"', vm.toString(fixture.producerRecordingCreditId), '",\n'
        );
        json = string.concat(
            json,
            '  "expectedWorkPoolWei":', vm.toString(30 ether), ',\n',
            '  "expectedOriginalPoolWei":', vm.toString(151 ether), ',\n',
            '  "expectedRemixPoolWei":', vm.toString(72.5 ether), ',\n',
            '  "expectedTreasuryWei":', vm.toString(6.5 ether), ',\n',
            '  "expectedVaultBalanceWei":', vm.toString(260 ether), ',\n',
            '  "expectedAliceWorkWei":', vm.toString(18 ether), ',\n',
            '  "expectedBobWorkWei":', vm.toString(12 ether), ',\n',
            '  "expectedAliceOriginalWei":', vm.toString(102.3 ether), ',\n',
            '  "expectedProducerOriginalWei":', vm.toString(45.3 ether), ',\n',
            '  "expectedCarolOriginalWei":', vm.toString(3.4 ether), ',\n',
            '  "expectedRemixerRemixWei":', vm.toString(58 ether), ',\n',
            '  "expectedCarolRemixWei":', vm.toString(14.5 ether), '\n',
            "}\n"
        );
        vm.writeFile(MANIFEST_PATH, json);
    }

    receive() external payable {}
}

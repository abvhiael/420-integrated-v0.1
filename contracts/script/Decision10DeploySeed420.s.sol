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
    function serializeAddress(string calldata objectKey, string calldata valueKey, address value)
        external
        returns (string memory json);
    function serializeBytes32(string calldata objectKey, string calldata valueKey, bytes32 value)
        external
        returns (string memory json);
    function serializeString(string calldata objectKey, string calldata valueKey, string calldata value)
        external
        returns (string memory json);
    function serializeUint(string calldata objectKey, string calldata valueKey, uint256 value)
        external
        returns (string memory json);
    function toString(uint256 value) external pure returns (string memory);
    function writeJson(string calldata json, string calldata path) external;
}

/// @notice Deterministic Decision #10 reference deployment and seeded chain-history harness.
/// @dev TEST/DEV ONLY. Fixture private keys are public constants and MUST NEVER hold real value.
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
    bytes32 public constant RELEASE_MANIFEST_HASH = keccak256("420.creative.kernel.v1");

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

    function run()
        external
        returns (Kernel memory kernel, Accounts memory accounts, Creators memory creators, Fixture memory fixture)
    {
        accounts = _accounts();
        _fund(accounts);
        kernel = _deploy(accounts.deployer);
        _wireAndRegister(kernel, accounts.deployer);
        creators = _createProfiles(kernel, accounts);
        _registerSchedules(kernel, accounts.deployer);
        fixture = _seed(kernel, accounts, creators);
        _assertSeed(kernel, creators, fixture);
        _writeManifest(kernel, accounts, creators, fixture);
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
        kernel.contributors =
            new ContributorRegistry420(address(kernel.profiles), address(kernel.works), address(kernel.recordings));
        kernel.rights =
            new RightsRegistry420(deployer, address(kernel.profiles), address(kernel.works), address(kernel.recordings));
        kernel.authorization = new AuthorizationRegistry420(
            deployer, address(kernel.profiles), address(kernel.works), address(kernel.recordings)
        );
        kernel.licenses = new LicenseRegistry420(deployer, address(kernel.profiles), address(kernel.recordings));
        kernel.schedules = new RoyaltyScheduleRegistry420(deployer);
        kernel.vault = new RoyaltyVault420(deployer, address(kernel.rights), address(kernel.profiles), deployer);
        kernel.router =
            new RoyaltyRouter420(deployer, address(kernel.recordings), address(kernel.schedules), address(kernel.vault));
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

        _registerModule(kernel.protocol, "CREATIVE_PROTOCOL_REGISTRY", address(kernel.protocol));
        _registerModule(kernel.protocol, "CREATOR_PROFILE_REGISTRY", address(kernel.profiles));
        _registerModule(kernel.protocol, "WORK_REGISTRY", address(kernel.works));
        _registerModule(kernel.protocol, "RECORDING_REGISTRY", address(kernel.recordings));
        _registerModule(kernel.protocol, "CONTRIBUTOR_REGISTRY", address(kernel.contributors));
        _registerModule(kernel.protocol, "RIGHTS_REGISTRY", address(kernel.rights));
        _registerModule(kernel.protocol, "AUTHORIZATION_REGISTRY", address(kernel.authorization));
        _registerModule(kernel.protocol, "LICENSE_REGISTRY", address(kernel.licenses));
        _registerModule(kernel.protocol, "ROYALTY_SCHEDULE_REGISTRY", address(kernel.schedules));
        _registerModule(kernel.protocol, "ROYALTY_VAULT", address(kernel.vault));
        _registerModule(kernel.protocol, "ROYALTY_ROUTER", address(kernel.router));
        vm.stopPrank();
    }

    function _registerModule(CreativeProtocolRegistry420 protocol, string memory label, address implementation) internal {
        protocol.registerModule(keccak256(bytes(label)), implementation, 1, RELEASE_MANIFEST_HASH);
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
        (fixture.workId, fixture.aliceWorkCreditId, fixture.bobWorkCreditId) = _seedWork(kernel, accounts, creators);
        (fixture.originalId, fixture.aliceRecordingCreditId, fixture.producerRecordingCreditId) =
            _seedOriginal(kernel, accounts, creators, fixture.workId);

        fixture.originalInitialSettlementId = keccak256("fixture/original/direct-sale/1");
        vm.startPrank(accounts.deployer);
        kernel.router.route{value: 100 ether}(
            fixture.originalId, RevenueType.DIRECT_SALE, fixture.originalInitialSettlementId
        );
        vm.stopPrank();

        (fixture.remixOfferId, fixture.remixLicenseId) =
            _seedLicense(kernel, accounts, creators, fixture.originalId);
        fixture.remixLicenseSettlementId = keccak256(
            abi.encode(
                "420/LICENSE",
                block.chainid,
                address(kernel.licenses),
                LicenseId.unwrap(fixture.remixLicenseId),
                fixture.remixOfferId
            )
        );
        fixture.remixId =
            _seedRemix(kernel, accounts, creators, fixture.workId, fixture.originalId, fixture.remixLicenseId);

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

    function _seedWork(Kernel memory kernel, Accounts memory accounts, Creators memory creators)
        internal
        returns (WorkId workId, bytes32 aliceCreditId, bytes32 bobCreditId)
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
        aliceCreditId =
            kernel.contributors.proposeCredit(CreativeAssetType.WORK, WorkId.unwrap(workId), creators.alice, 1, 1);
        kernel.contributors.acceptCredit(aliceCreditId);
        bobCreditId =
            kernel.contributors.proposeCredit(CreativeAssetType.WORK, WorkId.unwrap(workId), creators.bob, 1, 2);
        vm.stopPrank();
        vm.startPrank(accounts.bob);
        kernel.contributors.acceptCredit(bobCreditId);
        vm.stopPrank();
    }

    function _seedOriginal(Kernel memory kernel, Accounts memory accounts, Creators memory creators, WorkId workId)
        internal
        returns (RecordingId originalId, bytes32 aliceCreditId, bytes32 producerCreditId)
    {
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
        aliceCreditId = kernel.contributors.proposeCredit(
            CreativeAssetType.RECORDING, RecordingId.unwrap(originalId), creators.alice, 1, 101
        );
        kernel.contributors.acceptCredit(aliceCreditId);
        producerCreditId = kernel.contributors.proposeCredit(
            CreativeAssetType.RECORDING, RecordingId.unwrap(originalId), creators.producer, 1, 105
        );
        vm.stopPrank();
        vm.startPrank(accounts.producer);
        kernel.contributors.acceptCredit(producerCreditId);
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
        bytes32 originalKey =
            CreativeAssetKeys420.key(CreativeAssetType.RECORDING, RecordingId.unwrap(fixture.originalId));
        bytes32 remixKey = CreativeAssetKeys420.key(CreativeAssetType.RECORDING, RecordingId.unwrap(fixture.remixId));

        require(kernel.rights.rightsVersion(workKey) == 1, "work rightsVersion");
        require(kernel.rights.rightsVersion(originalKey) == 2, "original rightsVersion");
        require(kernel.rights.rightsVersion(remixKey) == 1, "remix rightsVersion");
        require(kernel.rights.currentShare(originalKey, CreatorId.unwrap(creators.alice)) == 6000, "alice current original");
        require(
            kernel.rights.currentShare(originalKey, CreatorId.unwrap(creators.producer)) == 3000,
            "producer current original"
        );
        require(kernel.rights.currentShare(originalKey, CreatorId.unwrap(creators.carol)) == 1000, "carol current original");

        require(kernel.vault.pool(workKey).totalReceived == 30 ether, "work pool total");
        require(kernel.vault.pool(originalKey).totalReceived == 151 ether, "original pool total");
        require(kernel.vault.pool(remixKey).totalReceived == 72.5 ether, "remix pool total");
        require(kernel.vault.treasuryClaimable() == 6.5 ether, "treasury total");
        require(address(kernel.vault).balance == 260 ether, "gross conservation");

        require(kernel.vault.pending(workKey, CreatorId.unwrap(creators.alice)) == 18 ether, "alice work");
        require(kernel.vault.pending(workKey, CreatorId.unwrap(creators.bob)) == 12 ether, "bob work");
        require(kernel.vault.pending(originalKey, CreatorId.unwrap(creators.alice)) == 102.3 ether, "alice original");
        require(
            kernel.vault.pending(originalKey, CreatorId.unwrap(creators.producer)) == 45.3 ether,
            "producer original"
        );
        require(kernel.vault.pending(originalKey, CreatorId.unwrap(creators.carol)) == 3.4 ether, "carol original");
        require(kernel.vault.pending(remixKey, CreatorId.unwrap(creators.remixer)) == 58 ether, "remixer remix");
        require(kernel.vault.pending(remixKey, CreatorId.unwrap(creators.carol)) == 14.5 ether, "carol remix");
    }

    function _writeManifest(Kernel memory kernel, Accounts memory accounts, Creators memory creators, Fixture memory fixture)
        internal
    {
        string memory key = "decision10Fixture";
        vm.serializeString(key, "schema", MANIFEST_SCHEMA);
        vm.serializeUint(key, "chainId", block.chainid);
        vm.serializeBytes32(key, "releaseManifestHash", RELEASE_MANIFEST_HASH);
        _serializeAccounts(key, accounts);
        _serializeContracts(key, kernel);
        _serializeCreators(key, creators);
        _serializeFixture(key, fixture);
        string memory json = _serializeExpected(key);
        vm.writeJson(json, MANIFEST_PATH);
    }

    function _serializeAccounts(string memory key, Accounts memory accounts) internal {
        vm.serializeAddress(key, "deployer", accounts.deployer);
        vm.serializeAddress(key, "aliceAccount", accounts.alice);
        vm.serializeAddress(key, "bobAccount", accounts.bob);
        vm.serializeAddress(key, "carolAccount", accounts.carol);
        vm.serializeAddress(key, "producerAccount", accounts.producer);
        vm.serializeAddress(key, "remixerAccount", accounts.remixer);
    }

    function _serializeContracts(string memory key, Kernel memory kernel) internal {
        vm.serializeAddress(key, "creativeProtocolRegistry", address(kernel.protocol));
        vm.serializeAddress(key, "creatorProfileRegistry", address(kernel.profiles));
        vm.serializeAddress(key, "workRegistry", address(kernel.works));
        vm.serializeAddress(key, "recordingRegistry", address(kernel.recordings));
        vm.serializeAddress(key, "contributorRegistry", address(kernel.contributors));
        vm.serializeAddress(key, "rightsRegistry", address(kernel.rights));
        vm.serializeAddress(key, "authorizationRegistry", address(kernel.authorization));
        vm.serializeAddress(key, "licenseRegistry", address(kernel.licenses));
        vm.serializeAddress(key, "royaltyScheduleRegistry", address(kernel.schedules));
        vm.serializeAddress(key, "royaltyVault", address(kernel.vault));
        vm.serializeAddress(key, "royaltyRouter", address(kernel.router));
    }

    function _serializeCreators(string memory key, Creators memory creators) internal {
        vm.serializeUint(key, "aliceCreatorId", CreatorId.unwrap(creators.alice));
        vm.serializeUint(key, "bobCreatorId", CreatorId.unwrap(creators.bob));
        vm.serializeUint(key, "carolCreatorId", CreatorId.unwrap(creators.carol));
        vm.serializeUint(key, "producerCreatorId", CreatorId.unwrap(creators.producer));
        vm.serializeUint(key, "remixerCreatorId", CreatorId.unwrap(creators.remixer));
    }

    function _serializeFixture(string memory key, Fixture memory fixture) internal {
        vm.serializeUint(key, "workId", WorkId.unwrap(fixture.workId));
        vm.serializeUint(key, "originalRecordingId", RecordingId.unwrap(fixture.originalId));
        vm.serializeUint(key, "remixOfferId", fixture.remixOfferId);
        vm.serializeUint(key, "remixLicenseId", LicenseId.unwrap(fixture.remixLicenseId));
        vm.serializeUint(key, "remixRecordingId", RecordingId.unwrap(fixture.remixId));
        vm.serializeUint(key, "rightsTransferId", fixture.rightsTransferId);
        vm.serializeUint(key, "scheduleVersion", 1);
        vm.serializeUint(key, "workRightsVersion", 1);
        vm.serializeUint(key, "originalRightsVersion", 2);
        vm.serializeUint(key, "remixRightsVersion", 1);
        vm.serializeBytes32(key, "originalInitialSettlementId", fixture.originalInitialSettlementId);
        vm.serializeBytes32(key, "remixLicenseSettlementId", fixture.remixLicenseSettlementId);
        vm.serializeBytes32(key, "remixSettlementId", fixture.remixSettlementId);
        vm.serializeBytes32(key, "originalPostTransferSettlementId", fixture.originalPostTransferSettlementId);
        vm.serializeBytes32(key, "aliceWorkCreditId", fixture.aliceWorkCreditId);
        vm.serializeBytes32(key, "bobWorkCreditId", fixture.bobWorkCreditId);
        vm.serializeBytes32(key, "aliceRecordingCreditId", fixture.aliceRecordingCreditId);
        vm.serializeBytes32(key, "producerRecordingCreditId", fixture.producerRecordingCreditId);
    }

    function _serializeExpected(string memory key) internal returns (string memory json) {
        vm.serializeString(key, "expectedWorkPoolWei", vm.toString(30 ether));
        vm.serializeString(key, "expectedOriginalPoolWei", vm.toString(151 ether));
        vm.serializeString(key, "expectedRemixPoolWei", vm.toString(72.5 ether));
        vm.serializeString(key, "expectedTreasuryWei", vm.toString(6.5 ether));
        vm.serializeString(key, "expectedVaultBalanceWei", vm.toString(260 ether));
        vm.serializeString(key, "expectedAliceWorkWei", vm.toString(18 ether));
        vm.serializeString(key, "expectedBobWorkWei", vm.toString(12 ether));
        vm.serializeString(key, "expectedAliceOriginalWei", vm.toString(102.3 ether));
        vm.serializeString(key, "expectedProducerOriginalWei", vm.toString(45.3 ether));
        vm.serializeString(key, "expectedCarolOriginalWei", vm.toString(3.4 ether));
        vm.serializeString(key, "expectedRemixerRemixWei", vm.toString(58 ether));
        json = vm.serializeString(key, "expectedCarolRemixWei", vm.toString(14.5 ether));
    }

    receive() external payable {}
}

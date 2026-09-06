// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

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

interface VmAcceptance420 {
    function deal(address who, uint256 newBalance) external;
    function prank(address msgSender) external;
    function warp(uint256 newTimestamp) external;
    function expectRevert(bytes4 revertData) external;
    function expectRevert(bytes calldata revertData) external;
}

contract CreativeKernelAcceptance420Test {
    VmAcceptance420 private constant vm =
        VmAcceptance420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant ALICE = address(0xA11CE);
    address private constant BOB = address(0xB0B);
    address private constant CAROL = address(0xCA201);
    address private constant PRODUCER = address(0xBEEF);
    address private constant REMIXER = address(0xCAFE);

    CreatorProfileRegistry420 profiles;
    WorkRegistry420 works;
    RecordingRegistry420 recordings;
    ContributorRegistry420 contributors;
    RightsRegistry420 rights;
    AuthorizationRegistry420 auth;
    LicenseRegistry420 licenses;
    RoyaltyScheduleRegistry420 schedules;
    RoyaltyVault420 vault;
    RoyaltyRouter420 router;

    CreatorId aliceId;
    CreatorId bobId;
    CreatorId carolId;
    CreatorId producerId;
    CreatorId remixerId;

    function setUp() public {
        profiles = new CreatorProfileRegistry420(address(this));
        works = new WorkRegistry420(address(this), address(profiles));
        recordings = new RecordingRegistry420(address(this), address(profiles), address(works));
        contributors = new ContributorRegistry420(address(profiles), address(works), address(recordings));
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
        vm.prank(CAROL);
        carolId = profiles.createProfile(IdentityType.INDIVIDUAL, keccak256("carol"));
        vm.prank(PRODUCER);
        producerId = profiles.createProfile(IdentityType.INDIVIDUAL, keccak256("producer"));
        vm.prank(REMIXER);
        remixerId = profiles.createProfile(IdentityType.ARTIST_PROJECT, keccak256("remixer"));

        vm.deal(address(this), 10_000 ether);
        vm.deal(ALICE, 1_000 ether);
        vm.deal(BOB, 1_000 ether);
        vm.deal(CAROL, 1_000 ether);
        vm.deal(PRODUCER, 1_000 ether);
        vm.deal(REMIXER, 1_000 ether);
    }

    function testContributorAcceptanceIsPartOfEndToEndFixture() public {
        WorkId workId = _createActiveWorkWithContributors();
        RecordingId recordingId = _createActiveOriginalWithContributors(workId);
        require(WorkId.unwrap(workId) != 0, "work missing");
        require(RecordingId.unwrap(recordingId) != 0, "recording missing");
    }

    function testRejects9999BasisPointInitialSplit() public {
        WorkId workId = _registerWorkOnly();
        uint256[] memory holders = _twoHolders(CreatorId.unwrap(aliceId), CreatorId.unwrap(bobId));
        uint16[] memory split = _twoBps(6000, 3999);
        vm.expectRevert(abi.encodeWithSelector(CreativeErrors420.InvalidSplitTotal.selector, uint256(9999)));
        vm.prank(ALICE);
        rights.proposeInitialSplit(CreativeAssetType.WORK, WorkId.unwrap(workId), holders, split);
    }

    function testRejects10001BasisPointInitialSplit() public {
        WorkId workId = _registerWorkOnly();
        uint256[] memory holders = _twoHolders(CreatorId.unwrap(aliceId), CreatorId.unwrap(bobId));
        uint16[] memory split = _twoBps(6000, 4001);
        vm.expectRevert(abi.encodeWithSelector(CreativeErrors420.InvalidSplitTotal.selector, uint256(10001)));
        vm.prank(ALICE);
        rights.proposeInitialSplit(CreativeAssetType.WORK, WorkId.unwrap(workId), holders, split);
    }

    function testFinalizedSplitCannotBeWholesaleReplacedOrDiluted() public {
        WorkId workId = _createActiveWorkWithContributors();
        uint256[] memory holders = new uint256[](1);
        uint16[] memory split = new uint16[](1);
        holders[0] = CreatorId.unwrap(aliceId);
        split[0] = 10_000;

        vm.expectRevert(CreativeErrors420.SplitAlreadyFinalized.selector);
        vm.prank(ALICE);
        rights.proposeInitialSplit(CreativeAssetType.WORK, WorkId.unwrap(workId), holders, split);

        bytes32 workKey = CreativeAssetKeys420.key(CreativeAssetType.WORK, WorkId.unwrap(workId));
        require(rights.currentShare(workKey, CreatorId.unwrap(aliceId)) == 6000, "alice diluted");
        require(rights.currentShare(workKey, CreatorId.unwrap(bobId)) == 4000, "bob diluted");
        require(rights.rightsVersion(workKey) == 1, "rights version changed");
    }

    function testRightsTransferCheckpointsOldAccrualAndAdvancesRightsVersion() public {
        WorkId workId = _createActiveWorkWithContributors();
        RecordingId originalId = _createActiveOriginalWithContributors(workId);
        _registerOriginalDirectSaleSchedule();

        bytes32 recordingKey = CreativeAssetKeys420.key(CreativeAssetType.RECORDING, RecordingId.unwrap(originalId));
        require(rights.rightsVersion(recordingKey) == 1, "initial rights version");

        router.route{value: 100 ether}(originalId, RevenueType.DIRECT_SALE, keccak256("pre-transfer-sale"));
        require(vault.pending(recordingKey, CreatorId.unwrap(aliceId)) == 59.5 ether, "alice pre-transfer accrual");
        require(vault.pending(recordingKey, CreatorId.unwrap(carolId)) == 0, "carol inherited old accrual");

        vm.prank(ALICE);
        uint256 transferId = rights.proposeTransfer(
            CreativeAssetType.RECORDING,
            RecordingId.unwrap(originalId),
            CreatorId.unwrap(aliceId),
            CreatorId.unwrap(carolId),
            1000,
            0
        );
        vm.prank(CAROL);
        rights.acceptTransfer(transferId);

        require(rights.rightsVersion(recordingKey) == 2, "rights version did not advance");
        require(rights.shareAt(recordingKey, 1, CreatorId.unwrap(aliceId)) == 7000, "v1 alice wrong");
        require(rights.shareAt(recordingKey, 1, CreatorId.unwrap(producerId)) == 3000, "v1 producer wrong");
        require(rights.shareAt(recordingKey, 1, CreatorId.unwrap(carolId)) == 0, "v1 carol wrong");
        require(rights.shareAt(recordingKey, 2, CreatorId.unwrap(aliceId)) == 6000, "v2 alice wrong");
        require(rights.shareAt(recordingKey, 2, CreatorId.unwrap(producerId)) == 3000, "v2 producer wrong");
        require(rights.shareAt(recordingKey, 2, CreatorId.unwrap(carolId)) == 1000, "v2 carol wrong");

        require(vault.pending(recordingKey, CreatorId.unwrap(aliceId)) == 59.5 ether, "old alice accrual moved");
        require(vault.pending(recordingKey, CreatorId.unwrap(carolId)) == 0, "carol received historic accrual");

        router.route{value: 100 ether}(originalId, RevenueType.DIRECT_SALE, keccak256("post-transfer-sale"));
        require(vault.pending(recordingKey, CreatorId.unwrap(aliceId)) == 110.5 ether, "alice post-transfer accrual");
        require(vault.pending(recordingKey, CreatorId.unwrap(producerId)) == 51 ether, "producer post-transfer accrual");
        require(vault.pending(recordingKey, CreatorId.unwrap(carolId)) == 8.5 ether, "carol future accrual");
    }

    function testSettlementReplayIsRejected() public {
        WorkId workId = _createActiveWorkWithContributors();
        RecordingId originalId = _createActiveOriginalWithContributors(workId);
        _registerOriginalDirectSaleSchedule();
        bytes32 settlementId = keccak256("same-settlement");

        router.route{value: 1 ether}(originalId, RevenueType.DIRECT_SALE, settlementId);
        vm.expectRevert(abi.encodeWithSelector(CreativeErrors420.RevenueAlreadyProcessed.selector, settlementId));
        router.route{value: 1 ether}(originalId, RevenueType.DIRECT_SALE, settlementId);
    }

    function testExpiredLicenseOfferCannotBeAccepted() public {
        WorkId workId = _createActiveWorkWithContributors();
        RecordingId originalId = _createActiveOriginalWithContributors(workId);
        uint64 expiry = uint64(block.timestamp + 1);

        vm.prank(ALICE);
        uint256 offerId = licenses.createRecordingOffer(
            originalId,
            CreativePermissions420.CREATE_REMIX | CreativePermissions420.USE_MASTER
                | CreativePermissions420.COMMERCIALIZE,
            0,
            0,
            expiry,
            0,
            keccak256("expiring-license")
        );
        vm.warp(uint256(expiry) + 1);

        vm.expectRevert(CreativeErrors420.LicenseExpired.selector);
        vm.prank(REMIXER);
        licenses.acceptOffer(offerId, remixerId);
    }

    function testExhaustedLicenseOfferCannotIssueAgain() public {
        WorkId workId = _createActiveWorkWithContributors();
        RecordingId originalId = _createActiveOriginalWithContributors(workId);

        vm.prank(ALICE);
        uint256 offerId = licenses.createRecordingOffer(
            originalId,
            CreativePermissions420.CREATE_REMIX | CreativePermissions420.USE_MASTER
                | CreativePermissions420.COMMERCIALIZE,
            0,
            0,
            0,
            1,
            keccak256("one-license-only")
        );

        vm.prank(REMIXER);
        licenses.acceptOffer(offerId, remixerId);

        vm.expectRevert(CreativeErrors420.LicenseExhausted.selector);
        vm.prank(CAROL);
        licenses.acceptOffer(offerId, carolId);
    }

    function testDerivativeActivationRequiresSourceAuthorization() public {
        WorkId workId = _createActiveWorkWithContributors();
        RecordingId originalId = _createActiveOriginalWithContributors(workId);
        RecordingId remixId = _registerRemixWithFinalizedRights(workId, originalId, remixerId, REMIXER);

        vm.expectRevert(CreativeErrors420.MissingAuthorization.selector);
        vm.prank(REMIXER);
        recordings.activateRecording(remixId, LicenseId.wrap(0));
    }

    function testExpiredIssuedLicenseCannotActivateDerivative() public {
        WorkId workId = _createActiveWorkWithContributors();
        RecordingId originalId = _createActiveOriginalWithContributors(workId);
        uint64 expiry = uint64(block.timestamp + 10);

        vm.prank(ALICE);
        uint256 offerId = licenses.createRecordingOffer(
            originalId,
            CreativePermissions420.CREATE_REMIX | CreativePermissions420.USE_MASTER
                | CreativePermissions420.COMMERCIALIZE,
            0,
            0,
            expiry,
            1,
            keccak256("expiring-issued-license")
        );
        vm.prank(REMIXER);
        LicenseId licenseId = licenses.acceptOffer(offerId, remixerId);
        RecordingId remixId = _registerRemixWithFinalizedRights(workId, originalId, remixerId, REMIXER);

        vm.warp(uint256(expiry) + 1);
        vm.expectRevert(CreativeErrors420.MissingAuthorization.selector);
        vm.prank(REMIXER);
        recordings.activateRecording(remixId, licenseId);
    }

    function testOneKiefRoundingRemainderGoesToCurrentRecordingNotTreasury() public {
        WorkId workId = _createActiveWorkWithContributors();
        RecordingId originalId = _createActiveOriginalWithContributors(workId);
        _registerOriginalDirectSaleSchedule();

        router.route{value: 1}(originalId, RevenueType.DIRECT_SALE, keccak256("one-kief"));

        bytes32 workKey = CreativeAssetKeys420.key(CreativeAssetType.WORK, WorkId.unwrap(workId));
        bytes32 recordingKey = CreativeAssetKeys420.key(CreativeAssetType.RECORDING, RecordingId.unwrap(originalId));
        require(vault.pool(workKey).totalReceived == 0, "work received rounded kief");
        require(vault.treasuryClaimable() == 0, "treasury captured dust");
        require(vault.pool(recordingKey).totalReceived == 1, "current did not receive remainder");
    }

    function _registerWorkOnly() internal returns (WorkId workId) {
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
    }

    function _createActiveWorkWithContributors() internal returns (WorkId workId) {
        workId = _registerWorkOnly();

        vm.prank(ALICE);
        bytes32 aliceCredit = contributors.proposeCredit(
            CreativeAssetType.WORK, WorkId.unwrap(workId), aliceId, 1, 1
        );
        vm.prank(ALICE);
        contributors.acceptCredit(aliceCredit);

        vm.prank(ALICE);
        bytes32 bobCredit = contributors.proposeCredit(
            CreativeAssetType.WORK, WorkId.unwrap(workId), bobId, 1, 1
        );
        vm.prank(BOB);
        contributors.acceptCredit(bobCredit);

        require(contributors.credit(aliceCredit).status == CreditStatus.ACCEPTED, "alice work credit not accepted");
        require(contributors.credit(bobCredit).status == CreditStatus.ACCEPTED, "bob work credit not accepted");

        uint256[] memory holders = _twoHolders(CreatorId.unwrap(aliceId), CreatorId.unwrap(bobId));
        uint16[] memory split = _twoBps(6000, 4000);
        vm.prank(ALICE);
        rights.proposeInitialSplit(CreativeAssetType.WORK, WorkId.unwrap(workId), holders, split);
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

    function _createActiveOriginalWithContributors(WorkId workId) internal returns (RecordingId originalId) {
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

        vm.prank(ALICE);
        bytes32 artistCredit = contributors.proposeCredit(
            CreativeAssetType.RECORDING, RecordingId.unwrap(originalId), aliceId, 1, 1
        );
        vm.prank(ALICE);
        contributors.acceptCredit(artistCredit);

        vm.prank(ALICE);
        bytes32 producerCredit = contributors.proposeCredit(
            CreativeAssetType.RECORDING, RecordingId.unwrap(originalId), producerId, 1, 2
        );
        vm.prank(PRODUCER);
        contributors.acceptCredit(producerCredit);

        require(contributors.credit(artistCredit).status == CreditStatus.ACCEPTED, "artist credit not accepted");
        require(contributors.credit(producerCredit).status == CreditStatus.ACCEPTED, "producer credit not accepted");

        uint256[] memory holders = _twoHolders(CreatorId.unwrap(aliceId), CreatorId.unwrap(producerId));
        uint16[] memory split = _twoBps(7000, 3000);
        vm.prank(ALICE);
        rights.proposeInitialSplit(CreativeAssetType.RECORDING, RecordingId.unwrap(originalId), holders, split);
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

    function _registerRemixWithFinalizedRights(
        WorkId workId,
        RecordingId sourceId,
        CreatorId registrantId,
        address registrantAccount
    ) internal returns (RecordingId remixId) {
        RecordingRegistration420 memory request = RecordingRegistration420({
            registrantProfileId: registrantId,
            workId: workId,
            parentRecordingId: sourceId,
            supersedesRecordingId: RecordingId.wrap(0),
            recordingClass: RecordingClass.REMIX,
            masterHash: keccak256(abi.encode("remix-master", CreatorId.unwrap(registrantId))),
            metadataHash: keccak256("remix-meta"),
            provenanceHash: keccak256("remix-prov"),
            mediaManifestHash: keccak256("remix-media"),
            authorizationManifestHash: keccak256("remix-auth"),
            provenanceClass: ProvenanceClass.NATIVE_VERIFIED,
            rightsStatus: RightsStatus.RIGHTS_VERIFIED,
            royaltyScheduleVersion: 1,
            authorizationPolicyVersion: 0
        });
        vm.prank(registrantAccount);
        remixId = recordings.registerRecording(request);

        uint256[] memory holders = new uint256[](1);
        uint16[] memory split = new uint16[](1);
        holders[0] = CreatorId.unwrap(registrantId);
        split[0] = 10_000;
        vm.prank(registrantAccount);
        rights.proposeInitialSplit(CreativeAssetType.RECORDING, RecordingId.unwrap(remixId), holders, split);
        vm.prank(registrantAccount);
        rights.acceptInitialShare(CreativeAssetType.RECORDING, RecordingId.unwrap(remixId));
        vm.prank(registrantAccount);
        rights.finalizeInitialSplit(CreativeAssetType.RECORDING, RecordingId.unwrap(remixId));
    }

    function _registerOriginalDirectSaleSchedule() internal {
        _registerSchedule(RecordingClass.ORIGINAL, RevenueType.DIRECT_SALE, 1250, 0, 8500, 250, 1);
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

    function _twoHolders(uint256 first, uint256 second) internal pure returns (uint256[] memory holders) {
        holders = new uint256[](2);
        holders[0] = first;
        holders[1] = second;
    }

    function _twoBps(uint16 first, uint16 second) internal pure returns (uint16[] memory bps) {
        bps = new uint16[](2);
        bps[0] = first;
        bps[1] = second;
    }

    receive() external payable {}
}

contract RoyaltyRouterHarness420 is RoyaltyRouter420 {
    constructor() RoyaltyRouter420(address(1), address(2), address(3), address(4)) {}

    function exposedAmounts(uint256 gross, RoyaltySchedule420 calldata schedule_)
        external
        pure
        returns (uint256 workAmount, uint256 sourceAmount, uint256 currentAmount, uint256 protocolAmount)
    {
        RouteAmounts memory amounts = _amounts(gross, schedule_);
        return (amounts.workAmount, amounts.sourceAmount, amounts.currentAmount, amounts.protocolAmount);
    }
}

contract RoyaltyAllocationFuzz420Test {
    RoyaltyRouterHarness420 private routerHarness;

    function setUp() public {
        routerHarness = new RoyaltyRouterHarness420();
    }

    function testFuzzGrossConservationOriginal(uint96 gross) public view {
        RoyaltySchedule420 memory schedule_ = RoyaltySchedule420({
            workBps: 1250,
            sourceBps: 0,
            currentRecordingBps: 8500,
            protocolBps: 250,
            version: 1,
            effectiveAt: 0,
            termsHash: bytes32(0)
        });
        (uint256 workAmount, uint256 sourceAmount, uint256 currentAmount, uint256 protocolAmount) =
            routerHarness.exposedAmounts(uint256(gross), schedule_);
        require(workAmount + sourceAmount + currentAmount + protocolAmount == uint256(gross), "original conservation");
    }

    function testFuzzGrossConservationRemix(uint96 gross) public view {
        RoyaltySchedule420 memory schedule_ = RoyaltySchedule420({
            workBps: 1000,
            sourceBps: 1500,
            currentRecordingBps: 7250,
            protocolBps: 250,
            version: 1,
            effectiveAt: 0,
            termsHash: bytes32(0)
        });
        (uint256 workAmount, uint256 sourceAmount, uint256 currentAmount, uint256 protocolAmount) =
            routerHarness.exposedAmounts(uint256(gross), schedule_);
        require(workAmount + sourceAmount + currentAmount + protocolAmount == uint256(gross), "remix conservation");
    }
}

// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/rewards/RewardIds420.sol";
import "../src/rewards/RewardAuthorization420.sol";
import "../src/rewards/ContributionRegistry420.sol";
import "../src/rewards/RewardCampaignRegistry420.sol";
import "../src/rewards/RewardPool420.sol";
import "../src/rewards/RewardDistributor420.sol";
import "../src/rewards/IRewardScorer420.sol";
import "../src/town/ITownContributionVerifier420.sol";
import "../src/town/TownRewardTypes420.sol";
import "../src/town/TownRewardsAdapter420.sol";
import "../src/review/IReviewContributionVerifier420.sol";
import "../src/review/ReviewRewardTypes420.sol";
import "../src/review/ReviewRewardsAdapter420.sol";
import "../src/ai/IAIContributionVerifier420.sol";
import "../src/ai/AIRewardTypes420.sol";
import "../src/ai/AIRewardsAdapter420.sol";

interface VmCrossDapp420 {
    function expectRevert(bytes4) external;
    function deal(address who, uint256 newBalance) external;
}

contract CrossDappCapabilities420 is ICapabilityRegistry420 {
    mapping(bytes32 => bool) internal allowed;

    function set(
        address principal,
        bytes32 componentId,
        bytes32 capabilityId,
        bytes32 scopeHash,
        uint256 amount,
        bool value
    ) external {
        allowed[keccak256(abi.encode(principal, componentId, capabilityId, scopeHash, amount))] = value;
    }

    function grant(bytes32) external pure override returns (CapabilityGrant memory capabilityGrant) {
        return capabilityGrant;
    }

    function isAuthorized(
        address principal,
        bytes32 componentId,
        bytes32 capabilityId,
        bytes32 scopeHash,
        uint256 amount
    ) external view override returns (bool) {
        return allowed[keccak256(abi.encode(principal, componentId, capabilityId, scopeHash, amount))];
    }
}

contract BoundTownVerifier420 is ITownContributionVerifier420 {
    bytes32 public sourceId;
    address public beneficiary;
    bytes32 public evidenceHash;
    bytes32 public contributionType;

    function set(bytes32 type_, bytes32 source_, address beneficiary_, bytes32 evidence_) external {
        contributionType = type_;
        sourceId = source_;
        beneficiary = beneficiary_;
        evidenceHash = evidence_;
    }

    function verifyContribution(bytes32 type_, bytes32 source_, address beneficiary_, bytes32 evidence_)
        external view returns (bool)
    {
        return type_ == contributionType && source_ == sourceId && beneficiary_ == beneficiary && evidence_ == evidenceHash;
    }
}

contract BoundReviewVerifier420 is IReviewContributionVerifier420 {
    bytes32 public sourceId;
    address public beneficiary;
    bytes32 public evidenceHash;
    bytes32 public contributionType;

    function set(bytes32 type_, bytes32 source_, address beneficiary_, bytes32 evidence_) external {
        contributionType = type_;
        sourceId = source_;
        beneficiary = beneficiary_;
        evidenceHash = evidence_;
    }

    function verifyContribution(bytes32 type_, bytes32 source_, address beneficiary_, bytes32 evidence_)
        external view returns (bool)
    {
        return type_ == contributionType && source_ == sourceId && beneficiary_ == beneficiary && evidence_ == evidenceHash;
    }
}

contract BoundAIVerifier420 is IAIContributionVerifier420 {
    bytes32 public sourceId;
    address public beneficiary;
    bytes32 public evidenceHash;
    bytes32 public contributionType;

    function set(bytes32 type_, bytes32 source_, address beneficiary_, bytes32 evidence_) external {
        contributionType = type_;
        sourceId = source_;
        beneficiary = beneficiary_;
        evidenceHash = evidence_;
    }

    function verifyContribution(bytes32 type_, bytes32 source_, address beneficiary_, bytes32 evidence_)
        external view returns (bool)
    {
        return type_ == contributionType && source_ == sourceId && beneficiary_ == beneficiary && evidence_ == evidenceHash;
    }
}

contract RevertingTownVerifier420 is ITownContributionVerifier420 {
    error VerifierFailure();
    function verifyContribution(bytes32, bytes32, address, bytes32) external pure returns (bool) {
        revert VerifierFailure();
    }
}

contract FixedScorerCrossDapp420 is IRewardScorer420 {
    uint256 public immutable amount;
    constructor(uint256 amount_) { amount = amount_; }
    function score(bytes32, bytes32, address, bytes32) external view returns (uint256) { return amount; }
}

contract RewardsCrossDappHardening420Test {
    VmCrossDapp420 constant vm = VmCrossDapp420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant USER = address(0x4201);

    CrossDappCapabilities420 caps;
    RewardAuthorization420 auth;
    ContributionRegistry420 contributions;
    RewardCampaignRegistry420 campaigns;
    RewardPool420 pool;
    RewardDistributor420 distributor;

    BoundTownVerifier420 townVerifier;
    BoundReviewVerifier420 reviewVerifier;
    BoundAIVerifier420 aiVerifier;
    TownRewardsAdapter420 town;
    ReviewRewardsAdapter420 review;
    AIRewardsAdapter420 ai;

    function setUp() public {
        caps = new CrossDappCapabilities420();
        auth = new RewardAuthorization420(address(caps));
        contributions = new ContributionRegistry420(address(auth));
        campaigns = new RewardCampaignRegistry420();
        pool = new RewardPool420(address(auth));
        distributor = new RewardDistributor420(address(contributions), address(campaigns), address(pool), address(auth));

        townVerifier = new BoundTownVerifier420();
        reviewVerifier = new BoundReviewVerifier420();
        aiVerifier = new BoundAIVerifier420();
        town = new TownRewardsAdapter420(address(contributions), address(townVerifier));
        review = new ReviewRewardsAdapter420(address(contributions), address(reviewVerifier));
        ai = new AIRewardsAdapter420(address(contributions), address(aiVerifier));

        caps.set(
            address(this),
            RewardIds420.COMPONENT_REWARDS,
            RewardIds420.ACTION_BIND_DISTRIBUTOR,
            auth.globalScope(),
            0,
            true
        );
        pool.bindDistributor(address(distributor));
        vm.deal(address(this), 100 ether);
    }

    function _grantPublish(address adapter, bytes32 appId) internal {
        caps.set(
            adapter,
            RewardIds420.COMPONENT_REWARDS,
            RewardIds420.ACTION_PUBLISH_CONTRIBUTION,
            auth.scopeForApp(appId),
            0,
            true
        );
    }

    function _prepareSameSource()
        internal
        returns (bytes32 sourceId, bytes32 evidence, bytes32 townId, bytes32 reviewId, bytes32 aiId)
    {
        sourceId = keccak256("shared-source-id");
        evidence = keccak256("shared-evidence");
        townVerifier.set(TownRewardTypes420.POST, sourceId, USER, evidence);
        reviewVerifier.set(ReviewRewardTypes420.REVIEW, sourceId, USER, evidence);
        aiVerifier.set(AIRewardTypes420.EVALUATION, sourceId, USER, evidence);
        _grantPublish(address(town), TownRewardTypes420.APP_ID);
        _grantPublish(address(review), ReviewRewardTypes420.APP_ID);
        _grantPublish(address(ai), AIRewardTypes420.APP_ID);
        townId = town.publishContribution(TownRewardTypes420.POST, sourceId, USER, evidence);
        reviewId = review.publishContribution(ReviewRewardTypes420.REVIEW, sourceId, USER, evidence);
        aiId = ai.publishContribution(AIRewardTypes420.EVALUATION, sourceId, USER, evidence);
    }

    function testPublishCapabilityIsStrictlyAppScoped() public {
        bytes32 sourceId = keccak256("cap-scope");
        bytes32 evidence = keccak256("cap-evidence");
        townVerifier.set(TownRewardTypes420.POST, sourceId, USER, evidence);
        reviewVerifier.set(ReviewRewardTypes420.REVIEW, sourceId, USER, evidence);
        aiVerifier.set(AIRewardTypes420.EVALUATION, sourceId, USER, evidence);

        _grantPublish(address(town), TownRewardTypes420.APP_ID);
        town.publishContribution(TownRewardTypes420.POST, sourceId, USER, evidence);

        vm.expectRevert(ContributionRegistry420.Unauthorized.selector);
        review.publishContribution(ReviewRewardTypes420.REVIEW, sourceId, USER, evidence);
        vm.expectRevert(ContributionRegistry420.Unauthorized.selector);
        ai.publishContribution(AIRewardTypes420.EVALUATION, sourceId, USER, evidence);
    }

    function testSameSourceAndEvidenceRemainDistinctAcrossApps() public {
        (, , bytes32 townId, bytes32 reviewId, bytes32 aiId) = _prepareSameSource();
        require(townId != reviewId && townId != aiId && reviewId != aiId, "cross-app id collision");

        ContributionRegistry420.Contribution memory tc = contributions.contribution(townId);
        ContributionRegistry420.Contribution memory rc = contributions.contribution(reviewId);
        ContributionRegistry420.Contribution memory ac = contributions.contribution(aiId);
        require(tc.nullifier != rc.nullifier && tc.nullifier != ac.nullifier && rc.nullifier != ac.nullifier, "nullifier collision");
        require(tc.appId == TownRewardTypes420.APP_ID, "town app");
        require(rc.appId == ReviewRewardTypes420.APP_ID, "review app");
        require(ac.appId == AIRewardTypes420.APP_ID, "ai app");
    }

    function testAdaptersRejectForeignContributionTypesBeforePublication() public {
        bytes32 sourceId = keccak256("foreign-type");
        bytes32 evidence = keccak256("foreign-evidence");
        _grantPublish(address(town), TownRewardTypes420.APP_ID);
        _grantPublish(address(review), ReviewRewardTypes420.APP_ID);
        _grantPublish(address(ai), AIRewardTypes420.APP_ID);

        vm.expectRevert(TownRewardsAdapter420.UnsupportedContributionType.selector);
        town.publishContribution(ReviewRewardTypes420.REVIEW, sourceId, USER, evidence);
        vm.expectRevert(ReviewRewardsAdapter420.UnsupportedContributionType.selector);
        review.publishContribution(AIRewardTypes420.EVALUATION, sourceId, USER, evidence);
        vm.expectRevert(AIRewardsAdapter420.UnsupportedContributionType.selector);
        ai.publishContribution(TownRewardTypes420.POST, sourceId, USER, evidence);
    }

    function testBeneficiaryAndEvidenceCannotBeSwappedAcrossAdapters() public {
        bytes32 sourceId = keccak256("binding-source");
        bytes32 evidence = keccak256("binding-evidence");
        townVerifier.set(TownRewardTypes420.POST, sourceId, USER, evidence);
        reviewVerifier.set(ReviewRewardTypes420.REVIEW, sourceId, USER, evidence);
        _grantPublish(address(town), TownRewardTypes420.APP_ID);
        _grantPublish(address(review), ReviewRewardTypes420.APP_ID);

        vm.expectRevert(TownRewardsAdapter420.UnverifiedContribution.selector);
        town.publishContribution(TownRewardTypes420.POST, sourceId, address(0xBEEF), evidence);
        vm.expectRevert(ReviewRewardsAdapter420.UnverifiedContribution.selector);
        review.publishContribution(ReviewRewardTypes420.REVIEW, sourceId, USER, keccak256("tampered"));
    }

    function testReplayWithinOneAppDoesNotBlockOtherApps() public {
        bytes32 sourceId = keccak256("replay-source");
        bytes32 evidence = keccak256("replay-evidence");
        townVerifier.set(TownRewardTypes420.POST, sourceId, USER, evidence);
        reviewVerifier.set(ReviewRewardTypes420.REVIEW, sourceId, USER, evidence);
        _grantPublish(address(town), TownRewardTypes420.APP_ID);
        _grantPublish(address(review), ReviewRewardTypes420.APP_ID);

        town.publishContribution(TownRewardTypes420.POST, sourceId, USER, evidence);
        vm.expectRevert(ContributionRegistry420.Replay.selector);
        town.publishContribution(TownRewardTypes420.POST, sourceId, USER, evidence);

        review.publishContribution(ReviewRewardTypes420.REVIEW, sourceId, USER, evidence);
    }

    function testRevertingVerifierLeavesRegistryUntouched() public {
        RevertingTownVerifier420 revertingVerifier = new RevertingTownVerifier420();
        TownRewardsAdapter420 revertingAdapter = new TownRewardsAdapter420(address(contributions), address(revertingVerifier));
        _grantPublish(address(revertingAdapter), TownRewardTypes420.APP_ID);

        bytes32 sourceId = keccak256("reverting-source");
        bytes32 evidence = keccak256("reverting-evidence");
        vm.expectRevert(RevertingTownVerifier420.VerifierFailure.selector);
        revertingAdapter.publishContribution(TownRewardTypes420.POST, sourceId, USER, evidence);

        townVerifier.set(TownRewardTypes420.POST, sourceId, USER, evidence);
        _grantPublish(address(town), TownRewardTypes420.APP_ID);
        town.publishContribution(TownRewardTypes420.POST, sourceId, USER, evidence);
    }

    function testWrongAppCampaignCannotConsumeContributionAndLegitimateCampaignStillCan() public {
        (, , bytes32 townId, , ) = _prepareSameSource();
        FixedScorerCrossDapp420 scorer = new FixedScorerCrossDapp420(1 ether);
        uint64 now_ = uint64(block.timestamp);

        bytes32 wrongCampaign = campaigns.createCampaign(
            ReviewRewardTypes420.APP_ID,
            TownRewardTypes420.POST,
            address(scorer),
            address(0),
            1 ether,
            2 ether,
            5 ether,
            now_,
            now_ + 1 days
        );
        campaigns.setActive(wrongCampaign, true);
        pool.fund{value: 5 ether}(wrongCampaign);

        vm.expectRevert(RewardDistributor420.Ineligible.selector);
        distributor.accrue(wrongCampaign, townId);
        require(!distributor.contributionConsumed(wrongCampaign, townId), "wrong campaign consumed");
        require(distributor.accruedByCampaign(wrongCampaign) == 0, "wrong campaign accrued");
        require(pool.reserved(wrongCampaign) == 0, "wrong campaign reserved");

        bytes32 validCampaign = campaigns.createCampaign(
            TownRewardTypes420.APP_ID,
            TownRewardTypes420.POST,
            address(scorer),
            address(0),
            1 ether,
            2 ether,
            5 ether,
            now_,
            now_ + 1 days
        );
        campaigns.setActive(validCampaign, true);
        pool.fund{value: 5 ether}(validCampaign);
        distributor.accrue(validCampaign, townId);
        require(distributor.contributionConsumed(validCampaign, townId), "valid campaign not consumed");
        require(distributor.accruedByCampaign(validCampaign) == 1 ether, "valid accrued");
        require(pool.reserved(validCampaign) == 1 ether, "valid reserve");
    }

    function testWrongTypeCampaignCannotConsumeContribution() public {
        (, , , bytes32 reviewId, ) = _prepareSameSource();
        FixedScorerCrossDapp420 scorer = new FixedScorerCrossDapp420(1 ether);
        uint64 now_ = uint64(block.timestamp);
        bytes32 campaignId = campaigns.createCampaign(
            ReviewRewardTypes420.APP_ID,
            ReviewRewardTypes420.CORRECTION,
            address(scorer),
            address(0),
            1 ether,
            2 ether,
            5 ether,
            now_,
            now_ + 1 days
        );
        campaigns.setActive(campaignId, true);
        pool.fund{value: 5 ether}(campaignId);
        vm.expectRevert(RewardDistributor420.Ineligible.selector);
        distributor.accrue(campaignId, reviewId);
        require(!distributor.contributionConsumed(campaignId, reviewId), "wrong type consumed");
        require(pool.reserved(campaignId) == 0, "wrong type reserve");
    }

    function testCampaignAccountingRemainsIsolatedAcrossDapps() public {
        (, , bytes32 townId, bytes32 reviewId, bytes32 aiId) = _prepareSameSource();
        FixedScorerCrossDapp420 scorer = new FixedScorerCrossDapp420(1 ether);
        uint64 now_ = uint64(block.timestamp);

        bytes32 townCampaign = campaigns.createCampaign(TownRewardTypes420.APP_ID, TownRewardTypes420.POST, address(scorer), address(0), 1 ether, 2 ether, 5 ether, now_, now_ + 1 days);
        bytes32 reviewCampaign = campaigns.createCampaign(ReviewRewardTypes420.APP_ID, ReviewRewardTypes420.REVIEW, address(scorer), address(0), 1 ether, 2 ether, 6 ether, now_, now_ + 1 days);
        bytes32 aiCampaign = campaigns.createCampaign(AIRewardTypes420.APP_ID, AIRewardTypes420.EVALUATION, address(scorer), address(0), 1 ether, 2 ether, 7 ether, now_, now_ + 1 days);
        campaigns.setActive(townCampaign, true);
        campaigns.setActive(reviewCampaign, true);
        campaigns.setActive(aiCampaign, true);
        pool.fund{value: 5 ether}(townCampaign);
        pool.fund{value: 6 ether}(reviewCampaign);
        pool.fund{value: 7 ether}(aiCampaign);

        distributor.accrue(townCampaign, townId);
        require(pool.reserved(townCampaign) == 1 ether, "town reserve");
        require(pool.reserved(reviewCampaign) == 0 && pool.funded(reviewCampaign) == 6 ether, "review polluted");
        require(pool.reserved(aiCampaign) == 0 && pool.funded(aiCampaign) == 7 ether, "ai polluted");

        distributor.accrue(reviewCampaign, reviewId);
        distributor.accrue(aiCampaign, aiId);
        require(distributor.accruedByCampaign(townCampaign) == 1 ether, "town accrued");
        require(distributor.accruedByCampaign(reviewCampaign) == 1 ether, "review accrued");
        require(distributor.accruedByCampaign(aiCampaign) == 1 ether, "ai accrued");
        require(pool.reserved(townCampaign) == 1 ether, "town changed");
        require(pool.reserved(reviewCampaign) == 1 ether, "review reserve");
        require(pool.reserved(aiCampaign) == 1 ether, "ai reserve");
    }

    function testSameContributionCanParticipateInIndependentMatchingCampaigns() public {
        (, , , , bytes32 aiId) = _prepareSameSource();
        FixedScorerCrossDapp420 scorer = new FixedScorerCrossDapp420(1 ether);
        uint64 now_ = uint64(block.timestamp);
        bytes32 first = campaigns.createCampaign(AIRewardTypes420.APP_ID, AIRewardTypes420.EVALUATION, address(scorer), address(0), 1 ether, 3 ether, 5 ether, now_, now_ + 1 days);
        bytes32 second = campaigns.createCampaign(AIRewardTypes420.APP_ID, AIRewardTypes420.EVALUATION, address(scorer), address(0), 1 ether, 3 ether, 5 ether, now_, now_ + 1 days);
        campaigns.setActive(first, true);
        campaigns.setActive(second, true);
        pool.fund{value: 5 ether}(first);
        pool.fund{value: 5 ether}(second);

        distributor.accrue(first, aiId);
        distributor.accrue(second, aiId);
        require(distributor.contributionConsumed(first, aiId), "first missing");
        require(distributor.contributionConsumed(second, aiId), "second missing");
        require(pool.reserved(first) == 1 ether && pool.reserved(second) == 1 ether, "campaign isolation");
    }
}

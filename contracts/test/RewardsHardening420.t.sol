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
import "../src/rewards/IRewardPolicy420.sol";

interface VmRewardsHardening420 {
    function deal(address who, uint256 newBalance) external;
    function prank(address) external;
    function expectRevert(bytes4) external;
    function warp(uint256) external;
}

contract MockRewardCapabilitiesHardening420 is ICapabilityRegistry420 {
    mapping(bytes32 => bool) private _allowed;

    function set(address principal, bytes32 componentId, bytes32 capabilityId, bytes32 scopeHash, uint256 amount, bool value) external {
        _allowed[keccak256(abi.encode(principal, componentId, capabilityId, scopeHash, amount))] = value;
    }

    function grant(bytes32) external pure override returns (CapabilityGrant memory capabilityGrant) { return capabilityGrant; }

    function isAuthorized(address principal, bytes32 componentId, bytes32 capabilityId, bytes32 scopeHash, uint256 amount) external view override returns (bool) {
        return _allowed[keccak256(abi.encode(principal, componentId, capabilityId, scopeHash, amount))];
    }
}

contract FixedRewardScorerHardening420 is IRewardScorer420 {
    uint256 public immutable amount;
    constructor(uint256 amount_) { amount = amount_; }
    function score(bytes32, bytes32, address, bytes32) external view returns (uint256) { return amount; }
}

contract ToggleRewardPolicyHardening420 is IRewardPolicy420 {
    bool public allowed = true;
    function setAllowed(bool value) external { allowed = value; }
    function isEligible(bytes32, bytes32, address, uint256) external view returns (bool) { return allowed; }
}

contract ReentrantRewardReceiverHardening420 {
    RewardDistributor420 public immutable distributor;
    bytes32 public rewardId;
    bool public attempted;
    bool public reentrySucceeded;

    constructor(address distributor_) { distributor = RewardDistributor420(distributor_); }

    function setRewardId(bytes32 rewardId_) external { rewardId = rewardId_; }

    function claim() external { distributor.claim(rewardId, address(this)); }

    receive() external payable {
        attempted = true;
        (bool ok,) = address(distributor).call(
            abi.encodeWithSelector(RewardDistributor420.claim.selector, rewardId, address(this))
        );
        reentrySucceeded = ok;
    }
}

contract RewardsHardening420Test {
    VmRewardsHardening420 constant vm = VmRewardsHardening420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant PUBLISHER = address(0x5201);
    address constant USER = address(0x5202);
    address constant USER2 = address(0x5203);
    address constant USER3 = address(0x5204);
    address constant SPONSOR = address(0x5205);
    address constant DELEGATE = address(0x5206);
    address constant UNAUTHORIZED = address(0x5207);

    bytes32 constant APP_ID = keccak256("420Town");
    bytes32 constant OTHER_APP_ID = keccak256("420Review");
    bytes32 constant POST = keccak256("POST");
    bytes32 constant REVIEW = keccak256("REVIEW");

    MockRewardCapabilitiesHardening420 caps;
    RewardAuthorization420 auth;
    ContributionRegistry420 contributions;
    RewardCampaignRegistry420 campaigns;
    RewardPool420 pool;
    RewardDistributor420 distributor;
    FixedRewardScorerHardening420 scorer;
    ToggleRewardPolicyHardening420 policy;

    function setUp() public {
        caps = new MockRewardCapabilitiesHardening420();
        auth = new RewardAuthorization420(address(caps));
        contributions = new ContributionRegistry420(address(auth));
        campaigns = new RewardCampaignRegistry420();
        pool = new RewardPool420(address(auth));
        scorer = new FixedRewardScorerHardening420(1 ether);
        policy = new ToggleRewardPolicyHardening420();
        distributor = new RewardDistributor420(address(contributions), address(campaigns), address(pool), address(auth));

        caps.set(address(this), RewardIds420.COMPONENT_REWARDS, RewardIds420.ACTION_BIND_DISTRIBUTOR, auth.globalScope(), 0, true);
        pool.bindDistributor(address(distributor));
        caps.set(PUBLISHER, RewardIds420.COMPONENT_REWARDS, RewardIds420.ACTION_PUBLISH_CONTRIBUTION, auth.scopeForApp(APP_ID), 0, true);
        vm.deal(SPONSOR, 100 ether);
    }

    function _campaign(
        bytes32 appId,
        bytes32 contributionType,
        address scorer_,
        uint256 maxPerContribution,
        uint256 maxPerAccount,
        uint256 totalBudget,
        uint256 fundAmount,
        uint64 startsAt,
        uint64 endsAt
    ) internal returns (bytes32 id) {
        vm.prank(SPONSOR);
        id = campaigns.createCampaign(
            appId,
            contributionType,
            scorer_,
            address(policy),
            maxPerContribution,
            maxPerAccount,
            totalBudget,
            startsAt,
            endsAt
        );
        if (fundAmount != 0) {
            vm.prank(SPONSOR);
            pool.fund{value: fundAmount}(id);
        }
        vm.prank(SPONSOR);
        campaigns.setActive(id, true);
    }

    function _standardCampaign() internal returns (bytes32 id) {
        return _campaign(APP_ID, POST, address(scorer), 2 ether, 10 ether, 10 ether, 10 ether, 0, type(uint64).max);
    }

    function _contributionFor(address beneficiary, bytes32 nonce) internal returns (bytes32 id) {
        vm.prank(PUBLISHER);
        id = contributions.publish(APP_ID, POST, beneficiary, keccak256(abi.encode("content", nonce)), nonce);
    }

    function testSameContributionCannotAccrueTwiceInSameCampaign() public {
        bytes32 campaignId = _standardCampaign();
        bytes32 contributionId = _contributionFor(USER, keccak256("same-campaign"));
        distributor.accrue(campaignId, contributionId);
        vm.expectRevert(RewardDistributor420.InvalidState.selector);
        distributor.accrue(campaignId, contributionId);
    }

    function testSameContributionCanAccrueAcrossIndependentCampaigns() public {
        bytes32 campaignA = _standardCampaign();
        bytes32 campaignB = _standardCampaign();
        bytes32 contributionId = _contributionFor(USER, keccak256("multi-campaign"));
        distributor.accrue(campaignA, contributionId);
        distributor.accrue(campaignB, contributionId);
        require(distributor.contributionConsumed(campaignA, contributionId), "campaign A consumed");
        require(distributor.contributionConsumed(campaignB, contributionId), "campaign B consumed");
    }

    function testCrossAppCampaignCannotRewardContribution() public {
        bytes32 campaignId = _campaign(OTHER_APP_ID, POST, address(scorer), 2 ether, 10 ether, 10 ether, 10 ether, 0, type(uint64).max);
        bytes32 contributionId = _contributionFor(USER, keccak256("cross-app"));
        vm.expectRevert(RewardDistributor420.Ineligible.selector);
        distributor.accrue(campaignId, contributionId);
    }

    function testCrossTypeCampaignCannotRewardContribution() public {
        bytes32 campaignId = _campaign(APP_ID, REVIEW, address(scorer), 2 ether, 10 ether, 10 ether, 10 ether, 0, type(uint64).max);
        bytes32 contributionId = _contributionFor(USER, keccak256("cross-type"));
        vm.expectRevert(RewardDistributor420.Ineligible.selector);
        distributor.accrue(campaignId, contributionId);
    }

    function testScorerCannotExceedPerContributionCap() public {
        FixedRewardScorerHardening420 hostileScorer = new FixedRewardScorerHardening420(3 ether);
        bytes32 campaignId = _campaign(APP_ID, POST, address(hostileScorer), 2 ether, 10 ether, 10 ether, 10 ether, 0, type(uint64).max);
        bytes32 contributionId = _contributionFor(USER, keccak256("over-cap"));
        vm.expectRevert(RewardDistributor420.CapExceeded.selector);
        distributor.accrue(campaignId, contributionId);
    }

    function testPerAccountCapExactBoundaryThenRejects() public {
        bytes32 campaignId = _campaign(APP_ID, POST, address(scorer), 1 ether, 2 ether, 10 ether, 10 ether, 0, type(uint64).max);
        distributor.accrue(campaignId, _contributionFor(USER, keccak256("acct-1")));
        distributor.accrue(campaignId, _contributionFor(USER, keccak256("acct-2")));
        require(distributor.earnedByCampaign(campaignId, USER) == 2 ether, "exact account cap");
        bytes32 third = _contributionFor(USER, keccak256("acct-3"));
        vm.expectRevert(RewardDistributor420.CapExceeded.selector);
        distributor.accrue(campaignId, third);
    }

    function testCampaignBudgetExactBoundaryThenRejects() public {
        bytes32 campaignId = _campaign(APP_ID, POST, address(scorer), 1 ether, 10 ether, 2 ether, 2 ether, 0, type(uint64).max);
        distributor.accrue(campaignId, _contributionFor(USER, keccak256("budget-1")));
        distributor.accrue(campaignId, _contributionFor(USER2, keccak256("budget-2")));
        require(distributor.accruedByCampaign(campaignId) == 2 ether, "exact budget");
        bytes32 third = _contributionFor(USER3, keccak256("budget-3"));
        vm.expectRevert(RewardDistributor420.BudgetExceeded.selector);
        distributor.accrue(campaignId, third);
    }

    function testUnderfundedReserveRevertsAtomicallyAndCanRetryAfterTopUp() public {
        bytes32 campaignId = _campaign(APP_ID, POST, address(scorer), 2 ether, 10 ether, 10 ether, 0.5 ether, 0, type(uint64).max);
        bytes32 contributionId = _contributionFor(USER, keccak256("underfunded"));
        vm.expectRevert(RewardPool420.InsufficientAvailable.selector);
        distributor.accrue(campaignId, contributionId);
        require(!distributor.contributionConsumed(campaignId, contributionId), "failed reserve rolled back consumption");
        require(distributor.accruedByCampaign(campaignId) == 0, "failed reserve rolled back accrued");

        vm.prank(SPONSOR);
        pool.fund{value: 0.5 ether}(campaignId);
        distributor.accrue(campaignId, contributionId);
        require(distributor.contributionConsumed(campaignId, contributionId), "retry succeeds");
    }

    function testCampaignTimingFailClosedBeforeAndAfterWindow() public {
        bytes32 campaignId = _campaign(APP_ID, POST, address(scorer), 2 ether, 10 ether, 10 ether, 10 ether, 100, 200);
        bytes32 beforeContribution = _contributionFor(USER, keccak256("before-window"));
        vm.warp(99);
        vm.expectRevert(RewardDistributor420.InvalidState.selector);
        distributor.accrue(campaignId, beforeContribution);

        vm.warp(150);
        distributor.accrue(campaignId, beforeContribution);

        bytes32 afterContribution = _contributionFor(USER2, keccak256("after-window"));
        vm.warp(201);
        vm.expectRevert(RewardDistributor420.InvalidState.selector);
        distributor.accrue(campaignId, afterContribution);
    }

    function testDistributorBindingIsDefaultDenyAndOneTime() public {
        RewardPool420 freshPool = new RewardPool420(address(auth));
        vm.expectRevert(RewardPool420.Unauthorized.selector);
        vm.prank(UNAUTHORIZED);
        freshPool.bindDistributor(address(distributor));

        freshPool.bindDistributor(address(distributor));
        vm.expectRevert(RewardPool420.AlreadyBound.selector);
        freshPool.bindDistributor(address(0xBEEF));
    }

    function testDelegatedClaimRequiresExplicitAccountScopeAndPaysCanonicalUser() public {
        bytes32 campaignId = _standardCampaign();
        bytes32 contributionId = _contributionFor(USER, keccak256("delegated"));
        bytes32 rewardId = distributor.accrue(campaignId, contributionId);
        caps.set(DELEGATE, RewardIds420.COMPONENT_REWARDS, RewardIds420.ACTION_CLAIM_REWARD, auth.scopeForAccount(USER), 0, true);
        uint256 beforeBalance = USER.balance;
        vm.prank(DELEGATE);
        distributor.claim(rewardId, USER);
        require(USER.balance == beforeBalance + 1 ether, "canonical beneficiary paid");
    }

    function testClaimReentrancyCannotDoublePay() public {
        ReentrantRewardReceiverHardening420 receiver = new ReentrantRewardReceiverHardening420(address(distributor));
        bytes32 campaignId = _standardCampaign();
        bytes32 contributionId = _contributionFor(address(receiver), keccak256("reentrant"));
        bytes32 rewardId = distributor.accrue(campaignId, contributionId);
        receiver.setRewardId(rewardId);

        receiver.claim();
        require(address(receiver).balance == 1 ether, "single payout only");
        require(receiver.attempted(), "reentry attempted");
        require(!receiver.reentrySucceeded(), "reentry rejected");
        RewardDistributor420.Reward memory r = distributor.reward(rewardId);
        require(uint8(r.state) == uint8(RewardDistributor420.RewardState.PAID), "terminal paid state");
        require(pool.reserved(campaignId) == 0, "reserve cleared once");
        require(pool.funded(campaignId) == 9 ether, "funding reduced once");
    }
}

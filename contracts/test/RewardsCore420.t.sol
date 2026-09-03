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

interface VmRewards420 {
    function deal(address who, uint256 newBalance) external;
    function prank(address) external;
    function expectRevert(bytes4) external;
}

contract MockRewardCapabilities420 is ICapabilityRegistry420 {
    mapping(bytes32 => bool) private _allowed;

    function set(address principal, bytes32 componentId, bytes32 capabilityId, bytes32 scopeHash, uint256 amount, bool value) external {
        _allowed[keccak256(abi.encode(principal, componentId, capabilityId, scopeHash, amount))] = value;
    }

    function grant(bytes32) external pure override returns (CapabilityGrant memory capabilityGrant) { return capabilityGrant; }

    function isAuthorized(address principal, bytes32 componentId, bytes32 capabilityId, bytes32 scopeHash, uint256 amount) external view override returns (bool) {
        return _allowed[keccak256(abi.encode(principal, componentId, capabilityId, scopeHash, amount))];
    }
}

contract FixedRewardScorer420 is IRewardScorer420 {
    uint256 public immutable amount;
    constructor(uint256 amount_) { amount = amount_; }
    function score(bytes32, bytes32, address, bytes32) external view returns (uint256) { return amount; }
}

contract AllowRewardPolicy420 is IRewardPolicy420 {
    bool public allowed = true;
    function setAllowed(bool value) external { allowed = value; }
    function isEligible(bytes32, bytes32, address, uint256) external view returns (bool) { return allowed; }
}

contract RewardsCore420Test {
    VmRewards420 constant vm = VmRewards420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant PUBLISHER = address(0x4201);
    address constant USER = address(0x4202);
    address constant SPONSOR = address(0x4203);
    bytes32 constant APP_ID = keccak256("420Town");
    bytes32 constant POST = keccak256("POST");

    MockRewardCapabilities420 caps;
    RewardAuthorization420 auth;
    ContributionRegistry420 contributions;
    RewardCampaignRegistry420 campaigns;
    RewardPool420 pool;
    RewardDistributor420 distributor;
    FixedRewardScorer420 scorer;
    AllowRewardPolicy420 policy;

    function setUp() public {
        caps = new MockRewardCapabilities420();
        auth = new RewardAuthorization420(address(caps));
        contributions = new ContributionRegistry420(address(auth));
        campaigns = new RewardCampaignRegistry420();
        pool = new RewardPool420(address(auth));
        scorer = new FixedRewardScorer420(1 ether);
        policy = new AllowRewardPolicy420();
        distributor = new RewardDistributor420(address(contributions), address(campaigns), address(pool), address(auth));

        caps.set(address(this), RewardIds420.COMPONENT_REWARDS, RewardIds420.ACTION_BIND_DISTRIBUTOR, auth.globalScope(), 0, true);
        pool.bindDistributor(address(distributor));
        caps.set(PUBLISHER, RewardIds420.COMPONENT_REWARDS, RewardIds420.ACTION_PUBLISH_CONTRIBUTION, auth.scopeForApp(APP_ID), 0, true);
        vm.deal(SPONSOR, 100 ether);
    }

    function _campaign() internal returns (bytes32 id) {
        vm.prank(SPONSOR);
        id = campaigns.createCampaign(APP_ID, POST, address(scorer), address(policy), 2 ether, 3 ether, 10 ether, 0, type(uint64).max);
        vm.prank(SPONSOR);
        pool.fund{value: 10 ether}(id);
        vm.prank(SPONSOR);
        campaigns.setActive(id, true);
    }

    function _contribution(bytes32 nonce) internal returns (bytes32 id) {
        vm.prank(PUBLISHER);
        id = contributions.publish(APP_ID, POST, USER, keccak256(abi.encode("post", nonce)), nonce);
    }

    function testPublisherDefaultsDeny() public {
        vm.expectRevert(ContributionRegistry420.Unauthorized.selector);
        contributions.publish(APP_ID, POST, USER, keccak256("x"), keccak256("n"));
    }

    function testContributionReplayDenied() public {
        bytes32 nonce = keccak256("n1");
        _contribution(nonce);
        vm.expectRevert(ContributionRegistry420.Replay.selector);
        vm.prank(PUBLISHER);
        contributions.publish(APP_ID, POST, USER, keccak256("different"), nonce);
    }

    function testAccrueAndClaim() public {
        bytes32 campaignId = _campaign();
        bytes32 contributionId = _contribution(keccak256("n2"));
        bytes32 rewardId = distributor.accrue(campaignId, contributionId);
        uint256 beforeBalance = USER.balance;
        vm.prank(USER);
        distributor.claim(rewardId, USER);
        require(USER.balance == beforeBalance + 1 ether, "reward paid");
        require(pool.funded(campaignId) == 9 ether, "funded conserved");
        require(pool.reserved(campaignId) == 0, "reserve cleared");
    }

    function testContributionCannotAccrueTwice() public {
        bytes32 campaignId = _campaign();
        bytes32 contributionId = _contribution(keccak256("n3"));
        distributor.accrue(campaignId, contributionId);
        vm.expectRevert(RewardDistributor420.InvalidState.selector);
        distributor.accrue(campaignId, contributionId);
    }

    function testPolicyCanDenyReward() public {
        bytes32 campaignId = _campaign();
        bytes32 contributionId = _contribution(keccak256("n4"));
        policy.setAllowed(false);
        vm.expectRevert(RewardDistributor420.Ineligible.selector);
        distributor.accrue(campaignId, contributionId);
    }

    function testUnauthorizedDelegatedClaimDenied() public {
        bytes32 campaignId = _campaign();
        bytes32 contributionId = _contribution(keccak256("n5"));
        bytes32 rewardId = distributor.accrue(campaignId, contributionId);
        vm.expectRevert(RewardDistributor420.Unauthorized.selector);
        distributor.claim(rewardId, USER);
    }
}

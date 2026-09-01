// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/attention/AttentionIds420.sol";
import "../src/attention/AttentionAuthorization420.sol";
import "../src/attention/AttentionConsentRegistry420.sol";
import "../src/attention/AttentionProofRegistry420.sol";
import "../src/attention/AttentionRewardRegistry420.sol";
import "../src/system/CannaseurCampaignRegistry.sol";
import "../src/system/AttentionTreasury.sol";

interface VmAttention420 {
    function deal(address who, uint256 newBalance) external;
    function prank(address) external;
    function expectRevert(bytes4) external;
}

contract MockAttentionCapabilities420 is ICapabilityRegistry420 {
    mapping(bytes32 => bool) private _allowed;

    function set(
        address principal,
        bytes32 componentId,
        bytes32 capabilityId,
        bytes32 scopeHash,
        uint256 amount,
        bool value
    ) external {
        _allowed[keccak256(abi.encode(principal, componentId, capabilityId, scopeHash, amount))] = value;
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
        return _allowed[keccak256(abi.encode(principal, componentId, capabilityId, scopeHash, amount))];
    }
}

contract AttentionGenesis420Test {
    VmAttention420 constant vm = VmAttention420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant SPONSOR = address(0x5100);
    address constant USER = address(0xA11CE);
    address constant VERIFIER = address(0xBEEF);

    MockAttentionCapabilities420 caps;
    AttentionAuthorization420 auth;
    AttentionConsentRegistry420 consent;
    CannaseurCampaignRegistry campaigns;
    AttentionTreasury treasury;
    AttentionProofRegistry420 proofs;
    AttentionRewardRegistry420 rewards;

    function setUp() public {
        caps = new MockAttentionCapabilities420();
        auth = new AttentionAuthorization420(address(caps));
        consent = new AttentionConsentRegistry420(address(auth));
        treasury = new AttentionTreasury(address(this));
        campaigns = new CannaseurCampaignRegistry(address(this));
        campaigns.bindAttentionTreasury(address(treasury));
        treasury.bindCampaignRegistry(address(campaigns));
        proofs = new AttentionProofRegistry420(address(campaigns), address(consent));
        rewards = new AttentionRewardRegistry420(address(campaigns), address(proofs), address(treasury), address(auth));
        treasury.bindRewardRegistry(address(rewards));
        vm.deal(SPONSOR, 100 ether);
    }

    function _campaign() internal returns (bytes32 id) {
        vm.prank(SPONSOR);
        id = campaigns.createCampaign(
            keccak256("meta"),
            keccak256("audience"),
            VERIFIER,
            10 ether,
            1 ether,
            3 ether,
            1,
            type(uint64).max
        );
        vm.prank(SPONSOR);
        treasury.fundCampaign{value: 10 ether}(id);
    }

    function testCampaignCannotActivateBeforeFunding() public {
        vm.prank(SPONSOR);
        bytes32 id = campaigns.createCampaign(
            keccak256("meta2"),
            keccak256("audience"),
            VERIFIER,
            10 ether,
            1 ether,
            3 ether,
            1,
            type(uint64).max
        );
        vm.expectRevert(CannaseurCampaignRegistry.InsufficientFunding.selector);
        vm.prank(SPONSOR);
        campaigns.activate(id);
    }

    function testProofRequiresConsent() public {
        bytes32 id = _campaign();
        vm.prank(SPONSOR);
        campaigns.activate(id);
        vm.expectRevert(AttentionProofRegistry420.ConsentRequired.selector);
        vm.prank(VERIFIER);
        proofs.commitProof(id, USER, 1, 1, keccak256("evidence"), keccak256("n1"));
    }

    function testProofNullifierCannotReplay() public {
        bytes32 id = _campaign();
        vm.prank(SPONSOR);
        campaigns.activate(id);
        vm.prank(USER);
        consent.setGlobal(USER, true, keccak256("policy"));
        bytes32 n = keccak256("n1");
        vm.prank(VERIFIER);
        proofs.commitProof(id, USER, 1, 1, keccak256("evidence"), n);
        vm.expectRevert(AttentionProofRegistry420.Replay.selector);
        vm.prank(VERIFIER);
        proofs.commitProof(id, USER, 1, 1, keccak256("evidence2"), n);
    }

    function testOnlyBoundVerifierCanCommit() public {
        bytes32 id = _campaign();
        vm.prank(SPONSOR);
        campaigns.activate(id);
        vm.prank(USER);
        consent.setGlobal(USER, true, keccak256("policy"));
        vm.expectRevert(AttentionProofRegistry420.UnauthorizedVerifier.selector);
        vm.prank(USER);
        proofs.commitProof(id, USER, 1, 1, keccak256("evidence"), keccak256("n1"));
    }

    function testRewardAccruesOnceAndPaysCanonicalUser() public {
        bytes32 id = _campaign();
        vm.prank(SPONSOR);
        campaigns.activate(id);
        vm.prank(USER);
        consent.setGlobal(USER, true, keccak256("policy"));
        vm.prank(VERIFIER);
        bytes32 proofId = proofs.commitProof(id, USER, 1, 2, keccak256("evidence"), keccak256("n1"));
        bytes32 rewardId = rewards.accrue(proofId);
        uint256 beforeBalance = USER.balance;
        vm.prank(USER);
        rewards.claim(rewardId, USER);
        require(USER.balance == beforeBalance + 2 ether, "reward paid");
        vm.expectRevert(AttentionRewardRegistry420.InvalidState.selector);
        vm.prank(USER);
        rewards.claim(rewardId, USER);
    }

    function testDelegatedClaimDefaultsDeny() public {
        require(!auth.isAuthorized(address(0xD1), USER, AttentionIds420.ACTION_CLAIM_REWARD), "default deny");
    }
}

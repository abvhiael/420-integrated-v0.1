// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/bet/BetAuthorization420.sol";
import "../src/bet/BetEconomics420.sol";
import "../src/bet/BetIds420.sol";
import "../src/bet/BetOperatorRegistry420.sol";
import "../src/bet/BetTypes420.sol";

interface VmBetEconomics420 {
    function prank(address) external;
    function warp(uint256) external;
    function expectRevert(bytes4) external;
}

contract MockCapabilityRegistryBetEconomics420 is ICapabilityRegistry420 {
    mapping(bytes32 => CapabilityGrant) private _grants;
    mapping(bytes32 => bool) private _allowed;

    function setAllowed(address principal, bytes32 componentId, bytes32 capabilityId, bytes32 scopeHash, bool value) external {
        _allowed[keccak256(abi.encode(principal, componentId, capabilityId, scopeHash))] = value;
    }

    function grant(bytes32 grantId) external view returns (CapabilityGrant memory) { return _grants[grantId]; }

    function isAuthorized(address principal, bytes32 componentId, bytes32 capabilityId, bytes32 scopeHash, uint256)
        external view returns (bool)
    {
        return _allowed[keccak256(abi.encode(principal, componentId, capabilityId, scopeHash))];
    }
}

contract MockBetEconomicsToken420 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
    function transfer(address to, uint256 amount) external returns (bool) {
        if (balanceOf[msg.sender] < amount) return false;
        balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true;
    }
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        if (balanceOf[from] < amount || allowance[from][msg.sender] < amount) return false;
        allowance[from][msg.sender] -= amount; balanceOf[from] -= amount; balanceOf[to] += amount; return true;
    }
}

contract BetEconomics420Test {
    VmBetEconomics420 constant vm = VmBetEconomics420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant ADMIN = address(0xA11CE);
    address constant FUNDER = address(0xF00D);
    address constant PLAYER = address(0xC0FFEE);
    address constant PROTOCOL = address(0x420);
    address constant OPERATOR_ACCOUNT = address(0x0B0B);
    address constant DELEGATE = address(0xD1E6A7E);

    bytes32 constant OPERATOR = keccak256("420BET.OPERATOR.1");
    bytes32 constant GAME_V1 = keccak256("420BET.GAME.DICE.V1");
    bytes32 constant SCHEDULE = keccak256("420BET.FEES.DICE.V1");

    struct Suite {
        MockCapabilityRegistryBetEconomics420 caps;
        BetAuthorization420 auth;
        BetOperatorRegistry420 operators;
        MockBetEconomicsToken420 token;
        BetEconomics420 economics;
    }

    function _allow(Suite memory s, address principal, bytes32 action, bytes32 scope) private {
        s.caps.setAllowed(principal, BetIds420.COMPONENT_BET, action, scope, true);
    }

    function _deploy() private returns (Suite memory s) {
        s.caps = new MockCapabilityRegistryBetEconomics420();
        s.auth = new BetAuthorization420(address(s.caps));
        s.operators = new BetOperatorRegistry420(address(s.auth));
        s.token = new MockBetEconomicsToken420();
        s.economics = new BetEconomics420(address(s.auth), address(s.operators), address(s.token));

        _allow(s, ADMIN, BetIds420.ACTION_OPERATOR_REGISTER, s.auth.scopeForOperator(OPERATOR));
        _allow(s, ADMIN, BetIds420.ACTION_OPERATOR_ACTIVATE, s.auth.scopeForOperator(OPERATOR));
        vm.prank(ADMIN); s.operators.registerOperator(OPERATOR, OPERATOR_ACCOUNT, keccak256("operator"));
        vm.prank(ADMIN); s.operators.activate(OPERATOR);
    }

    function _configure(Suite memory s, uint16 protocolBps, uint16 operatorBps) private {
        _allow(s, ADMIN, BetIds420.ACTION_ECONOMICS_CONFIGURE, s.auth.scopeForGameVersion(GAME_V1));
        vm.prank(ADMIN);
        s.economics.configureFeeSchedule(BetEconomics420.FeeSchedule({
            scheduleId: SCHEDULE,
            gameVersionId: GAME_V1,
            protocolFeeBps: protocolBps,
            operatorFeeBps: operatorBps,
            protocolRecipient: PROTOCOL,
            manifestHash: keccak256("fee-manifest"),
            exists: false
        }));
    }

    function _fund(Suite memory s, uint256 fees, uint256 rewards, uint256 promos) private {
        uint256 total = fees + rewards + promos;
        s.token.mint(FUNDER, total);
        vm.prank(FUNDER); s.token.approve(address(s.economics), total);
        _allow(s, FUNDER, BetIds420.ACTION_ECONOMICS_FUND, s.auth.scopeForAsset(address(s.token)));
        if (fees != 0) { vm.prank(FUNDER); s.economics.fundFees(fees); }
        if (rewards != 0) { vm.prank(FUNDER); s.economics.fundRewards(rewards); }
        if (promos != 0) { vm.prank(FUNDER); s.economics.fundPromotions(promos); }
        require(s.economics.accountedBalance() == s.token.balanceOf(address(s.economics)), "funding conservation");
    }

    function testFeeTermsBindImmutablyAndChargeOnlyTerminalWinLoss() public {
        Suite memory s = _deploy();
        _configure(s, 100, 200);
        _fund(s, 100 ether, 0, 0);
        bytes32 wager = keccak256("wager-1");
        _allow(s, ADMIN, BetIds420.ACTION_ECONOMICS_BIND, s.auth.scopeForGameVersion(GAME_V1));
        vm.prank(ADMIN); s.economics.bindWager(wager, GAME_V1, OPERATOR, 100 ether);
        BetEconomics420.WagerFeeBinding memory bound = s.economics.getWagerFee(wager);
        require(bound.protocolFee == 1 ether && bound.operatorFee == 2 ether, "wrong bound fees");
        require(s.economics.feeReserved() == 3 ether, "fees not reserved");

        _allow(s, ADMIN, BetIds420.ACTION_ECONOMICS_FINALIZE, s.auth.scopeForGameVersion(GAME_V1));
        vm.prank(ADMIN); s.economics.finalizeWagerFees(wager, BetTypes420.TerminalOutcome.WIN);
        require(s.economics.feeClaimable(PROTOCOL) == 1 ether, "protocol fee missing");
        require(s.economics.feeClaimable(OPERATOR_ACCOUNT) == 2 ether, "operator fee missing");
        require(s.economics.accountedBalance() == s.token.balanceOf(address(s.economics)), "fee conservation");
    }

    function testPushReleasesReservedFeesBackToPool() public {
        Suite memory s = _deploy(); _configure(s, 100, 200); _fund(s, 10 ether, 0, 0);
        bytes32 wager = keccak256("wager-push");
        _allow(s, ADMIN, BetIds420.ACTION_ECONOMICS_BIND, s.auth.scopeForGameVersion(GAME_V1));
        _allow(s, ADMIN, BetIds420.ACTION_ECONOMICS_FINALIZE, s.auth.scopeForGameVersion(GAME_V1));
        vm.prank(ADMIN); s.economics.bindWager(wager, GAME_V1, OPERATOR, 100 ether);
        vm.prank(ADMIN); s.economics.finalizeWagerFees(wager, BetTypes420.TerminalOutcome.PUSH);
        require(s.economics.feeAvailable() == 10 ether && s.economics.feeReserved() == 0, "push did not release");
    }

    function testUnfundedFeeReservationFailsClosed() public {
        Suite memory s = _deploy(); _configure(s, 100, 200);
        _allow(s, ADMIN, BetIds420.ACTION_ECONOMICS_BIND, s.auth.scopeForGameVersion(GAME_V1));
        vm.prank(ADMIN); vm.expectRevert(BetEconomics420.InsufficientFunding.selector);
        s.economics.bindWager(keccak256("unfunded"), GAME_V1, OPERATOR, 100 ether);
    }

    function testRewardPromotionPoolsRemainSeparateAndClaimsConserve() public {
        Suite memory s = _deploy(); _fund(s, 0, 50 ether, 70 ether);
        _allow(s, ADMIN, BetIds420.ACTION_REWARD_ACCRUE, s.auth.scopeGlobal());
        _allow(s, ADMIN, BetIds420.ACTION_PROMOTION_GRANT, s.auth.scopeGlobal());
        bytes32 reward = keccak256("reward"); bytes32 promo = keccak256("promo");
        vm.prank(ADMIN); s.economics.accrueReward(reward, PLAYER, 10 ether, uint64(block.timestamp + 1 days), 7, keccak256("epoch7"));
        vm.prank(ADMIN); s.economics.grantPromotion(promo, PLAYER, 20 ether, uint64(block.timestamp + 2 days), 7, keccak256("welcome"));
        require(s.economics.rewardReserved() == 10 ether && s.economics.promotionReserved() == 20 ether, "domain mix");
        uint256 custodyBefore = s.token.balanceOf(address(s.economics));
        vm.prank(PLAYER); s.economics.claim(reward);
        require(s.token.balanceOf(PLAYER) == 10 ether, "reward unpaid");
        require(s.token.balanceOf(address(s.economics)) == custodyBefore - 10 ether, "custody wrong");
        require(s.economics.accountedBalance() == s.token.balanceOf(address(s.economics)), "claim conservation");
    }

    function testExpiredPromotionReclaimsWithoutTransfer() public {
        Suite memory s = _deploy(); _fund(s, 0, 0, 25 ether);
        _allow(s, ADMIN, BetIds420.ACTION_PROMOTION_GRANT, s.auth.scopeGlobal());
        bytes32 promo = keccak256("expiring");
        vm.prank(ADMIN); s.economics.grantPromotion(promo, PLAYER, 10 ether, uint64(block.timestamp + 10), 1, keccak256("source"));
        vm.warp(block.timestamp + 11);
        s.economics.reclaimExpired(promo);
        require(s.economics.promotionAvailable() == 25 ether && s.economics.promotionReserved() == 0, "reclaim wrong");
        require(s.token.balanceOf(PLAYER) == 0, "expired promo transferred");
    }

    function testDelegatedClaimRequiresPlayerScopedCapability() public {
        Suite memory s = _deploy(); _fund(s, 0, 20 ether, 0);
        _allow(s, ADMIN, BetIds420.ACTION_REWARD_ACCRUE, s.auth.scopeGlobal());
        bytes32 reward = keccak256("delegated");
        vm.prank(ADMIN); s.economics.accrueReward(reward, PLAYER, 5 ether, uint64(block.timestamp + 1 days), 2, keccak256("source"));
        vm.prank(DELEGATE); vm.expectRevert(BetEconomics420.Unauthorized.selector); s.economics.claim(reward);
        _allow(s, DELEGATE, BetIds420.ACTION_CLAIM_REWARD, s.auth.scopeForPlayer(PLAYER));
        vm.prank(DELEGATE); s.economics.claim(reward);
        require(s.token.balanceOf(PLAYER) == 5 ether, "delegated claim wrong recipient");
    }
}

// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/bet/BetAuthorization420.sol";
import "../src/bet/BetEmergencyState420.sol";
import "../src/bet/BetIds420.sol";
import "../src/bet/BetTypes420.sol";
import "../src/bet/SettlementEngine420.sol";

interface VmBetTerminalPath420 {
    function prank(address) external;
    function warp(uint256) external;
    function expectRevert(bytes4) external;
}

contract MockCapabilityRegistryTerminal420 is ICapabilityRegistry420 {
    mapping(bytes32 => bool) private _allowed;

    function setAllowed(address principal, bytes32 componentId, bytes32 capabilityId, bytes32 scopeHash, bool value) external {
        _allowed[keccak256(abi.encode(principal, componentId, capabilityId, scopeHash))] = value;
    }

    function grant(bytes32) external pure returns (CapabilityGrant memory g) { return g; }

    function isAuthorized(address principal, bytes32 componentId, bytes32 capabilityId, bytes32 scopeHash, uint256)
        external view returns (bool)
    {
        return _allowed[keccak256(abi.encode(principal, componentId, capabilityId, scopeHash))];
    }
}

contract MockTerminalRegistry420 {
    BetTypes420.Wager private _wager;
    BetTypes420.Settlement private _settlement;

    function setWager(BetTypes420.Wager calldata wager_) external { _wager = wager_; }

    function getWager(bytes32 wagerId) external view returns (BetTypes420.Wager memory wager) {
        require(_wager.wagerId == wagerId, "wager");
        return _wager;
    }

    function settlementExists(bytes32 wagerId) external view returns (bool) {
        return _settlement.wagerId == wagerId;
    }

    function getSettlement(bytes32 wagerId) external view returns (BetTypes420.Settlement memory settlement) {
        require(_settlement.wagerId == wagerId, "settlement");
        return _settlement;
    }

    function recordSettlement(bytes32 wagerId, BetTypes420.TerminalOutcome outcome, uint256 grossPayout)
        external returns (bool)
    {
        require(_settlement.wagerId == bytes32(0), "already");
        _settlement = BetTypes420.Settlement(wagerId, outcome, grossPayout, uint64(block.timestamp));
        _wager.status = outcome == BetTypes420.TerminalOutcome.VOID
            ? BetTypes420.WagerStatus.VOID
            : BetTypes420.WagerStatus.SETTLED;
        return true;
    }
}

contract MockTerminalRisk420 {
    bool public released;
    uint256 public liability = 400 ether;

    function releaseExposure(bytes32) external returns (uint256) {
        require(!released, "released");
        released = true;
        return liability;
    }
}

contract MockTerminalVault420 {
    bytes32 public immutable vaultId;
    address public immutable asset;
    bool public resolved;
    uint256 public payout;

    constructor(bytes32 vaultId_, address asset_) {
        vaultId = vaultId_;
        asset = asset_;
    }

    function resolveWager(bytes32, uint256 grossPayout) external {
        require(!resolved, "resolved");
        resolved = true;
        payout = grossPayout;
    }
}

contract MockTerminalEconomics420 {
    bool public finalized;
    bool public shouldRevert;
    BetTypes420.TerminalOutcome public outcome;

    function setShouldRevert(bool value) external { shouldRevert = value; }

    function finalizeWagerFees(bytes32, BetTypes420.TerminalOutcome outcome_) external {
        if (shouldRevert) revert("economics");
        require(!finalized, "finalized");
        finalized = true;
        outcome = outcome_;
    }
}

contract BetTerminalPathInvariant420Test {
    VmBetTerminalPath420 constant vm = VmBetTerminalPath420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant ADMIN = address(0xA11CE);
    address constant SETTLER = address(0x5151);
    address constant RESCUER = address(0xBEEF);
    address constant PLAYER = address(0xC0FFEE);
    address constant ASSET = address(0xCA0C);
    bytes32 constant VAULT = keccak256("terminal/vault");
    bytes32 constant WAGER = keccak256("terminal/wager");
    bytes32 constant GAME = keccak256("terminal/game");
    bytes32 constant GAME_V1 = keccak256("terminal/game/v1");
    bytes32 constant SETTLEMENT_PROFILE = keccak256("terminal/settlement");

    struct Suite {
        MockCapabilityRegistryTerminal420 caps;
        BetAuthorization420 auth;
        MockTerminalRegistry420 registry;
        MockTerminalRisk420 risk;
        MockTerminalVault420 vault;
        MockTerminalEconomics420 economics;
        BetEmergencyState420 emergency;
        SettlementEngine420 engine;
        uint64 deadline;
    }

    function _allow(Suite memory s, address principal, bytes32 action, bytes32 scope) private {
        s.caps.setAllowed(principal, BetIds420.COMPONENT_BET, action, scope, true);
    }

    function _deploy() private returns (Suite memory s) {
        s.caps = new MockCapabilityRegistryTerminal420();
        s.auth = new BetAuthorization420(address(s.caps));
        s.registry = new MockTerminalRegistry420();
        s.risk = new MockTerminalRisk420();
        s.vault = new MockTerminalVault420(VAULT, ASSET);
        s.economics = new MockTerminalEconomics420();
        s.emergency = new BetEmergencyState420(address(s.auth));
        s.engine = new SettlementEngine420(
            address(s.auth), address(s.registry), address(s.risk), address(s.vault), address(s.economics)
        );
        s.deadline = uint64(block.timestamp + 1 hours);

        s.registry.setWager(BetTypes420.Wager({
            wagerId: WAGER,
            player: PLAYER,
            operatorId: keccak256("operator"),
            gameId: GAME,
            gameVersionId: GAME_V1,
            asset: ASSET,
            stake: 100 ether,
            maxGrossPayout: 500 ether,
            paramsHash: keccak256("params"),
            vaultId: VAULT,
            randomnessProfileId: keccak256("randomness"),
            riskProfileId: keccak256("risk"),
            settlementProfileId: SETTLEMENT_PROFILE,
            accessPolicyId: keccak256("access"),
            rulesetId: keccak256("ruleset"),
            acceptedAt: uint64(block.timestamp),
            deadline: s.deadline,
            status: BetTypes420.WagerStatus.ACCEPTED
        }));

        _allow(s, SETTLER, BetIds420.ACTION_SETTLE, s.auth.scopeForWager(WAGER));
        _allow(s, ADMIN, BetIds420.ACTION_EMERGENCY_SET, s.auth.scopeGlobal());
        vm.prank(ADMIN);
        s.engine.bindEmergencyState(address(s.emergency));
    }

    function _haltSettlement(Suite memory s) private {
        _allow(
            s,
            ADMIN,
            BetIds420.ACTION_EMERGENCY_SET,
            s.auth.scopeForEmergency(BetTypes420.EmergencyDomain.SETTLEMENT_HOLD, SETTLEMENT_PROFILE)
        );
        vm.prank(ADMIN);
        s.emergency.setEmergency(BetTypes420.EmergencyDomain.SETTLEMENT_HOLD, SETTLEMENT_PROFILE, true);
    }

    function testAuthorizedTerminalSettlementBeforeDeadline() public {
        Suite memory s = _deploy();
        vm.prank(SETTLER);
        s.engine.settle(WAGER, BetTypes420.TerminalOutcome.WIN, 500 ether);

        BetTypes420.Settlement memory settlement = s.registry.getSettlement(WAGER);
        require(settlement.outcome == BetTypes420.TerminalOutcome.WIN, "outcome");
        require(s.risk.released(), "risk");
        require(s.vault.resolved(), "vault");
        require(s.vault.payout() == 500 ether, "payout");
        require(s.economics.finalized(), "economics");
    }

    function testSuccessfulSettlementRetryIsSideEffectFree() public {
        Suite memory s = _deploy();
        vm.prank(SETTLER);
        BetTypes420.Settlement memory first = s.engine.settle(WAGER, BetTypes420.TerminalOutcome.WIN, 500 ether);

        vm.prank(SETTLER);
        BetTypes420.Settlement memory retry = s.engine.settle(WAGER, BetTypes420.TerminalOutcome.WIN, 500 ether);

        require(retry.wagerId == first.wagerId, "retry wager");
        require(retry.outcome == first.outcome, "retry outcome");
        require(retry.grossPayout == first.grossPayout, "retry payout");
        require(s.risk.released(), "risk lost");
        require(s.vault.resolved(), "vault lost");
        require(s.vault.payout() == 500 ether, "payout changed");
        require(s.economics.finalized(), "economics lost");
    }

    function testNonVoidSettlementCannotCrossDeadline() public {
        Suite memory s = _deploy();
        vm.warp(s.deadline);

        vm.prank(SETTLER);
        vm.expectRevert(SettlementEngine420.WagerExpired.selector);
        s.engine.settle(WAGER, BetTypes420.TerminalOutcome.WIN, 500 ether);

        require(!s.registry.settlementExists(WAGER), "settled");
        require(!s.risk.released(), "risk changed");
        require(!s.vault.resolved(), "vault changed");
        require(!s.economics.finalized(), "economics changed");
    }

    function testPermissionlessExpiredVoidIsDeterministicAndComplete() public {
        Suite memory s = _deploy();
        vm.warp(s.deadline);

        vm.prank(RESCUER);
        s.engine.voidExpired(WAGER);

        BetTypes420.Settlement memory settlement = s.registry.getSettlement(WAGER);
        require(settlement.outcome == BetTypes420.TerminalOutcome.VOID, "not void");
        require(settlement.grossPayout == 100 ether, "not stake refund");
        require(s.risk.released(), "risk remains");
        require(s.vault.resolved(), "escrow remains");
        require(s.vault.payout() == 100 ether, "refund wrong");
        require(s.economics.finalized(), "fees remain reserved");
        require(s.economics.outcome() == BetTypes420.TerminalOutcome.VOID, "fee outcome");
    }

    function testSettlementHoldBlocksEconomicOutcomeButNeverExpiredVoid() public {
        Suite memory s = _deploy();
        _haltSettlement(s);

        vm.prank(SETTLER);
        vm.expectRevert(SettlementEngine420.EmergencyHalted.selector);
        s.engine.settle(WAGER, BetTypes420.TerminalOutcome.WIN, 500 ether);
        require(!s.registry.settlementExists(WAGER), "hold settled wager");

        vm.warp(s.deadline);
        vm.prank(RESCUER);
        s.engine.voidExpired(WAGER);

        BetTypes420.Settlement memory settlement = s.registry.getSettlement(WAGER);
        require(settlement.outcome == BetTypes420.TerminalOutcome.VOID, "hold blocked void");
        require(settlement.grossPayout == 100 ether, "hold refund wrong");
        require(s.risk.released(), "hold stranded risk");
        require(s.vault.resolved(), "hold stranded escrow");
        require(s.economics.finalized(), "hold stranded fees");
    }

    function testExpiredVoidCannotBeTriggeredEarly() public {
        Suite memory s = _deploy();
        vm.prank(RESCUER);
        vm.expectRevert(SettlementEngine420.WagerNotExpired.selector);
        s.engine.voidExpired(WAGER);
        require(!s.registry.settlementExists(WAGER), "settled");
    }

    function testExactlyOneTerminalOutcomeWins() public {
        Suite memory s = _deploy();
        vm.warp(s.deadline);
        vm.prank(RESCUER);
        s.engine.voidExpired(WAGER);

        vm.prank(SETTLER);
        vm.expectRevert(SettlementEngine420.SettlementConflict.selector);
        s.engine.settle(WAGER, BetTypes420.TerminalOutcome.WIN, 500 ether);

        BetTypes420.Settlement memory settlement = s.registry.getSettlement(WAGER);
        require(settlement.outcome == BetTypes420.TerminalOutcome.VOID, "terminal changed");
        require(settlement.grossPayout == 100 ether, "payout changed");
    }

    function testDownstreamFailureRollsBackEntireTerminalTransition() public {
        Suite memory s = _deploy();
        s.economics.setShouldRevert(true);
        vm.warp(s.deadline);

        vm.prank(RESCUER);
        vm.expectRevert(bytes4(keccak256("Error(string)")));
        s.engine.voidExpired(WAGER);

        require(!s.registry.settlementExists(WAGER), "registry partially committed");
        require(!s.risk.released(), "risk partially released");
        require(!s.vault.resolved(), "vault partially resolved");
        require(!s.economics.finalized(), "economics partially finalized");
    }
}

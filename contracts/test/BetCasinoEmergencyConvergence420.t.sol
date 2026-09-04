// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/bet/BetAuthorization420.sol";
import "../src/bet/BetEmergencyState420.sol";
import "../src/bet/BetIds420.sol";
import "../src/bet/BetTypes420.sol";
import "../src/bet/SettlementEngine420.sol";

interface VmBetCasinoEmergency420 {
    function prank(address) external;
    function warp(uint256) external;
    function expectRevert(bytes4) external;
}

contract MockCapabilityRegistryCasinoEmergency420 is ICapabilityRegistry420 {
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

contract MockCasinoEmergencyRegistry420 {
    BetTypes420.Wager private _wager;
    BetTypes420.Settlement private _settlement;

    function setWager(BetTypes420.Wager calldata wager_) external { _wager = wager_; }
    function getWager(bytes32 wagerId) external view returns (BetTypes420.Wager memory wager) {
        require(_wager.wagerId == wagerId, "wager");
        return _wager;
    }
    function settlementExists(bytes32 wagerId) external view returns (bool) { return _settlement.wagerId == wagerId; }
    function getSettlement(bytes32 wagerId) external view returns (BetTypes420.Settlement memory settlement) {
        require(_settlement.wagerId == wagerId, "settlement");
        return _settlement;
    }
    function recordSettlement(bytes32 wagerId, BetTypes420.TerminalOutcome outcome, uint256 grossPayout) external returns (bool) {
        require(_settlement.wagerId == bytes32(0), "already");
        _settlement = BetTypes420.Settlement(wagerId, outcome, grossPayout, uint64(block.timestamp));
        _wager.status = outcome == BetTypes420.TerminalOutcome.VOID ? BetTypes420.WagerStatus.VOID : BetTypes420.WagerStatus.SETTLED;
        return true;
    }
}

contract MockCasinoEmergencyRisk420 {
    bool public released;
    function releaseExposure(bytes32) external returns (uint256) {
        require(!released, "released");
        released = true;
        return 400 ether;
    }
}

contract MockCasinoEmergencyVault420 {
    bytes32 public immutable vaultId;
    address public immutable asset;
    bool public resolved;
    uint256 public payout;
    constructor(bytes32 vaultId_, address asset_) { vaultId = vaultId_; asset = asset_; }
    function resolveWager(bytes32, uint256 grossPayout) external {
        require(!resolved, "resolved");
        resolved = true;
        payout = grossPayout;
    }
}

contract MockCasinoEmergencyEconomics420 {
    bool public finalized;
    BetTypes420.TerminalOutcome public outcome;
    function finalizeWagerFees(bytes32, BetTypes420.TerminalOutcome outcome_) external {
        require(!finalized, "finalized");
        finalized = true;
        outcome = outcome_;
    }
}

contract BetCasinoEmergencyConvergence420Test {
    VmBetCasinoEmergency420 constant vm = VmBetCasinoEmergency420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant ADMIN = address(0xA11CE);
    address constant SETTLER = address(0x5151);
    address constant RESCUER = address(0xBEEF);
    address constant PLAYER = address(0xC0FFEE);
    address constant ASSET = address(0xCA0C);
    bytes32 constant VAULT = keccak256("casino/emergency/vault");

    bytes32 constant DICE_V1 = keccak256("420BET.GAME.DICE.V1");
    bytes32 constant KENO_V1 = keccak256("420BET.GAME.KENO.V1");
    bytes32 constant PLINKO_V1 = keccak256("420BET.GAME.PLINKO.V1");
    bytes32 constant SLOT_V1 = keccak256("420BET.GAME.SLOT.REFERENCE.V1");
    bytes32 constant ROULETTE_V1 = keccak256("420BET.GAME.ROULETTE.V1");
    bytes32 constant BLACKJACK_V1 = keccak256("420BET.GAME.BLACKJACK.V1");

    struct Suite {
        MockCapabilityRegistryCasinoEmergency420 caps;
        BetAuthorization420 auth;
        BetEmergencyState420 emergency;
        MockCasinoEmergencyRegistry420 registry;
        MockCasinoEmergencyRisk420 risk;
        MockCasinoEmergencyVault420 vault;
        MockCasinoEmergencyEconomics420 economics;
        SettlementEngine420 engine;
        bytes32 wagerId;
        bytes32 settlementProfile;
        uint64 deadline;
    }

    function _versions() private pure returns (bytes32[6] memory versions) {
        versions = [DICE_V1, KENO_V1, PLINKO_V1, SLOT_V1, ROULETTE_V1, BLACKJACK_V1];
    }

    function _allow(Suite memory s, address principal, bytes32 action, bytes32 scope) private {
        s.caps.setAllowed(principal, BetIds420.COMPONENT_BET, action, scope, true);
    }

    function _deploy(bytes32 gameVersionId, uint256 nonce) private returns (Suite memory s) {
        s.caps = new MockCapabilityRegistryCasinoEmergency420();
        s.auth = new BetAuthorization420(address(s.caps));
        s.emergency = new BetEmergencyState420(address(s.auth));
        s.registry = new MockCasinoEmergencyRegistry420();
        s.risk = new MockCasinoEmergencyRisk420();
        s.vault = new MockCasinoEmergencyVault420(VAULT, ASSET);
        s.economics = new MockCasinoEmergencyEconomics420();
        s.engine = new SettlementEngine420(address(s.auth), address(s.registry), address(s.risk), address(s.vault), address(s.economics));
        s.wagerId = keccak256(abi.encode("casino/emergency/wager", gameVersionId, nonce));
        s.settlementProfile = keccak256(abi.encode("casino/emergency/settlement", gameVersionId));
        s.deadline = uint64(block.timestamp + 1 hours);

        s.registry.setWager(BetTypes420.Wager({
            wagerId: s.wagerId,
            player: PLAYER,
            operatorId: keccak256("operator"),
            gameId: keccak256(abi.encode("game", gameVersionId)),
            gameVersionId: gameVersionId,
            asset: ASSET,
            stake: 100 ether,
            maxGrossPayout: 500 ether,
            paramsHash: keccak256(abi.encode("params", gameVersionId)),
            vaultId: VAULT,
            randomnessProfileId: keccak256(abi.encode("randomness", gameVersionId)),
            riskProfileId: keccak256(abi.encode("risk", gameVersionId)),
            settlementProfileId: s.settlementProfile,
            accessPolicyId: keccak256(abi.encode("access", gameVersionId)),
            rulesetId: keccak256(abi.encode("ruleset", gameVersionId)),
            acceptedAt: uint64(block.timestamp),
            deadline: s.deadline,
            status: BetTypes420.WagerStatus.ACCEPTED
        }));

        _allow(s, SETTLER, BetIds420.ACTION_SETTLE, s.auth.scopeForWager(s.wagerId));
        _allow(s, ADMIN, BetIds420.ACTION_EMERGENCY_SET, s.auth.scopeGlobal());
        _allow(
            s,
            ADMIN,
            BetIds420.ACTION_EMERGENCY_SET,
            s.auth.scopeForEmergency(BetTypes420.EmergencyDomain.SETTLEMENT_HOLD, s.settlementProfile)
        );

        vm.prank(ADMIN);
        s.engine.bindEmergencyState(address(s.emergency));
    }

    function _haltSettlement(Suite memory s) private {
        vm.prank(ADMIN);
        s.emergency.setEmergency(BetTypes420.EmergencyDomain.SETTLEMENT_HOLD, s.settlementProfile, true);
    }

    function testSettlementHoldBlocksEconomicOutcomeAcrossCasinoGames() public {
        bytes32[6] memory versions = _versions();
        for (uint256 i = 0; i < versions.length; ++i) {
            Suite memory s = _deploy(versions[i], i);
            _haltSettlement(s);

            vm.prank(SETTLER);
            vm.expectRevert(SettlementEngine420.EmergencyHalted.selector);
            s.engine.settle(s.wagerId, BetTypes420.TerminalOutcome.WIN, 500 ether);

            require(!s.registry.settlementExists(s.wagerId), "settlement leaked");
            require(!s.risk.released(), "risk leaked");
            require(!s.vault.resolved(), "vault leaked");
            require(!s.economics.finalized(), "economics leaked");
        }
    }

    function testSettlementHoldNeverStrandsExpiredVoidAcrossCasinoGames() public {
        bytes32[6] memory versions = _versions();
        for (uint256 i = 0; i < versions.length; ++i) {
            Suite memory s = _deploy(versions[i], i + 100);
            _haltSettlement(s);
            vm.warp(s.deadline);

            vm.prank(RESCUER);
            BetTypes420.Settlement memory settlement = s.engine.voidExpired(s.wagerId);

            require(settlement.outcome == BetTypes420.TerminalOutcome.VOID, "not void");
            require(settlement.grossPayout == 100 ether, "wrong refund");
            require(s.risk.released(), "risk stranded");
            require(s.vault.resolved(), "vault stranded");
            require(s.vault.payout() == 100 ether, "refund stranded");
            require(s.economics.finalized(), "economics stranded");
            require(s.economics.outcome() == BetTypes420.TerminalOutcome.VOID, "wrong fee outcome");
        }
    }

    function testEmergencyKeysAreDomainSeparatedForGameAndVersion() public {
        Suite memory s = _deploy(DICE_V1, 999);
        bytes32 gameId = keccak256(abi.encode("game", DICE_V1));
        bytes32 gameKey = s.emergency.emergencyKey(BetTypes420.EmergencyDomain.GAME, gameId);
        bytes32 versionKey = s.emergency.emergencyKey(BetTypes420.EmergencyDomain.GAME_VERSION, DICE_V1);
        bytes32 settlementKey = s.emergency.emergencyKey(BetTypes420.EmergencyDomain.SETTLEMENT_HOLD, s.settlementProfile);

        require(gameKey != versionKey, "game/version collision");
        require(gameKey != settlementKey, "game/settlement collision");
        require(versionKey != settlementKey, "version/settlement collision");
    }
}

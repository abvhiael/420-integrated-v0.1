// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/bet/BetAuthorization420.sol";
import "../src/bet/BetIds420.sol";
import "../src/bet/BetTypes420.sol";
import "../src/bet/SettlementEngine420.sol";

interface VmBetCasinoSettlement420 { function prank(address) external; function expectRevert(bytes4) external; }

contract MockCapabilityRegistryCasinoSettlement420 is ICapabilityRegistry420 {
    mapping(bytes32 => bool) private _allowed;
    function setAllowed(address principal, bytes32 componentId, bytes32 capabilityId, bytes32 scopeHash, bool value) external { _allowed[keccak256(abi.encode(principal, componentId, capabilityId, scopeHash))] = value; }
    function grant(bytes32) external pure returns (CapabilityGrant memory g) { return g; }
    function isAuthorized(address principal, bytes32 componentId, bytes32 capabilityId, bytes32 scopeHash, uint256) external view returns (bool) { return _allowed[keccak256(abi.encode(principal, componentId, capabilityId, scopeHash))]; }
}

contract MockCasinoSettlementRegistry420 {
    BetTypes420.Wager private _wager; BetTypes420.Settlement private _settlement;
    function setWager(BetTypes420.Wager calldata wager_) external { _wager = wager_; }
    function getWager(bytes32 wagerId) external view returns (BetTypes420.Wager memory wager) { require(_wager.wagerId == wagerId, "wager"); return _wager; }
    function settlementExists(bytes32 wagerId) external view returns (bool) { return _settlement.wagerId == wagerId; }
    function getSettlement(bytes32 wagerId) external view returns (BetTypes420.Settlement memory settlement) { require(_settlement.wagerId == wagerId, "settlement"); return _settlement; }
    function recordSettlement(bytes32 wagerId, BetTypes420.TerminalOutcome outcome, uint256 grossPayout) external returns (bool) {
        require(_settlement.wagerId == bytes32(0), "already");
        _settlement = BetTypes420.Settlement(wagerId, outcome, grossPayout, uint64(block.timestamp));
        _wager.status = outcome == BetTypes420.TerminalOutcome.VOID ? BetTypes420.WagerStatus.VOID : BetTypes420.WagerStatus.SETTLED;
        return true;
    }
}
contract MockCasinoSettlementRisk420 { bool public released; function releaseExposure(bytes32) external returns (uint256) { require(!released, "released"); released = true; return 400 ether; } }
contract MockCasinoSettlementVault420 {
    bytes32 public immutable vaultId; address public immutable asset; bool public resolved; uint256 public payout;
    constructor(bytes32 vaultId_, address asset_) { vaultId = vaultId_; asset = asset_; }
    function resolveWager(bytes32, uint256 grossPayout) external { require(!resolved, "resolved"); resolved = true; payout = grossPayout; }
}
contract MockCasinoSettlementEconomics420 { bool public finalized; function finalizeWagerFees(bytes32, BetTypes420.TerminalOutcome) external { require(!finalized, "finalized"); finalized = true; } }

contract BetCasinoSettlementInvariant420Test {
    VmBetCasinoSettlement420 constant vm = VmBetCasinoSettlement420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant SETTLER = address(0x5151); address constant PLAYER = address(0xC0FFEE); address constant ASSET = address(0xCA0C);
    bytes32 constant VAULT = keccak256("casino/convergence/vault"); bytes32 constant SETTLEMENT_PROFILE = keccak256("casino/convergence/settlement");
    bytes32 constant DICE_V1 = keccak256("420BET.GAME.DICE.V1"); bytes32 constant KENO_V1 = keccak256("420BET.GAME.KENO.V1");
    bytes32 constant PLINKO_V1 = keccak256("420BET.GAME.PLINKO.V1"); bytes32 constant SLOT_V1 = keccak256("420BET.GAME.SLOT.REFERENCE.V1");
    bytes32 constant ROULETTE_V1 = keccak256("420BET.GAME.ROULETTE.V1"); bytes32 constant BLACKJACK_V1 = keccak256("420BET.GAME.BLACKJACK.V1");
    bytes32 constant MINES_V1 = keccak256("420BET.GAME.MINES.V1");

    struct Suite { MockCapabilityRegistryCasinoSettlement420 caps; BetAuthorization420 auth; MockCasinoSettlementRegistry420 registry; MockCasinoSettlementRisk420 risk; MockCasinoSettlementVault420 vault; MockCasinoSettlementEconomics420 economics; SettlementEngine420 engine; bytes32 wagerId; }

    function _deploy(bytes32 gameVersionId, uint256 nonce) private returns (Suite memory s) {
        s.caps = new MockCapabilityRegistryCasinoSettlement420(); s.auth = new BetAuthorization420(address(s.caps)); s.registry = new MockCasinoSettlementRegistry420();
        s.risk = new MockCasinoSettlementRisk420(); s.vault = new MockCasinoSettlementVault420(VAULT, ASSET); s.economics = new MockCasinoSettlementEconomics420();
        s.engine = new SettlementEngine420(address(s.auth), address(s.registry), address(s.risk), address(s.vault), address(s.economics));
        s.wagerId = keccak256(abi.encode("casino/convergence/wager", gameVersionId, nonce));
        s.registry.setWager(BetTypes420.Wager({wagerId:s.wagerId, player:PLAYER, operatorId:keccak256("operator"), gameId:keccak256(abi.encode("game", gameVersionId)), gameVersionId:gameVersionId, asset:ASSET, stake:100 ether, maxGrossPayout:500 ether, paramsHash:keccak256(abi.encode("params", gameVersionId)), vaultId:VAULT, randomnessProfileId:keccak256("randomness"), riskProfileId:keccak256("risk"), settlementProfileId:SETTLEMENT_PROFILE, accessPolicyId:keccak256("access"), rulesetId:keccak256(abi.encode("ruleset", gameVersionId)), acceptedAt:uint64(block.timestamp), deadline:uint64(block.timestamp + 1 hours), status:BetTypes420.WagerStatus.ACCEPTED}));
        s.caps.setAllowed(SETTLER, BetIds420.COMPONENT_BET, BetIds420.ACTION_SETTLE, s.auth.scopeForWager(s.wagerId), true);
    }
    function _versions() private pure returns (bytes32[7] memory versions) { versions = [DICE_V1, KENO_V1, PLINKO_V1, SLOT_V1, ROULETTE_V1, BLACKJACK_V1, MINES_V1]; }

    function testMaxGrossPayoutBoundaryIsIdenticalAcrossCasinoGames() public {
        bytes32[7] memory versions = _versions();
        for (uint256 i = 0; i < versions.length; ++i) { Suite memory s = _deploy(versions[i], i); vm.prank(SETTLER); vm.expectRevert(SettlementEngine420.InvalidPayout.selector); s.engine.settle(s.wagerId, BetTypes420.TerminalOutcome.WIN, 501 ether); require(!s.registry.settlementExists(s.wagerId), "settlement leaked"); require(!s.risk.released(), "risk leaked"); require(!s.vault.resolved(), "vault leaked"); require(!s.economics.finalized(), "economics leaked"); }
    }
    function testAuthorizedTerminalSettlementAndRetryAreIdenticalAcrossCasinoGames() public {
        bytes32[7] memory versions = _versions();
        for (uint256 i = 0; i < versions.length; ++i) { Suite memory s = _deploy(versions[i], i + 100); vm.prank(SETTLER); BetTypes420.Settlement memory first = s.engine.settle(s.wagerId, BetTypes420.TerminalOutcome.WIN, 500 ether); require(first.wagerId == s.wagerId && first.outcome == BetTypes420.TerminalOutcome.WIN && first.grossPayout == 500 ether, "first"); require(s.risk.released() && s.vault.resolved() && s.vault.payout() == 500 ether && s.economics.finalized(), "effects"); vm.prank(SETTLER); BetTypes420.Settlement memory retry = s.engine.settle(s.wagerId, BetTypes420.TerminalOutcome.WIN, 500 ether); require(retry.wagerId == first.wagerId && retry.outcome == first.outcome && retry.grossPayout == first.grossPayout, "retry"); }
    }
    function testConflictingSecondTerminalOutcomeFailsAcrossCasinoGames() public {
        bytes32[7] memory versions = _versions();
        for (uint256 i = 0; i < versions.length; ++i) { Suite memory s = _deploy(versions[i], i + 200); vm.prank(SETTLER); s.engine.settle(s.wagerId, BetTypes420.TerminalOutcome.WIN, 500 ether); vm.prank(SETTLER); vm.expectRevert(SettlementEngine420.SettlementConflict.selector); s.engine.settle(s.wagerId, BetTypes420.TerminalOutcome.LOSS, 0); BetTypes420.Settlement memory settlement = s.registry.getSettlement(s.wagerId); require(settlement.outcome == BetTypes420.TerminalOutcome.WIN && settlement.grossPayout == 500 ether, "terminal changed"); }
    }
}

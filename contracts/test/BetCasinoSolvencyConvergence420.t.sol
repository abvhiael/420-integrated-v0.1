// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/bet/BetAuthorization420.sol";
import "../src/bet/BetIds420.sol";
import "../src/bet/BetProfileRegistry420.sol";
import "../src/bet/RiskManager420.sol";
import "../src/bet/VaultAccounting420.sol";

interface VmBetCasinoSolvency420 {
    function expectRevert(bytes4) external;
}

contract MockCapabilityRegistryCasinoSolvency420 is ICapabilityRegistry420 {
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

contract BetCasinoSolvencyConvergence420Test {
    VmBetCasinoSolvency420 constant vm = VmBetCasinoSolvency420(address(uint160(uint256(keccak256("hevm cheat code")))));

    bytes32 constant VAULT = keccak256("casino/convergence/shared-vault");
    bytes32 constant RISK_PROFILE = keccak256("casino/convergence/risk-profile");
    bytes32 constant RISK_TYPE = keccak256("RISK");

    bytes32 constant DICE_V1 = keccak256("420BET.GAME.DICE.V1");
    bytes32 constant KENO_V1 = keccak256("420BET.GAME.KENO.V1");
    bytes32 constant PLINKO_V1 = keccak256("420BET.GAME.PLINKO.V1");
    bytes32 constant SLOT_V1 = keccak256("420BET.GAME.SLOT.REFERENCE.V1");
    bytes32 constant ROULETTE_V1 = keccak256("420BET.GAME.ROULETTE.V1");
    bytes32 constant BLACKJACK_V1 = keccak256("420BET.GAME.BLACKJACK.V1");

    struct Suite {
        MockCapabilityRegistryCasinoSolvency420 caps;
        BetAuthorization420 auth;
        BetProfileRegistry420 profiles;
        VaultAccounting420 accounting;
        RiskManager420 risk;
    }

    function _allow(Suite memory s, address principal, bytes32 action, bytes32 scope) private {
        s.caps.setAllowed(principal, BetIds420.COMPONENT_BET, action, scope, true);
    }

    function _deploy() private returns (Suite memory s) {
        s.caps = new MockCapabilityRegistryCasinoSolvency420();
        s.auth = new BetAuthorization420(address(s.caps));
        s.profiles = new BetProfileRegistry420(address(s.auth));
        s.accounting = new VaultAccounting420(address(s.auth));
        s.risk = new RiskManager420(address(s.auth), address(s.profiles), address(s.accounting));

        bytes32 vaultScope = s.auth.scopeForVault(VAULT);
        bytes32 profileScope = s.auth.scopeForProfile(RISK_PROFILE);

        _allow(s, address(this), BetIds420.ACTION_VAULT_REGISTER, vaultScope);
        _allow(s, address(this), BetIds420.ACTION_VAULT_RECORD_DEPOSIT, vaultScope);
        _allow(s, address(this), BetIds420.ACTION_VAULT_SET_SAFETY_RESERVE, vaultScope);
        _allow(s, address(this), BetIds420.ACTION_VAULT_SETTLE_WAGER, vaultScope);
        _allow(s, address(this), BetIds420.ACTION_PROFILE_REGISTER, profileScope);
        _allow(s, address(this), BetIds420.ACTION_RISK_CONFIGURE, profileScope);
        _allow(s, address(this), BetIds420.ACTION_RISK_RESERVE, vaultScope);
        _allow(s, address(this), BetIds420.ACTION_RISK_RELEASE, vaultScope);
        _allow(s, address(s.risk), BetIds420.ACTION_VAULT_RESERVE_LIABILITY, vaultScope);
        _allow(s, address(s.risk), BetIds420.ACTION_VAULT_RELEASE_LIABILITY, vaultScope);

        s.accounting.registerVault(VAULT, address(0));
        s.accounting.recordDeposit(VAULT, 1_000 ether);
        s.accounting.setSafetyReserve(VAULT, 100 ether);

        s.profiles.registerProfile(RISK_PROFILE, RISK_TYPE, keccak256("manifest"), keccak256("artifact"));
        s.risk.configureProfile(RiskManager420.RiskProfile({
            profileId: RISK_PROFILE,
            maxStakePerWager: 1_000 ether,
            maxGrossPayoutPerWager: 1_000 ether,
            maxReservedLiabilityPerWager: 900 ether,
            maxReservedLiabilityPerGame: 900 ether,
            maxReservedLiabilityPerVault: 2_000 ether,
            maxReservedLiabilityPerCorrelationKey: 900 ether,
            manifestHash: keccak256("risk-profile/v1"),
            exists: false
        }));
    }

    function _versions() private pure returns (bytes32[6] memory versions) {
        versions = [DICE_V1, KENO_V1, PLINKO_V1, SLOT_V1, ROULETTE_V1, BLACKJACK_V1];
    }

    function _reserve(Suite memory s, bytes32 gameVersionId, uint256 nonce, uint256 liability)
        private returns (bytes32 wagerId)
    {
        wagerId = keccak256(abi.encode("casino/convergence/solvency-wager", gameVersionId, nonce));
        uint256 stake = 100 ether;
        uint256 gross = stake + liability;
        uint256 reserved = s.risk.reserveExposure(
            wagerId,
            VAULT,
            gameVersionId,
            RISK_PROFILE,
            stake,
            gross,
            bytes32(0)
        );
        require(reserved == liability, "wrong liability");
    }

    function testSixCasinoGamesShareOneSolventLiabilityPool() public {
        Suite memory s = _deploy();
        bytes32[6] memory versions = _versions();

        for (uint256 i = 0; i < versions.length; ++i) {
            _reserve(s, versions[i], i, 100 ether);
        }

        VaultAccounting420.VaultState memory state = s.accounting.getVault(VAULT);
        require(state.totalAssets == 1_000 ether, "assets changed on reserve");
        require(state.activeReservedLiability == 600 ether, "reserved mismatch");
        require(state.safetyReserve == 100 ether, "safety mismatch");
        require(s.risk.reservedByVault(VAULT) == 600 ether, "risk vault mismatch");
        require(s.accounting.availableForNewRisk(VAULT) == 300 ether, "available mismatch");

        for (uint256 i = 0; i < versions.length; ++i) {
            require(s.risk.reservedByGame(VAULT, versions[i]) == 100 ether, "game reserve mismatch");
        }
    }

    function testAccountingRejectsAggregateCasinoOverReservationEvenWhenRiskProfileAllowsIt() public {
        Suite memory s = _deploy();
        bytes32[6] memory versions = _versions();

        for (uint256 i = 0; i < versions.length; ++i) {
            _reserve(s, versions[i], i + 100, 100 ether);
        }

        _reserve(s, DICE_V1, 999, 300 ether);
        require(s.accounting.availableForNewRisk(VAULT) == 0, "vault should be fully protected");

        vm.expectRevert(VaultAccounting420.Insolvent.selector);
        _reserve(s, KENO_V1, 1000, 1 ether);

        require(s.risk.reservedByVault(VAULT) == 900 ether, "failed reserve leaked risk state");
        require(s.accounting.getVault(VAULT).activeReservedLiability == 900 ether, "failed reserve leaked accounting");
    }

    function testReleaseAndSettlementPreserveSharedVaultConservation() public {
        Suite memory s = _deploy();
        bytes32[6] memory versions = _versions();
        bytes32[6] memory wagers;

        for (uint256 i = 0; i < versions.length; ++i) {
            wagers[i] = _reserve(s, versions[i], i + 200, 100 ether);
        }

        uint256 released = s.risk.releaseExposure(wagers[0]);
        require(released == 100 ether, "release mismatch");
        require(s.risk.reservedByVault(VAULT) == 500 ether, "risk release mismatch");
        require(s.accounting.getVault(VAULT).activeReservedLiability == 500 ether, "accounting release mismatch");
        require(s.accounting.availableForNewRisk(VAULT) == 400 ether, "available not restored");

        int256 pnl = s.accounting.recordWagerSettlement(VAULT, 100 ether, 0);
        require(pnl == int256(100 ether), "loss-side pnl mismatch");

        VaultAccounting420.VaultState memory state = s.accounting.getVault(VAULT);
        require(state.totalAssets == 1_100 ether, "settlement assets mismatch");
        require(state.activeReservedLiability == 500 ether, "other games disturbed");
        require(state.safetyReserve == 100 ether, "safety disturbed");
        require(state.realizedPnl == int256(100 ether), "cumulative pnl mismatch");
        require(s.accounting.availableForNewRisk(VAULT) == 500 ether, "post-settlement available mismatch");
    }

    function testLargeWinAccountingCannotConsumeOtherGamesProtectedLiability() public {
        Suite memory s = _deploy();
        bytes32[6] memory versions = _versions();
        bytes32[6] memory wagers;

        for (uint256 i = 0; i < versions.length; ++i) {
            wagers[i] = _reserve(s, versions[i], i + 300, 100 ether);
        }

        s.risk.releaseExposure(wagers[0]);

        vm.expectRevert(VaultAccounting420.Insolvent.selector);
        s.accounting.recordWagerSettlement(VAULT, 0, 501 ether);

        VaultAccounting420.VaultState memory state = s.accounting.getVault(VAULT);
        require(state.totalAssets == 1_000 ether, "failed win changed assets");
        require(state.activeReservedLiability == 500 ether, "failed win changed liabilities");
        require(state.safetyReserve == 100 ether, "failed win changed safety");
        require(state.realizedPnl == 0, "failed win changed pnl");
    }
}

// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../sports-5d6/SportsOracleOutcomeGate420.t.sol";

contract SportsRiskEmergency420Test is SportsOracleOutcomeGate420Test {
    function _enableProductionRisk(uint256 cap) internal {
        _grant(CONTROL, vault.BIND_ORACLE(), vault.scope(bytes32(0)));
        _grant(CONTROL, vault.SET_ASSET_RISK(), vault.scope(bytes32(0)));
        _bindGate();
        _call(CONTROL, address(vault), abi.encodeCall(
            vault.bindRiskGroup, (market, vault.correlationGroupFor(market), 1000)));
        _call(CONTROL, address(vault), abi.encodeCall(vault.setAssetProfitCap, (address(token), cap)));
        _call(CONTROL, address(vault), abi.encodeCall(vault.enableOracleOnlyFunding, ()));
    }

    function testNoAssetCapBlocksProductionAdmission() public {
        _enableProductionRisk(0);
        _submit(_quote(1));
        _call(CONTROL, address(vault), abi.encodeCall(vault.deposit, (market, 2000)));
        _fails(PLAYER, address(vault), abi.encodeCall(vault.fund, (_offer(500))));
        require(vault.fundedCount() == 0, "funding during risk freeze");
    }

    function testPermissionedCapAndRevokedAuthorization() public {
        _fails(PLAYER, address(vault), abi.encodeCall(vault.setAssetProfitCap, (address(token), 500)));
        _grant(CONTROL, vault.SET_ASSET_RISK(), vault.scope(bytes32(0)));
        _call(CONTROL, address(vault), abi.encodeCall(vault.setAssetProfitCap, (address(token), 500)));
        require(vault.assetProfitCap(address(token)) == 500, "cap missing");
    }

    function testAssetCapReservesExposureAndRejectsOverrun() public {
        _enableProductionRisk(425);
        _submit(_quote(1));
        _call(CONTROL, address(vault), abi.encodeCall(vault.deposit, (market, 2000)));
        bytes32 id = _fund(500);
        require(vault.assetProfitExposure(address(token)) == 425, "aggregate risk reservation");
        require(vault.riskGroupOutstanding(vault.correlationGroupFor(market)) == 425, "group risk mismatch");
        _fails(CONTROL, address(vault), abi.encodeCall(vault.setAssetProfitCap, (address(token), 424)));
        _call(CONTROL, address(vault), abi.encodeCall(vault.setAssetProfitCap, (address(token), 0)));
        require(vault.assetProfitExposure(address(token)) == 425, "freeze deleted liability");
        vm.warp(uint256(markets.get(market).config.cutoff) + 86400);
        vault.refund(id);
        require(vault.assetProfitExposure(address(token)) == 0, "risk not released after refund");
        require(vault.credit(PLAYER, address(token)) == 500, "refund blocked by risk freeze");
        _assertAssetConservation();
        vm.prank(PLAYER);
        vault.claim(address(token));
        _assertAssetConservation();
    }

    function testResolvedWinnerReleasesRiskDespiteFrozenAdmission() public {
        _enableProductionRisk(425);
        _submit(_quote(1));
        _call(CONTROL, address(vault), abi.encodeCall(vault.deposit, (market, 2000)));
        bytes32 id = _fund(500);
        _call(CONTROL, address(vault), abi.encodeCall(vault.setAssetProfitCap, (address(token), 0)));
        vm.warp(markets.get(market).config.cutoff + 1);
        _certifyWinner();
        _verified();
        gate.settle(id, true);
        require(vault.assetProfitExposure(address(token)) == 0, "settlement failed to release risk");
        require(vault.credit(PLAYER, address(token)) == 925, "blocked legitimate winner");
        _assertAssetConservation();
    }

    function testFuzzConfiguredCapNeverFallsBelowActiveExposure(uint16 rawStake) public {
        uint256 stake = 100 + uint256(rawStake) % 901;
        _enableProductionRisk(1500);
        _submit(_quote(1));
        _call(CONTROL, address(vault), abi.encodeCall(vault.deposit, (market, 2000)));
        bytes32 id = _fund(stake);
        uint256 active = vault.get(id).profit;
        require(vault.assetProfitExposure(address(token)) == active, "risk mismatch");
        if (active > 0) {
            _fails(CONTROL, address(vault), abi.encodeCall(vault.setAssetProfitCap, (address(token), active - 1)));
        }
        _call(CONTROL, address(vault), abi.encodeCall(vault.setAssetProfitCap, (address(token), 0)));
        vm.warp(uint256(markets.get(market).config.cutoff) + 86400);
        vault.refund(id);
        require(vault.assetProfitExposure(address(token)) == 0, "outstanding after closure");
        _assertAssetConservation();
    }
}

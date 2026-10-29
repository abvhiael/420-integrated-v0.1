// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../sports-5d8/SportsRiskEmergency420.t.sol";

/// @notice 5D.9 cross-generation adversarial tests; inherit the complete
/// 5D.4–5D.8 funded, certification, Oracle and emergency regression chains.
contract SportsAdversarialQualification420Test is SportsRiskEmergency420Test {
    function testFreezeRejectsNewRiskYetPreservesOracleFinalityAndClaim() public {
        _enableProductionRisk(425);
        _submit(_quote(1));
        _call(CONTROL, address(vault), abi.encodeCall(vault.deposit, (market, 2000)));
        bytes32 id = _fund(500);
        uint256 exposure = vault.assetProfitExposure(address(token));
        require(exposure == 425, "risk reservation");
        _call(CONTROL, address(vault), abi.encodeCall(vault.setAssetProfitCap, (address(token), 0)));
        _fails(PLAYER, address(vault), abi.encodeCall(vault.fund, (_offer(500))));
        require(vault.assetProfitExposure(address(token)) == exposure, "failed admission changed exposure");
        vm.warp(markets.get(market).config.cutoff + 1);
        _certifyWinner();
        _verified();
        _fails(CONTROL, address(vault), abi.encodeCall(vault.resolve, (id, true)));
        gate.settle(id, true);
        require(vault.assetProfitExposure(address(token)) == 0, "winner exposure leak");
        require(vault.credit(PLAYER, address(token)) == 925, "credit mismatch");
        _call(CONTROL, address(vault), abi.encodeCall(vault.setAssetProfitCap, (address(token), 425)));
        (bool ok,) = address(gate).call(abi.encodeCall(gate.settle, (id, true)));
        require(!ok, "reopening risk cap replayed settled ticket");
        _assertAssetConservation();
        vm.prank(PLAYER);
        vault.claim(address(token));
        require(vault.credit(PLAYER, address(token)) == 0, "double-claim liability");
        _assertAssetConservation();
    }

    function testFailedOracleReportsNeverConsumeTicketsOrRisk() public {
        _enableProductionRisk(425);
        _submit(_quote(1));
        _call(CONTROL, address(vault), abi.encodeCall(vault.deposit, (market, 2000)));
        bytes32 id = _fund(500);
        vm.warp(markets.get(market).config.cutoff + 1);
        _certifyWinner();
        SportsOutcomeCertification420.Result memory result_ = cert.result(market);
        bytes32 correct = gate.commitment(market, result_.selection, result_.evidence);
        _feed(uint64(block.timestamp), 1, 9500, correct);
        (bool ok,) = address(gate).call(abi.encodeCall(gate.settle, (id, true)));
        require(!ok, "insufficient quorum accepted");
        _feed(uint64(block.timestamp), 2, 8999, correct);
        (ok,) = address(gate).call(abi.encodeCall(gate.settle, (id, true)));
        require(!ok, "low confidence accepted");
        _feed(uint64(block.timestamp), 2, 9500, gate.commitment(bytes32(uint256(8)), result_.selection, result_.evidence));
        (ok,) = address(gate).call(abi.encodeCall(gate.settle, (id, true)));
        require(!ok, "cross-market evidence accepted");
        require(vault.get(id).state == SportsFundedTickets420.TicketState.FUNDED, "failed Oracle report changed ticket");
        require(vault.assetProfitExposure(address(token)) == 425, "failed Oracle report released risk");
        require(vault.credit(PLAYER, address(token)) == 0, "unverified payout credited");
        _verified();
        gate.settle(id, true);
        require(vault.assetProfitExposure(address(token)) == 0, "verified outcome leaked risk");
        _assertAssetConservation();
    }

    function testEmergencyFreezeDoesNotDisableTimeoutRefundOrClaims() public {
        _enableProductionRisk(425);
        _submit(_quote(1));
        _call(CONTROL, address(vault), abi.encodeCall(vault.deposit, (market, 2000)));
        bytes32 id = _fund(500);
        _call(CONTROL, address(vault), abi.encodeCall(vault.setAssetProfitCap, (address(token), 0)));
        vm.warp(uint256(markets.get(market).config.cutoff) + 86400);
        vault.refund(id);
        require(vault.assetProfitExposure(address(token)) == 0, "refund kept risk");
        require(vault.credit(PLAYER, address(token)) == 500, "refund not credited");
        (bool ok,) = address(vault).call(abi.encodeCall(vault.refund, (id)));
        require(!ok, "duplicate refund accepted");
        vm.prank(PLAYER);
        vault.claim(address(token));
        require(vault.credit(PLAYER, address(token)) == 0, "refund paid twice");
        _assertAssetConservation();
    }
}

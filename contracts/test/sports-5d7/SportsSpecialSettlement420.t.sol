// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../sports-5d4/SportsFundedTickets420.t.sol";

contract SportsSpecialSettlement420Test is SportsFundedTickets420Test {
    function _funded() internal returns (bytes32 id) {
        _submit(_quote(1));
        _call(CONTROL, address(vault), abi.encodeCall(vault.deposit, (market, 2000)));
        id = _fund(500);
        vm.warp(markets.get(market).config.cutoff + 1);
    }

    function _special(SportsOutcomeCertification420.SpecialKind kind, bytes32 first, bytes32 second) internal {
        bytes32 evidence = keccak256(abi.encode("official-special", kind, first, second));
        vm.prank(REPORT_A);
        cert.attestSpecial(market, kind, first, second, evidence);
        vm.prank(REPORT_B);
        cert.attestSpecial(market, kind, first, second, evidence);
        vm.warp(block.timestamp + 1 hours);
        cert.finalize(market);
    }

    function testNoActionReturnsExactlyStakeAndFinalizesOnce() public {
        bytes32 id = _funded();
        _special(SportsOutcomeCertification420.SpecialKind.NO_ACTION, bytes32(0), bytes32(0));
        _fails(CONTROL, address(vault), abi.encodeCall(vault.resolve, (id, false)));
        _call(CONTROL, address(vault), abi.encodeCall(vault.resolveSpecial, (id)));
        require(vault.credit(PLAYER, address(token)) == 500, "no-action stake");
        require(vault.get(id).state == SportsFundedTickets420.TicketState.NO_ACTION, "no-action state");
        _assertAssetConservation();
        _fails(CONTROL, address(vault), abi.encodeCall(vault.resolveSpecial, (id)));
        _fails(CONTROL, address(vault), abi.encodeCall(vault.refund, (id)));
    }

    function testPushRejectsMoneylineMarkets() public {
        bytes32 id = _funded();
        vm.prank(REPORT_A);
        (bool ok,) = address(cert).call(abi.encodeCall(cert.attestSpecial,
            (market, SportsOutcomeCertification420.SpecialKind.PUSH,
             bytes32(0), bytes32(0), keccak256("push"))));
        require(!ok, "moneyline push should be rejected");
        require(vault.get(id).state == SportsFundedTickets420.TicketState.FUNDED, "mutated");
    }

    function testDeadHeatTwoSelectionsPaidHalfLockedGross() public {
        bytes32 id = _funded();
        bytes32[] memory selections = markets.selections(market);
        bytes32 first = selections[0] < selections[1] ? selections[0] : selections[1];
        bytes32 second = selections[0] < selections[1] ? selections[1] : selections[0];
        _special(SportsOutcomeCertification420.SpecialKind.DEAD_HEAT, first, second);
        _call(CONTROL, address(vault), abi.encodeCall(vault.resolveSpecial, (id)));
        uint256 expected = 925 / 2;
        require(vault.get(id).state == SportsFundedTickets420.TicketState.DEAD_HEAT, "heat state");
        require(vault.credit(PLAYER, address(token)) == expected, "dead-heat return");
        require(vault.collateral(market) == 2000 + 500 - expected, "dead-heat collateral");
        require(vault.reserved(market) == 0, "stale reserve");
        _assertAssetConservation();
        vm.prank(PLAYER);
        vault.claim(address(token));
        _assertAssetConservation();
    }

    function testRejectsInvalidDeadHeatTermsAndReportConflict() public {
        _funded();
        bytes32[] memory selections = markets.selections(market);
        vm.prank(REPORT_A);
        (bool ok,) = address(cert).call(abi.encodeCall(cert.attestSpecial,
            (market, SportsOutcomeCertification420.SpecialKind.DEAD_HEAT,
             selections[0], selections[0], keccak256("invalid"))));
        require(!ok, "duplicate tie selection");
        bytes32 first = selections[0] < selections[1] ? selections[0] : selections[1];
        bytes32 second = selections[0] < selections[1] ? selections[1] : selections[0];
        vm.prank(REPORT_A);
        cert.attestSpecial(market, SportsOutcomeCertification420.SpecialKind.DEAD_HEAT,
            first, second, keccak256("a"));
        vm.prank(REPORT_B);
        (ok,) = address(cert).call(abi.encodeCall(cert.attestSpecial,
            (market, SportsOutcomeCertification420.SpecialKind.DEAD_HEAT,
             first, second, keccak256("b"))));
        require(!ok, "conflicting special reports");
        require(cert.result(market).status == SportsOutcomeCertification420.Status.NONE,
            "conflict reached finality");
    }

    function testUnauthorizedAndPrematureSpecialResolutionReverts() public {
        bytes32 id = _funded();
        _fails(CONTROL, address(vault), abi.encodeCall(vault.resolveSpecial, (id)));
        _special(SportsOutcomeCertification420.SpecialKind.NO_ACTION, bytes32(0), bytes32(0));
        _fails(PLAYER, address(vault), abi.encodeCall(vault.resolveSpecial, (id)));
        _assertAssetConservation();
    }

    function testFuzzDeadHeatConservesCollateral(uint16 rawStake) public {
        uint256 stake = 100 + uint256(rawStake) % 901;
        _submit(_quote(1));
        _call(CONTROL, address(vault), abi.encodeCall(vault.deposit, (market, 2000)));
        bytes32 id = _fund(stake);
        vm.warp(markets.get(market).config.cutoff + 1);
        bytes32[] memory selections = markets.selections(market);
        bytes32 first = selections[0] < selections[1] ? selections[0] : selections[1];
        bytes32 second = selections[0] < selections[1] ? selections[1] : selections[0];
        _special(SportsOutcomeCertification420.SpecialKind.DEAD_HEAT, first, second);
        _call(CONTROL, address(vault), abi.encodeCall(vault.resolveSpecial, (id)));
        uint256 payout = vault.get(id).gross / 2;
        require(vault.credit(PLAYER, address(token)) == payout, "incorrect half gross");
        require(vault.collateral(market) == 2000 + stake - payout, "collateral delta");
        _assertAssetConservation();
    }
}

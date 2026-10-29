// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../sports-5d6/SportsOracleOutcomeGate420.t.sol";

contract SportsSpecialOracle420Test is SportsOracleOutcomeGate420Test {
    function _specialTicket() internal returns (bytes32 id) {
        _submit(_quote(1));
        _call(CONTROL, address(vault), abi.encodeCall(vault.deposit, (market, 2000)));
        id = _fund(500);
        vm.warp(markets.get(market).config.cutoff + 1);
        bytes32 evidence = keccak256("official-no-action");
        vm.prank(REPORT_A);
        cert.attestSpecial(market, SportsOutcomeCertification420.SpecialKind.NO_ACTION,
            bytes32(0), bytes32(0), evidence);
        vm.prank(REPORT_B);
        cert.attestSpecial(market, SportsOutcomeCertification420.SpecialKind.NO_ACTION,
            bytes32(0), bytes32(0), evidence);
        vm.warp(block.timestamp + 1 hours);
        cert.finalize(market);
        _bindGate();
    }

    function testSpecialSettlementRequiresVerifiedOracleAndNoDirectBypass() public {
        bytes32 id = _specialTicket();
        _fails(CONTROL, address(vault), abi.encodeCall(vault.resolveSpecial, (id)));
        (bool ok,) = address(gate).call(abi.encodeCall(gate.settleSpecial, (id)));
        require(!ok, "missing oracle quorum");
        SportsOutcomeCertification420.Result memory result_ = cert.result(market);
        oracle.configure(gate.feedFor(market),
            gate.commitment(market, result_.selection, result_.evidence),
            uint64(block.timestamp), 2, 9500);
        gate.settleSpecial(id);
        require(vault.get(id).state == SportsFundedTickets420.TicketState.NO_ACTION,
            "wrong verified special outcome");
        require(vault.credit(PLAYER, address(token)) == 500, "exact no-action payout");
        _assertAssetConservation();
        (ok,) = address(gate).call(abi.encodeCall(gate.settleSpecial, (id)));
        require(!ok, "double settlement");
    }

    function testSpecialStaleOracleAndIncorrectMarketRejected() public {
        bytes32 id = _specialTicket();
        SportsOutcomeCertification420.Result memory result_ = cert.result(market);
        oracle.configure(gate.feedFor(market),
            gate.commitment(bytes32(uint256(999)), result_.selection, result_.evidence),
            uint64(block.timestamp), 2, 9500);
        (bool ok,) = address(gate).call(abi.encodeCall(gate.settleSpecial, (id)));
        require(!ok, "other-market special commitment");
        oracle.configure(gate.feedFor(market),
            gate.commitment(market, result_.selection, result_.evidence),
            uint64(block.timestamp), 2, 9500);
        vm.warp(block.timestamp + 2 hours + 1);
        (ok,) = address(gate).call(abi.encodeCall(gate.settleSpecial, (id)));
        require(!ok, "stale special observation");
        require(vault.get(id).state == SportsFundedTickets420.TicketState.FUNDED,
            "rejected report mutated ticket");
    }
}

// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../sports-5d4/SportsFundedTickets420.t.sol";

/// @notice 5D.7 funded settlement, receipt and payout accounting regression.
contract SportsSettlementLifecycle420Test is SportsFundedTickets420Test {
    function _funded() internal returns (bytes32 id) {
        _submit(_quote(1));
        _call(CONTROL, address(vault), abi.encodeCall(vault.deposit, (market, 2000)));
        id = _fund(500);
    }

    function testWinnerReceiptAndWithdrawOnce() public {
        bytes32 id = _funded();
        vm.warp(markets.get(market).config.cutoff + 1);
        _certifyWinner();
        _call(CONTROL, address(vault), abi.encodeCall(vault.resolve, (id, true)));
        SportsFundedTickets420.SettlementReceipt memory receipt = vault.settlementReceipt(id);
        require(receipt.outcome == SportsFundedTickets420.TicketState.WON, "outcome");
        require(receipt.payout == 925 && receipt.executor == CONTROL, "beneficiary amount/authority");
        require(receipt.evidence == cert.result(market).evidence, "evidence binding");
        require(receipt.finalizedAt == block.timestamp, "finality timestamp");
        _assertAssetConservation();
        vm.prank(PLAYER);
        vault.claim(address(token));
        require(vault.credit(PLAYER, address(token)) == 0, "credit withdrawn");
        _assertAssetConservation();
        _fails(PLAYER, address(vault), abi.encodeCall(vault.claim, (address(token))));
        _fails(CONTROL, address(vault), abi.encodeCall(vault.refund, (id)));
    }

    function testLosingReceiptHasZeroPayoutAndConservesCollateral() public {
        bytes32 id = _funded();
        vm.warp(markets.get(market).config.cutoff + 1);
        bytes32[] memory selections = markets.selections(market);
        bytes32 other = selections[0] == chosen ? selections[1] : selections[0];
        bytes32 evidence = keccak256("other-selection");
        vm.prank(REPORT_A);
        cert.attest(market, other, evidence);
        vm.prank(REPORT_B);
        cert.attest(market, other, evidence);
        vm.warp(block.timestamp + 1 hours);
        cert.finalize(market);
        _call(CONTROL, address(vault), abi.encodeCall(vault.resolve, (id, false)));
        SportsFundedTickets420.SettlementReceipt memory receipt = vault.settlementReceipt(id);
        require(receipt.outcome == SportsFundedTickets420.TicketState.LOST, "loss classification");
        require(receipt.payout == 0 && receipt.evidence == evidence, "loss evidence/payout");
        require(vault.credit(PLAYER, address(token)) == 0, "loser received credit");
        _assertAssetConservation();
        _fails(CONTROL, address(vault), abi.encodeCall(vault.resolve, (id, true)));
    }

    function testTimedRefundRecordsStakeAndRejectsDoubleTerminal() public {
        bytes32 id = _funded();
        vm.warp(uint256(markets.get(market).config.cutoff) + 86400);
        vm.prank(PLAYER);
        vault.refund(id);
        SportsFundedTickets420.SettlementReceipt memory receipt = vault.settlementReceipt(id);
        require(receipt.outcome == SportsFundedTickets420.TicketState.REFUNDED, "refund status");
        require(receipt.payout == 500 && receipt.evidence == bytes32(0), "refund stake");
        require(receipt.executor == PLAYER, "permissionless refund executor");
        _assertAssetConservation();
        _fails(CONTROL, address(vault), abi.encodeCall(vault.resolve, (id, true)));
        _fails(PLAYER, address(vault), abi.encodeCall(vault.refund, (id)));
    }

    function testVoidRefundRetainsCertifiedEvidence() public {
        bytes32 id = _funded();
        vm.warp(markets.get(market).config.cutoff + 1);
        bytes32 evidence = keccak256("official-report");
        vm.prank(REPORT_A);
        cert.attest(market, chosen, evidence);
        vm.prank(REPORT_B);
        cert.attest(market, chosen, evidence);
        cert.challenge(market, keccak256("challenge"));
        bytes32 ruling = keccak256("void-ruling");
        vm.prank(JUDGE);
        cert.decide(market, true, ruling);
        vault.refund(id);
        SportsFundedTickets420.SettlementReceipt memory receipt = vault.settlementReceipt(id);
        require(receipt.outcome == SportsFundedTickets420.TicketState.REFUNDED, "not refunded");
        require(receipt.evidence == ruling && receipt.payout == 500, "void ruling lost");
        _assertAssetConservation();
    }

    function testUnfundedReceiptDoesNotExist() public {
        (bool ok,) = address(vault).call(abi.encodeCall(vault.settlementReceipt, (keccak256("unknown"))));
        require(!ok, "unfunded receipt exists");
    }

    function testFuzzRefundReceiptsAreExactStake(uint16 rawStake) public {
        uint256 stake = 100 + uint256(rawStake) % 901;
        _submit(_quote(1));
        _call(CONTROL, address(vault), abi.encodeCall(vault.deposit, (market, 2000)));
        bytes32 id = _fund(stake);
        vm.warp(uint256(markets.get(market).config.cutoff) + 86400);
        vault.refund(id);
        SportsFundedTickets420.SettlementReceipt memory receipt = vault.settlementReceipt(id);
        require(receipt.payout == stake, "refund changed stake");
        require(vault.credit(PLAYER, address(token)) == stake, "credit changed stake");
        _assertAssetConservation();
    }

    function testUnknownCertifiedSelectionCannotConfiscateStake() public {
        bytes32 id = _funded();
        vm.warp(markets.get(market).config.cutoff + 1);
        bytes32 unapproved = keccak256("unapproved-result-selection");
        bytes32 evidence = keccak256("unknown-selection-evidence");
        vm.prank(REPORT_A);
        cert.attest(market, unapproved, evidence);
        vm.prank(REPORT_B);
        cert.attest(market, unapproved, evidence);
        vm.warp(block.timestamp + 1 hours);
        cert.finalize(market);
        _fails(CONTROL, address(vault), abi.encodeCall(vault.resolve, (id, false)));
        require(vault.get(id).state == SportsFundedTickets420.TicketState.FUNDED,
            "unknown selection closed ticket");
        _assertAssetConservation();
        vm.warp(uint256(markets.get(market).config.cutoff) + 86400);
        vault.refund(id);
        require(vault.credit(PLAYER, address(token)) == 500, "stake inaccessible");
    }
}
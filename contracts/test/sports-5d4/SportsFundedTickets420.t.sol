// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./SportsBetAcceptance420.t.sol";
import "../../src/bet/sports/SportsFundedTickets420.sol";

interface SportsFundingVm { function deal(address,uint256) external; }

contract SportsFundedTickets420Test is SportsBetAcceptance420Test {
    SportsFundedTickets420 vault;
    SportsOutcomeCertification420 cert;
    address constant REPORT_A = address(0xABCD);
    address constant REPORT_B = address(0xBCDE);
    address constant JUDGE = address(0xCDEF);
    SportsFundingVm constant fundingVm = SportsFundingVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function setUp() public override {
        super.setUp();
        cert = new SportsOutcomeCertification420(address(markets), REPORT_A, REPORT_B, JUDGE, 1 hours);
        vault = new SportsFundedTickets420(address(auth), address(acceptance), address(cert));
        _grant(CONTROL, vault.RESOLVE(), vault.scope(market));
        fundingVm.deal(CONTROL, 1 ether);
        fundingVm.deal(PLAYER, 1 ether);
        vm.prank(CONTROL);
        token.deposit{value: 20000}();
        vm.prank(CONTROL);
        token.approve(address(vault), type(uint256).max);
        vm.prank(PLAYER);
        token.deposit{value: 10000}();
        vm.prank(PLAYER);
        token.approve(address(vault), type(uint256).max);
    }

    function _fund(uint256 amount) internal returns (bytes32 id) {
        SportsBetAcceptance420.Offer memory offer = _offer(amount);
        vm.prank(PLAYER);
        id = vault.fund(offer);
    }

    function testFundedTicketLockedAndCollateralReserved() public {
        _submit(_quote(1));
        _call(CONTROL, address(vault), abi.encodeCall(vault.deposit, (market, 2000)));
        bytes32 id = _fund(500);
        SportsFundedTickets420.Ticket memory t = vault.get(id);
        require(t.player == PLAYER && t.gross == 925 && t.profit == 425, "immutable locked ticket");
        require(uint256(t.state) == 1 && vault.reserved(market) == 425, "reserved liability");
        require(token.balanceOf(address(vault)) == 2500, "atomic escrow custody");
        SportsBetAcceptance420.Offer memory duplicate = _offer(500);
        vm.prank(PLAYER);
        (bool ok,) = address(vault).call(abi.encodeCall(vault.fund, (duplicate)));
        require(!ok, "nonce replay");
        _fails(CONTROL, address(vault), abi.encodeCall(vault.withdrawCollateral, (market, 1600)));
    }

    function testRejectUncollateralizedAndUnfundedAdmission() public {
        _submit(_quote(1));
        SportsBetAcceptance420.Offer memory o = _offer(500);
        vm.prank(PLAYER);
        (bool ok,) = address(vault).call(abi.encodeCall(vault.fund, (o)));
        require(!ok, "no collateral");
        _call(CONTROL, address(vault), abi.encodeCall(vault.deposit, (market, 2000)));
        vm.prank(address(0xBAD));
        (ok,) = address(vault).call(abi.encodeCall(vault.fund, (o)));
        require(!ok, "no funded payer");
    }

    function testRefundTimeoutAndOneTerminalOutcome() public {
        _submit(_quote(1));
        _call(CONTROL, address(vault), abi.encodeCall(vault.deposit, (market, 2000)));
        bytes32 id = _fund(500);
        (bool early,) = address(vault).call(abi.encodeCall(vault.refund, (id)));
        require(!early, "premature refund");
        SportsMarketRegistry420.Record memory m = markets.get(market);
        vm.warp(uint256(m.config.cutoff) + 86400);
        vault.refund(id);
        require(vault.credit(PLAYER, address(token)) == 500 && vault.reserved(market) == 0, "refund and release");
        (bool again,) = address(vault).call(abi.encodeCall(vault.refund, (id)));
        require(!again, "duplicate close");
        vm.prank(PLAYER);
        vault.claim(address(token));
        require(token.balanceOf(PLAYER) == 10000, "claim exact stake");
        require(vault.credit(PLAYER, address(token)) == 0, "single withdrawal");
    }

    function _certifyWinner() internal {
        bytes32 evidence = keccak256("feed-evidence");
        vm.prank(REPORT_A);
        cert.attest(market, chosen, evidence);
        vm.prank(REPORT_B);
        cert.attest(market, chosen, evidence);
        vm.warp(block.timestamp + 1 hours);
        cert.finalize(market);
    }

    function testWinnerCreditsProfitAndDoesNotDoublePay() public {
        _submit(_quote(1));
        _call(CONTROL, address(vault), abi.encodeCall(vault.deposit, (market, 2000)));
        bytes32 id = _fund(500);
        _fails(CONTROL, address(vault), abi.encodeCall(vault.resolve, (id, true)));
        vm.warp(markets.get(market).config.cutoff + 1);
        _fails(CONTROL, address(vault), abi.encodeCall(vault.resolve, (id, true)));
        _certifyWinner();
        _call(CONTROL, address(vault), abi.encodeCall(vault.resolve, (id, true)));
        require(vault.credit(PLAYER, address(token)) == 925 && vault.collateral(market) == 1575, "profit collateral used");
        _fails(CONTROL, address(vault), abi.encodeCall(vault.resolve, (id, false)));
        vm.prank(PLAYER);
        vault.claim(address(token));
        require(token.balanceOf(PLAYER) == 10425, "gross payout exactly once");
    }

    function testDisputePreventsSettlementAndVoidRefunds() public {
        _submit(_quote(1));
        _call(CONTROL, address(vault), abi.encodeCall(vault.deposit, (market, 2000)));
        bytes32 id = _fund(500);
        vm.warp(markets.get(market).config.cutoff + 1);
        bytes32 ev = keccak256("feed-A");
        vm.prank(REPORT_A);
        cert.attest(market, chosen, ev);
        vm.prank(REPORT_B);
        (bool mismatch,) = address(cert).call(abi.encodeCall(cert.attest, (market, chosen, keccak256("feed-B"))));
        require(!mismatch, "source mismatch must reject");
        vm.prank(REPORT_B);
        cert.attest(market, chosen, ev);
        cert.challenge(market, keccak256("player-evidence"));
        vm.warp(markets.get(market).config.cutoff + 1 days);
        _fails(CONTROL, address(vault), abi.encodeCall(vault.resolve, (id, true)));
        (bool early,) = address(cert).call(abi.encodeCall(cert.finalize, (market)));
        require(!early, "challenged finality bypass");
        vm.prank(JUDGE);
        cert.decide(market, true, keccak256("review-evidence"));
        vault.refund(id);
        require(vault.credit(PLAYER, address(token)) == 500, "void refund");
    }

    function testOperatorCannotForgeAttestation() public {
        vm.prank(CONTROL);
        (bool ok,) = address(cert).call(abi.encodeCall(cert.attest, (market, chosen, keccak256("fake"))));
        require(!ok, "operator not independent certifier");
    }

    function testPrematureCertificationAndWrongWinnerAreRejected() public {
        _submit(_quote(1));
        _call(CONTROL, address(vault), abi.encodeCall(vault.deposit, (market, 2000)));
        bytes32 id = _fund(500);
        vm.prank(REPORT_A);
        (bool premature,) = address(cert).call(abi.encodeCall(cert.attest, (market, chosen, keccak256("early"))));
        require(!premature, "premature certification");
        vm.warp(markets.get(market).config.cutoff + 1);
        _certifyWinner();
        _fails(CONTROL, address(vault), abi.encodeCall(vault.resolve, (id, false)));
        _call(CONTROL, address(vault), abi.encodeCall(vault.resolve, (id, true)));
    }

    function testChallengeCannotBeSilentlyDismissedOrRepeated() public {
        vm.warp(markets.get(market).config.cutoff + 1);
        bytes32 ev = keccak256("two-source-evidence");
        vm.prank(REPORT_A);
        cert.attest(market, chosen, ev);
        vm.prank(REPORT_B);
        cert.attest(market, chosen, ev);
        cert.challenge(market, keccak256("challenge-A"));
        (bool repeated,) = address(cert).call(abi.encodeCall(cert.challenge, (market, keccak256("challenge-B"))));
        require(!repeated, "one review state");
        vm.prank(CONTROL);
        (bool forged,) = address(cert).call(abi.encodeCall(cert.decide, (market, false, keccak256("forged"))));
        require(!forged, "unauthorized arbitrator");
        vm.warp(block.timestamp + 2 hours);
        (bool finalizeBypass,) = address(cert).call(abi.encodeCall(cert.finalize, (market)));
        require(!finalizeBypass, "appeal freezes automatic finality");
        vm.prank(JUDGE);
        cert.decide(market, false, keccak256("reviewed"));
        SportsOutcomeCertification420.Result memory r = cert.result(market);
        require(r.status == SportsOutcomeCertification420.Status.FINAL, "review complete");
        vm.prank(JUDGE);
        (bool again,) = address(cert).call(abi.encodeCall(cert.decide, (market, true, keccak256("revised"))));
        require(!again, "no second finalization");
    }

    function testNonFinalOutcomeTriggersTimeoutRefund() public {
        _submit(_quote(1));
        _call(CONTROL, address(vault), abi.encodeCall(vault.deposit, (market, 2000)));
        bytes32 id = _fund(500);
        vm.warp(markets.get(market).config.cutoff + 86400);
        _fails(CONTROL, address(vault), abi.encodeCall(vault.resolve, (id, true)));
        vault.refund(id);
        require(vault.credit(PLAYER, address(token)) == 500, "timeout preserves player stake");
    }

    function testStaleQuoteCannotBeFunded() public {
        _submit(_quote(1));
        _call(CONTROL, address(vault), abi.encodeCall(vault.deposit, (market, 2000)));
        SportsBetAcceptance420.Offer memory o = _offer(500);
        _submit(_quote(2));
        vm.prank(PLAYER);
        (bool ok,) = address(vault).call(abi.encodeCall(vault.fund, (o)));
        require(!ok && vault.reserved(market) == 0, "no stale quote funding");
    }
}

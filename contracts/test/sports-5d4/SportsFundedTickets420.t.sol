// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./SportsBetAcceptance420.t.sol";
import "../../src/bet/sports/SportsFundedTickets420.sol";

interface SportsFundingVm { function deal(address,uint256) external; }

contract SportsFundedTickets420Test is SportsBetAcceptance420Test {
    SportsFundedTickets420 vault;
    SportsFundingVm constant fundingVm = SportsFundingVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function setUp() public override {
        super.setUp();
        vault = new SportsFundedTickets420(address(auth), address(acceptance));
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
        vm.prank(PLAYER);
        id = vault.fund(_offer(amount));
    }

    function testFundedTicketLockedAndCollateralReserved() public {
        _submit(_quote(1));
        _call(CONTROL, address(vault), abi.encodeCall(vault.deposit, (market, 2000)));
        bytes32 id = _fund(500);
        SportsFundedTickets420.Ticket memory t = vault.get(id);
        require(t.player == PLAYER && t.gross == 925 && t.profit == 425, "immutable locked ticket");
        require(uint256(t.state) == 1 && vault.reserved(market) == 425, "reserved liability");
        require(token.balanceOf(address(vault)) == 2500, "atomic escrow custody");
        vm.prank(PLAYER);
        (bool ok,) = address(vault).call(abi.encodeCall(vault.fund, (_offer(500))));
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

    function testWinnerCreditsProfitAndDoesNotDoublePay() public {
        _submit(_quote(1));
        _call(CONTROL, address(vault), abi.encodeCall(vault.deposit, (market, 2000)));
        bytes32 id = _fund(500);
        _fails(CONTROL, address(vault), abi.encodeCall(vault.resolve, (id, true)));
        vm.warp(markets.get(market).config.cutoff + 1);
        _call(CONTROL, address(vault), abi.encodeCall(vault.resolve, (id, true)));
        require(vault.credit(PLAYER, address(token)) == 925 && vault.collateral(market) == 1575, "profit collateral used");
        _fails(CONTROL, address(vault), abi.encodeCall(vault.resolve, (id, false)));
        vm.prank(PLAYER);
        vault.claim(address(token));
        require(token.balanceOf(PLAYER) == 10425, "gross payout exactly once");
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

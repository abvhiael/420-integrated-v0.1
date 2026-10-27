// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../sports-5d4/SportsFundedTickets420.t.sol";

/// @notice 5D.5 lifecycle regression: quote invalidation, authenticated state
/// changes, terminal tickets and player-funded cancel/postpone/abandon refunds.
contract SportsMarketLifecycle420Test is SportsFundedTickets420Test {
    function _status(SportsTypes420.EventStatus status_) internal {
        _grant(CONTROL, evts.STATUS(), evts.scope(eventId));
        _call(CONTROL, address(evts), abi.encodeCall(evts.setStatus,
            (eventId, status_, keccak256(abi.encode("5D5-event-status", status_)))));
    }

    function _opened() internal returns (bytes32 id) {
        _submit(_quote(1));
        _call(CONTROL, address(vault), abi.encodeCall(vault.deposit, (market, 2000)));
        id = _fund(500);
    }

    function _assertCancellationRefund(bytes32 id) internal {
        vault.refund(id);
        require(vault.credit(PLAYER, address(token)) == 500, "exact player refund");
        require(vault.reserved(market) == 0 && vault.pendingStake(market) == 0, "reservation released");
        require(vault.collateral(market) == 2000, "house collateral untouched");
        (bool duplicate,) = address(vault).call(abi.encodeCall(vault.refund, (id)));
        require(!duplicate, "double close");
        vm.prank(PLAYER);
        vault.claim(address(token));
        require(token.balanceOf(PLAYER) == 10000, "funds restored");
    }

    function testCancellationBlocksOffersAndRefundsAlreadyFundedTicket() public {
        bytes32 id = _opened();
        _status(SportsTypes420.EventStatus.CANCELLED);
        require(!markets.eligible(market), "cancelled market eligibility");
        (, , bool acceptable) = acceptance.preview(_offer(500), PLAYER);
        require(!acceptable, "cancelled fixture quote");
        _fails(CONTROL, address(vault), abi.encodeCall(vault.resolve, (id, true)));
        _assertCancellationRefund(id);
    }

    function testPostponementRefundsAndCannotReopenOldQuote() public {
        bytes32 id = _opened();
        SportsBetAcceptance420.Offer memory stale = _offer(500);
        _status(SportsTypes420.EventStatus.POSTPONED);
        require(!markets.eligible(market), "postponed event remains closed");
        vm.prank(PLAYER);
        (bool ok,) = address(vault).call(abi.encodeCall(vault.fund, (stale)));
        require(!ok, "stale market admission");
        _assertCancellationRefund(id);
    }

    function testAbandonmentRefundsExistingTickets() public {
        bytes32 id = _opened();
        _status(SportsTypes420.EventStatus.STARTED);
        _status(SportsTypes420.EventStatus.ABANDONED);
        require(!markets.eligible(market), "abandonment closes admission");
        _fails(CONTROL, address(vault), abi.encodeCall(vault.resolve, (id, false)));
        _assertCancellationRefund(id);
    }

    function testSuspensionEpochRejectsLockedOffersAndPreservesOpenTickets() public {
        bytes32 id = _opened();
        SportsBetAcceptance420.Offer memory stale = _offer(500);
        uint64 previousEpoch = markets.get(market).quoteEpoch;
        _call(CONTROL, address(markets), abi.encodeCall(markets.suspend, (market)));
        require(markets.get(market).quoteEpoch == previousEpoch + 1, "quote epoch advanced");
        require(!markets.eligible(market), "suspended market eligibility");
        (, , bool canAccept) = acceptance.preview(stale, PLAYER);
        require(!canAccept, "suspension must block offer");
        _call(CONTROL, address(markets), abi.encodeCall(markets.resume, (market)));
        require(markets.get(market).quoteEpoch == previousEpoch + 2, "resume resets quote epoch");
        (, , canAccept) = acceptance.preview(stale, PLAYER);
        require(!canAccept, "resumed market must not reuse stale quote");
        require(uint256(vault.get(id).state) == 1 && vault.reserved(market) == 425, "ticket preserved");
    }

    function testClosureIsTerminalAndDoesNotEraseExistingTicket() public {
        bytes32 id = _opened();
        _call(CONTROL, address(markets), abi.encodeCall(markets.close, (market)));
        require(!markets.eligible(market), "closed market cannot admit");
        _fails(CONTROL, address(markets), abi.encodeCall(markets.resume, (market)));
        require(uint256(vault.get(id).state) == 1, "no ticket erasure on close");
        vm.warp(markets.get(market).config.cutoff + 86400);
        vault.refund(id);
        require(vault.credit(PLAYER, address(token)) == 500, "closing does not strand refundable stake");
    }

    function testUnauthorizedMarketAndEventChangesRejected() public {
        _submit(_quote(1));
        _fails(PLAYER, address(markets), abi.encodeCall(markets.suspend, (market)));
        _fails(PLAYER, address(markets), abi.encodeCall(markets.close, (market)));
        _fails(PLAYER, address(evts), abi.encodeCall(evts.setStatus,
            (eventId, SportsTypes420.EventStatus.CANCELLED, keccak256("forged"))));
        require(markets.eligible(market), "forgery changed market state");
    }

    function testCancelledEventCannotBeSetBackToScheduled() public {
        _status(SportsTypes420.EventStatus.CANCELLED);
        _fails(CONTROL, address(evts), abi.encodeCall(evts.setStatus,
            (eventId, SportsTypes420.EventStatus.SCHEDULED, keccak256("reopen"))));
        require(!markets.eligible(market), "cancellation cannot be undone");
    }
}

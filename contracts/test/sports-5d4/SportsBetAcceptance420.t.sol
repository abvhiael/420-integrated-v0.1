// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../sports-5d3/SportsOddsIngestion420.t.sol";
import "../../src/bet/sports/SportsBetAcceptance420.sol";

contract SportsBetAcceptance420Test is SportsOddsIngestion420Test {
    SportsBetAcceptance420 acceptance;
    address constant PLAYER = address(0xBEEF);
    bytes32 chosen;

    function setUp() public override {
        super.setUp();
        acceptance = new SportsBetAcceptance420(address(auth), address(odds));
        _grant(CONTROL, acceptance.CONFIGURE(), acceptance.scope(market));
        chosen = markets.selections(market)[0];
        _call(CONTROL, address(acceptance), abi.encodeCall(
            acceptance.configure, (market, SportsBetAcceptance420.Risk(
                100, 1000, 2000, 1200, 1500, true
            ))
        ));
        _submit(_quote(1));
    }

    function _offer(uint256 stake) internal view returns (SportsBetAcceptance420.Offer memory o) {
        (SportsOddsIngestion420.Latest memory q,) = odds.current(market);
        o = SportsBetAcceptance420.Offer(
            market, chosen, q.digest, stake, stake, stake * 3,
            uint64(block.timestamp + 60), keccak256("unique-nonce"), keccak256("not-a-real-receipt")
        );
    }

    function testPreviewLocksExactQuoteAndCalculatesProfitLiability() public {
        (uint256 gross, uint256 liability, bool ok) = acceptance.preview(_offer(1000), PLAYER);
        require(ok && gross == 1850 && liability == 850, "locked odds / profit liability");
    }

    function testLimitsAndSelectionReject() public {
        (, , bool ok) = acceptance.preview(_offer(99), PLAYER);
        require(!ok, "minimum stake");
        (, , ok) = acceptance.preview(_offer(1001), PLAYER);
        require(!ok, "maximum stake");
        SportsBetAcceptance420.Offer memory o = _offer(500);
        o.selection = bytes32(uint256(999));
        (, , ok) = acceptance.preview(o, PLAYER);
        require(!ok, "unknown selection");
        o = _offer(500);
        o.maxGrossReturn = 800;
        (, , ok) = acceptance.preview(o, PLAYER);
        require(!ok, "price movement slippage");
    }

    function testStaleLockedQuoteFailsClosed() public {
        SportsBetAcceptance420.Offer memory o = _offer(500);
        _submit(_quote(2));
        (, , bool ok) = acceptance.preview(o, PLAYER);
        require(!ok, "stale signed price");
    }

    function testSuspensionFailsClosed() public {
        SportsBetAcceptance420.Offer memory o = _offer(500);
        _call(CONTROL, address(markets), abi.encodeCall(markets.suspend, (market)));
        (, , bool ok) = acceptance.preview(o, PLAYER);
        require(!ok, "market suspended");
    }

    function testUnfundedAcceptanceIsDisabled() public {
        SportsBetAcceptance420.Offer memory o = _offer(500);
        (bool ok,) = address(acceptance).call(abi.encodeCall(acceptance.accept, (o, PLAYER)));
        require(!ok, "synthetic funding receipt must not mint wager");
    }
}

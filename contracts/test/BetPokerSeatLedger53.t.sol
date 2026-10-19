// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./BetPokerTableRegistry52.t.sol";
import "../src/bet/PokerSeatLedger420.sol";

contract PokerCoin53 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount; return true;
    }
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(allowance[from][msg.sender] >= amount && balanceOf[from] >= amount, "insufficient");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount; balanceOf[to] += amount; return true;
    }
    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "insufficient");
        balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true;
    }
}
contract PokerSeatLedger53Test is BetPokerTableRegistry52Test {
    address constant PLAYER = address(0x1234);
    PokerSeatLedger420 ledger;
    PokerCoin53 coin;
    constructor() {
        coin = new PokerCoin53();
        ledger = new PokerSeatLedger420(address(registry));
        for (uint256 i; i < 5; ++i) {
            bytes32 action = i == 0 ? BetIds420.ACTION_POKER_BUY_IN
                : i == 1 ? BetIds420.ACTION_POKER_TOP_UP
                : i == 2 ? BetIds420.ACTION_POKER_SIT_OUT
                : i == 3 ? BetIds420.ACTION_POKER_LEAVE : BetIds420.ACTION_POKER_WITHDRAW;
            cap.grant(PLAYER,action,auth.scopeForTable(TABLE),true);
        }
        coin.mint(PLAYER,5000);
        vm.prank(PLAYER); coin.approve(address(ledger),5000);
    }
    function _open() internal {
        PokerTableRegistry420.Configuration memory c = _config();
        c.asset = address(coin);
        vm.prank(ADMIN); registry.register(c,ADMIN);
        vm.prank(ADMIN); registry.approve(TABLE);
        vm.prank(ADMIN); registry.open(TABLE);
    }
    function _buy() internal {
        vm.prank(PLAYER); ledger.buyIn(TABLE,0,400);
    }
    function testFundedBuyInAndExactChipConservation() public {
        _open(); _buy();
        require(ledger.totalChips(TABLE)==400,"chips");
        require(coin.balanceOf(address(ledger))==400,"escrow");
        require(ledger.playerSeatPlusOne(TABLE,PLAYER)==1,"seat");
        require(ledger.seatOf(TABLE,0).chips==400,"stack");
    }
    function testTopUpAndWithdrawExactlyOnce() public {
        _open(); _buy();
        vm.prank(PLAYER); ledger.topUp(TABLE,200);
        require(ledger.totalChips(TABLE)==600,"topup");
        vm.prank(PLAYER); ledger.leave(TABLE);
        require(ledger.totalChips(TABLE)==0,"zero");
        require(coin.balanceOf(address(ledger))==0,"drained escrow");
        require(coin.balanceOf(PLAYER)==5000,"conserved");
        vm.expectRevert(PokerSeatLedger420.NotSeated.selector);
        vm.prank(PLAYER); ledger.leave(TABLE);
    }
    function testDuplicateSeatAndBadSeatRejected() public {
        _open(); _buy();
        vm.expectRevert(PokerSeatLedger420.AlreadySeated.selector);
        vm.prank(PLAYER); ledger.buyIn(TABLE,1,400);
        vm.expectRevert(PokerSeatLedger420.InvalidSeat.selector);
        vm.prank(OTHER); ledger.buyIn(TABLE,7,400);
        vm.expectRevert(PokerSeatLedger420.Occupied.selector);
        vm.prank(OTHER); ledger.buyIn(TABLE,0,400);
    }
    function testRevokedAuthorizationDoesNotCreateChips() public {
        _open();
        cap.grant(PLAYER,BetIds420.ACTION_POKER_BUY_IN,auth.scopeForTable(TABLE),false);
        vm.expectRevert(PokerSeatLedger420.Unauthorized.selector);
        vm.prank(PLAYER); ledger.buyIn(TABLE,0,400);
        require(coin.balanceOf(address(ledger))==0,"phantom");
    }
    function testPauseBlocksFundingButAllowsWithdrawal() public {
        _open(); _buy();
        vm.prank(ADMIN); registry.pause(TABLE);
        vm.expectRevert(PokerSeatLedger420.NotOpen.selector);
        vm.prank(PLAYER); ledger.topUp(TABLE,200);
        vm.prank(PLAYER); ledger.leave(TABLE);
        require(coin.balanceOf(PLAYER)==5000,"refund");
    }
    function testEmergencyBlocksNewBuyInsButPreservesExit() public {
        _open(); _buy();
        emergency.setHalted(true);
        vm.expectRevert(PokerSeatLedger420.EmergencyHalt.selector);
        vm.prank(OTHER); ledger.buyIn(TABLE,1,400);
        vm.prank(PLAYER); ledger.leave(TABLE);
        require(coin.balanceOf(PLAYER)==5000,"exit");
    }
    function testInvalidBuyInAndOverCapRejected() public {
        _open();
        vm.expectRevert(PokerSeatLedger420.BuyInLimit.selector);
        vm.prank(PLAYER); ledger.buyIn(TABLE,0,1);
        _buy();
        vm.expectRevert(PokerSeatLedger420.BuyInLimit.selector);
        vm.prank(PLAYER); ledger.topUp(TABLE,1601);
        require(ledger.totalChips(TABLE)==400,"cap");
    }
    function testSitOutAndUnauthorizedWithdrawalRejection() public {
        _open(); _buy();
        vm.prank(PLAYER); ledger.sitOut(TABLE,true);
        require(ledger.seatOf(TABLE,0).sittingOut,"sitout");
        cap.grant(PLAYER,BetIds420.ACTION_POKER_WITHDRAW,auth.scopeForTable(TABLE),false);
        vm.expectRevert(PokerSeatLedger420.Unauthorized.selector);
        vm.prank(PLAYER); ledger.leave(TABLE);
        require(ledger.totalChips(TABLE)==400,"escrow kept");
    }
}

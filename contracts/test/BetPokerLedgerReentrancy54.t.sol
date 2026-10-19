// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./BetPokerSeatLedger53.t.sol";

contract PokerReentryConsumer54 {}

/// @dev Simulates an adversarial but exactly-accounted ERC20, including a
///      callback to a governance-authorized ledger mutation while transferring.
contract PokerReentrantToken54 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    address public callbackTarget;
    bytes public callbackData;
    bool public callbackAttempted;
    bool public callbackSucceeded;
    bytes4 public callbackRevertSelector;

    function mint(address to,uint256 amount) external {balanceOf[to]+=amount;}
    function approve(address spender,uint256 amount) external returns(bool){
        allowance[msg.sender][spender]=amount;return true;
    }
    function prepareCallback(address target,bytes calldata payload)external {
        callbackTarget=target;callbackData=payload;
    }
    function _tryCallback()private{
        if(callbackTarget==address(0))return;
        address target=callbackTarget;
        bytes memory payload=callbackData;
        callbackTarget=address(0); // one attempt even if vulnerability exists
        callbackAttempted=true;
        (bool success,bytes memory answer)=target.call(payload);
        callbackSucceeded=success;
        if(!success&&answer.length>=4){
            bytes4 reason;
            assembly {reason := mload(add(answer,32))}
            callbackRevertSelector=reason;
        }
    }
    function transferFrom(address from,address to,uint256 amount)external returns(bool){
        require(allowance[from][msg.sender]>=amount&&balanceOf[from]>=amount,"insufficient");
        allowance[from][msg.sender]-=amount;
        balanceOf[from]-=amount;balanceOf[to]+=amount;
        _tryCallback();
        return true;
    }
    function transfer(address to,uint256 amount)external returns(bool){
        require(balanceOf[msg.sender]>=amount,"insufficient");
        balanceOf[msg.sender]-=amount;balanceOf[to]+=amount;
        _tryCallback();
        return true;
    }
}
contract PokerLedgerReentrancy54Test is PokerSeatLedger53Test {
    PokerReentrantToken54 reentrantToken;
    PokerReentryConsumer54 consumer;
    constructor(){
        reentrantToken=new PokerReentrantToken54();
        consumer=new PokerReentryConsumer54();
        reentrantToken.mint(PLAYER,5000);
        cap.grant(address(reentrantToken),ledger.ACTION_BIND_SETTLEMENT(),
            auth.scopeForTable(TABLE),true);
        vm.prank(PLAYER);
        reentrantToken.approve(address(ledger),5000);
    }
    function _openReentrantToken() internal {
        PokerTableRegistry420.Configuration memory config=_config();
        config.asset=address(reentrantToken);
        vm.prank(ADMIN);registry.register(config,ADMIN);
        vm.prank(ADMIN);registry.approve(TABLE);
        vm.prank(ADMIN);registry.open(TABLE);
    }
    function testAdversarialTokenCannotReenterGovernanceBoundLedgerState() public {
        _openReentrantToken();
        bytes memory callback=abi.encodeWithSelector(ledger.bindSettlement.selector,
            TABLE,address(consumer),address(0xFEED));
        reentrantToken.prepareCallback(address(ledger),callback);
        vm.prank(PLAYER);ledger.buyIn(TABLE,0,400);
        require(reentrantToken.callbackAttempted(),"callback must execute");
        require(!reentrantToken.callbackSucceeded(),"callback must be blocked");
        require(reentrantToken.callbackRevertSelector()==PokerSeatLedger420.Reentrancy.selector,
            "explicit non-reentrancy guard");
        require(ledger.settlementCoordinator(TABLE)==address(0),"no forged settlement authority");
        require(ledger.seatOf(TABLE,0).chips==400,"correct cash seat");
        require(reentrantToken.balanceOf(address(ledger))==400,"real escrow transfer");
        require(ledger.totalChips(TABLE)==400,"no ghost collateral");
    }
    function testAdversarialTokenCannotReenterDuringExactWithdrawal() public {
        _openReentrantToken();
        vm.prank(PLAYER);ledger.buyIn(TABLE,0,400);
        bytes memory callback=abi.encodeWithSelector(ledger.bindSettlement.selector,
            TABLE,address(consumer),address(0xFEED));
        reentrantToken.prepareCallback(address(ledger),callback);
        vm.prank(PLAYER);ledger.leave(TABLE);
        require(reentrantToken.callbackAttempted()&&!reentrantToken.callbackSucceeded(),
            "withdraw callback denied");
        require(reentrantToken.callbackRevertSelector()==PokerSeatLedger420.Reentrancy.selector,
            "withdraw guarded");
        require(reentrantToken.balanceOf(address(ledger))==0,"no token remains");
        require(ledger.totalChips(TABLE)==0,"no liability remains");
        require(ledger.settlementCoordinator(TABLE)==address(0),"no injected settlement binding");
    }
}

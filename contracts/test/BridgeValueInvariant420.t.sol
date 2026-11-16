// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./BridgeValueConservation420.t.sol";
contract ValueInvariantHandler420 is ValueFixture420 {
 bool private initialized;bool public started;bool public resolved;bool public paid;uint256 public value;bytes32 public id;
 function initialize() external {require(!initialized);initialized=true;setupValue(false);inbound(100);}
 function begin(uint8 n) external {if(started||token.fail())return;value=uint256(n)%100+1;id=withdraw(value);started=true;}
 function retryPending() external {if(!started||resolved)return;(,,,,,,,BridgeTransferRegistry.Status stage,,)=f.transfers.transfers(id);if(stage==BridgeTransferRegistry.Status.DISPUTED)return;f.transfers.markFailed(id,keccak256("retry failure"));f.transfers.markRetryable(id,keccak256("retry allowed"));f.transfers.retry(id,keccak256("same backed withdrawal"));}
 function failToken(bool flag) external {token.setFail(flag);}
 function rejectOutcome(bool flag) external {outcome.setReject(flag);}
 function resolvePaid() external {if(!started)return;(bool ok,)=address(f.router).call(abi.encodeCall(f.router.resolveFundedOutbound,(id,receipt(id,true))));require(ok==(!resolved&&!outcome.reject()),"payment model");if(ok){resolved=true;paid=true;}}
 function resolveRefund() external {if(!started)return;if(!resolved){(,,,,,,,BridgeTransferRegistry.Status s,,)=f.transfers.transfers(id);if(s!=BridgeTransferRegistry.Status.DISPUTED)f.transfers.disputeTransfer(id,keccak256("cancellation requested"));}
  (bool ok,)=address(f.router).call(abi.encodeCall(f.router.resolveFundedOutbound,(id,receipt(id,false))));require(ok==(!resolved&&!outcome.reject()&&!token.fail()),"refund model");if(ok)resolved=true;
 }
 function check() external view {
  uint256 pending_=started&&!resolved?value:0;uint256 finalPaid=resolved&&paid?value:0;
  require(token.totalSupply()==custody.managedSupply(ASSET_ID)&&token.balanceOf(address(0xB0B))==token.totalSupply(),"unbacked/double token movement");
  require(custody.pendingAmount(ASSET_ID)==pending_&&token.totalSupply()+pending_==100-finalPaid,"conservation of claims");
  (uint256 route,uint256 asset)=f.risk.outstanding(ROUTE_ID,ASSET_ID);require(route==100-finalPaid&&asset==route,"obligation accounting drift");
  if(resolved){(,,,,,,,BridgeTransferRegistry.Status s,,)=f.transfers.transfers(id);require(s==(paid?BridgeTransferRegistry.Status.COMPLETED:BridgeTransferRegistry.Status.REFUNDED),"economic outcome/state drift");}
 }
}
contract BridgeValueInvariant420Test {
 ValueInvariantHandler420 handler;struct FuzzSelector{address addr;bytes4[] selectors;}
 function setUp() public {handler=new ValueInvariantHandler420();handler.initialize();}
 function targetContracts() public view returns(address[] memory a){a=new address[](1);a[0]=address(handler);}
 function targetSelectors() public view returns(FuzzSelector[] memory a){bytes4[] memory s=new bytes4[](6);s[0]=handler.begin.selector;s[1]=handler.retryPending.selector;s[2]=handler.failToken.selector;s[3]=handler.rejectOutcome.selector;s[4]=handler.resolvePaid.selector;s[5]=handler.resolveRefund.selector;a=new FuzzSelector[](1);a[0]=FuzzSelector(address(handler),s);}
 function invariantValueAndOutstandingObligationsConserved() public view {handler.check();}
}

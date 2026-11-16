// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./BitcoinCustodyCompletion420.t.sol";
contract BitcoinCustodyStateHandler420 is BitcoinCustodyFixture420 {
 bool initialized;bytes32 last;bytes32 lastApproval;bool everAuthorized;
 function initialize() external {require(!initialized);initialized=true;setupCustody(true);}
 function attempt(uint16 fee) external {fee=uint16(uint256(fee)%1000);(bytes32 previous,,,,,,,,,)=custody.authorizations(requestId);bool expected=custody.active()&&q.isCurrent(address(custody))&&backing.accept()&&fee<=500;(bool ok,bytes memory data)=address(custody).call(abi.encodeCall(custody.authorizeSigning,(requestId,transaction(fee,false),funding(),hex"01",previous)));require(ok==expected,"custody authorization model mismatch");if(ok){last=abi.decode(data,(bytes32));lastApproval=q.currentApproval(address(custody));everAuthorized=true;}}
 function revoke() external {bytes32 id=q.currentApproval(address(custody));if(id!=0)q.revoke(id,keccak256("invariant revoked authority"));}
 function halt() external {custody.setActive(false);}
 function restore() external {custody.setActive(false);qualifyCustody();custody.setActive(true);}
 function backingAvailable(bool yes) external {backing.setAccept(yes);}
 function check() external view {bool expected=everAuthorized&&custody.active()&&q.isCurrent(address(custody))&&lastApproval==q.currentApproval(address(custody));(bool ok,bytes memory data)=address(custody).staticcall(abi.encodeCall(custody.signingAuthorization,(requestId,last)));require((ok&&abi.decode(data,(bool)))==expected,"stale signing authority revived");if(everAuthorized)require(custody.reservedInputs(keccak256(abi.encode(prev,uint32(0))))==requestId,"custody UTXO reservation lost");}
}
contract BitcoinCustodyInvariant420Test {
 BitcoinCustodyStateHandler420 handler;struct FuzzSelector{address addr;bytes4[] selectors;}
 function setUp() public {handler=new BitcoinCustodyStateHandler420();handler.initialize();}
 function targetContracts() public view returns(address[] memory a){a=new address[](1);a[0]=address(handler);}
 function targetSelectors() public view returns(FuzzSelector[] memory a){bytes4[] memory s=new bytes4[](5);s[0]=handler.attempt.selector;s[1]=handler.revoke.selector;s[2]=handler.halt.selector;s[3]=handler.restore.selector;s[4]=handler.backingAvailable.selector;a=new FuzzSelector[](1);a[0]=FuzzSelector(address(handler),s);}
 function invariantNoStaleSigningAuthorityOrReleasedInputReservations() public view {handler.check();}
}

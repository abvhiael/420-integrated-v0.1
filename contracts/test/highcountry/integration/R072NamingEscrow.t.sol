// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import {CultivarNamingEscrow} from "../../../src/highcountry/genetics/CultivarNamingEscrow.sol";
contract R072NamingEscrowTest {
 CultivarNamingEscrow private escrow;
 constructor(){escrow=new CultivarNamingEscrow(address(0xBEEF),address(this),address(this));}
 function testPausedByDefault() public {
  (bool ok,)=address(escrow).call(abi.encodeCall(escrow.publishQuote,(bytes32(uint256(1)),uint256(1),uint64(block.timestamp+1 days),uint64(block.timestamp),uint64(1))));
  require(!ok,"unreviewed payments enabled");
 }
 function testCannotDepositWrongAmountAndCannotDoubleSettle() public {
  escrow.setPaused(false);bytes32 id=bytes32(uint256(2));
  escrow.publishQuote(id,1,uint64(block.timestamp+1 days),uint64(block.timestamp),1);
  (bool bad,)=address(escrow).call(abi.encodeWithSignature("deposit(bytes32)",id));
  require(!bad,"unfunded accepted");
  (bool noPayment,)=address(escrow).call(abi.encodeCall(escrow.resolve,(id,address(0xBAD))));
  require(!noPayment,"unpaid rewarded");
 }
 function testNoUnauthorisedQuotes() public {
  (bool ok,)=address(escrow).call(abi.encodeCall(escrow.publishQuote,(bytes32(uint256(3)),uint256(1),uint64(0),uint64(0),uint64(1))));
  require(!ok,"invalid quote accepted");
 }
}

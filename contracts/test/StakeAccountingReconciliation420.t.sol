// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./StakeValidatorGenesis420.t.sol";
interface VmAccounting420 {
 struct Log { bytes32[] topics; bytes data; address emitter; }
 function recordLogs() external;
 function getRecordedLogs() external returns(Log[] memory);
 function toString(uint256) external pure returns(string memory);
 function toString(address) external pure returns(string memory);
 function toString(bytes32) external pure returns(string memory);
 function toString(bytes calldata) external pure returns(string memory);
 function writeFile(string calldata,string calldata) external;
}
// Exports real frozen-contract events and independent getter observations for
// the Go accounting reducer. Fixture operators are not production signers.
contract StakeAccountingReconciliation420Test is StakeValidatorGenesis420Test {
 VmAccounting420 constant auditVM=VmAccounting420(address(uint160(uint256(keccak256("hevm cheat code")))));
 string steps; bytes32 auditId;
 function pair(string memory key,uint256 value) internal pure returns(string memory){return string.concat('"',key,'":"',auditVM.toString(value),'",');}
 function fixedAddress(address a) internal view returns(address){if(a==address(registry))return address(0x423);if(a==address(reserve))return address(0x425);if(a==address(rewards))return address(0x420);return a;}
 function capture() internal {
  VmAccounting420.Log[] memory logs=auditVM.getRecordedLogs();string memory encoded="[";
  for(uint256 i;i<logs.length;i++){if(i>0)encoded=string.concat(encoded,",");string memory topics="[";for(uint256 j;j<logs[i].topics.length;j++){if(j>0)topics=string.concat(topics,",");topics=string.concat(topics,'"',auditVM.toString(logs[i].topics[j]),'"');}encoded=string.concat(encoded,'{"address":"',auditVM.toString(fixedAddress(logs[i].emitter)),'","topics":',topics,'],"data":"',auditVM.toString(logs[i].data),'"}');}
  ValidatorRegistry.Validator memory v=registry.getValidator(auditId);string memory prefix=string.concat("validator/",auditVM.toString(auditId),"/");string memory credit=string.concat("credit/",auditVM.toString(auditId),"/");
  string memory state=string.concat("{",pair("totalOwnedCustody",registry.totalOwnedCustody()),pair("totalProtocolCreditCustody",registry.totalProtocolCreditCustody()),pair("totalPendingProtocolCredit",registry.totalPendingProtocolCredit()),pair("totalOwnedSlashed",registry.totalOwnedSlashed()),pair("totalProtocolCreditRecycled",registry.totalProtocolCreditRecycled()),pair("totalOwnedWithdrawn",registry.totalOwnedWithdrawn()),pair("eligibleValidatorCount",registry.eligibleValidatorCount()),pair("lastRotationSnapshot",registry.lastRotationSnapshot()),pair("totalAssigned",reserve.totalAssigned()),pair("totalFunded",reserve.totalFunded()));
  state=string.concat(state,pair("balance/0x0000000000000000000000000000000000000423",address(registry).balance),pair("balance/0x0000000000000000000000000000000000000425",address(reserve).balance),pair("balance/0x0000000000000000000000000000000000000424",registry.PROTOCOL_RESERVE().balance),pair(string.concat(prefix,"owned"),v.ownedBond),pair(string.concat(prefix,"credit"),v.protocolCredit),pair(string.concat(prefix,"status"),uint256(v.status)),pair(string.concat(prefix,"totalSlashed"),v.totalSlashed),pair(string.concat(credit,"assigned"),reserve.assignedCredit(auditId)),pair(string.concat(credit,"funded"),reserve.fundedCredit(auditId)));
  state=string.concat(state,pair("grossSecurityIssued",rewards.grossSecurityIssued()),pair("grossAttentionIssued",rewards.grossAttentionIssued()),'"grossDevelopmentIssued":"',auditVM.toString(rewards.grossDevelopmentIssued()),'"}');
  if(bytes(steps).length>0)steps=string.concat(steps,",");steps=string.concat(steps,'{"block":',auditVM.toString(block.number),',"logs":',encoded,'],"state":',state,'}');auditVM.recordLogs();
 }
 function testAccountingRealContractsExport() public {
  auditVM.recordLogs();capture();address operator;(auditId,operator)=_registerMatched("accounting",91);capture();
  vm.deal(operator,10000 ether);vm.prank(operator);registry.replaceProtocolCredit{value:10000 ether}(auditId);capture();
  _state(auditId,ValidatorRegistry.Status.PROBATION,1,0,0,0);vm.prank(SYSTEM_CALLER);registry.applySlash(auditId,ValidatorRegistry.SlashOffense.DOUBLE_VOTE,0,310 ether,110 ether,keccak256("accounting-slash"),ValidatorRegistry.Status.SUSPENDED);capture();
  vm.deal(operator,420 ether);vm.prank(operator);registry.topUpOwnedBond{value:420 ether}(auditId);capture();
  _state(auditId,ValidatorRegistry.Status.PROBATION,2,0,0,0);_rollPastActivation(auditId);_state(auditId,ValidatorRegistry.Status.ELIGIBLE,3,1,0,0);_snapshot(1,1);vm.prank(SYSTEM_CALLER);registry.applyExitNotice(auditId,1);_snapshot(2,1);_state(auditId,ValidatorRegistry.Status.WITHDRAWAL_HOLD,4,1,0,0);capture();
  ValidatorRegistry.Validator memory held=registry.getValidator(auditId);vm.roll(held.withdrawableBlock);_state(auditId,ValidatorRegistry.Status.WITHDRAWABLE,5,1,0,0);vm.prank(held.withdrawal);registry.withdrawBond(auditId);capture();
  vm.roll(1);address[] memory participants=new address[](2);participants[0]=address(bytes20(hex"0200000000000000000000000000000000000000"));participants[1]=address(bytes20(hex"0300000000000000000000000000000000000000"));vm.prank(SYSTEM_CALLER);rewards.applyConsensusReward(1,address(bytes20(hex"0100000000000000000000000000000000000000")),participants,595238095237800000,42517006802700000,1504761904762200000,1504761904762200000);capture();
  (auditId,)=_registerMatched("accounting-finality",92);_state(auditId,ValidatorRegistry.Status.PROBATION,6,0,0,0);vm.prank(SYSTEM_CALLER);registry.applySlash(auditId,ValidatorRegistry.SlashOffense.FINALITY_EQUIVOCATION,2,21000 ether,21000 ether,keccak256("accounting-finality"),ValidatorRegistry.Status.SUSPENDED);capture();
  (auditId,operator)=_matchedId("accounting-release",93);reserve.assignCredit(auditId,operator,21000 ether);capture();reserve.releaseCredit(auditId);capture();
  (auditId,operator)=_matchedId("accounting-reclaim",94);reserve.assignCredit(auditId,operator,21000 ether);reserve.fundCredit(auditId);capture();reserve.reclaimUnregisteredCredit(auditId);capture();reserve.treasuryTransfer(payable(address(0xBEEF)),1 ether,keccak256("accounting-reserve-allocation"));capture();
  auditVM.writeFile("out/stake-accounting-real-evm.json",string.concat('[',steps,']'));
 }
}

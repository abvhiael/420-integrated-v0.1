// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../../interfaces/IBridgeValueCustody420.sol";
import "./BitcoinCustody420.sol";
import "../BridgeTransferRegistry.sol";
/// Adapter over the already-qualified current-tip Bitcoin payout receipt. No new consensus/signing.
/// Source payment policy remains six canonical confirmations, not mathematical reorg immunity.
contract BitcoinCustodyOutcome420 is IBridgeWithdrawalOutcome420 {
 BitcoinCustody420 public immutable custody;BridgeTransferRegistry public immutable transfers;
 constructor(BitcoinCustody420 c,BridgeTransferRegistry t){require(address(c).code.length!=0&&address(t).code.length!=0);custody=c;transfers=t;}
 function configurationState() external view returns(bytes32){return keccak256(abi.encode(address(custody),address(transfers),custody.configurationState()));}
 function verifyOutcome(bytes calldata proof) external view returns(Receipt memory r){
  bytes32 id=abi.decode(proof,(bytes32));require(keccak256(proof)==keccak256(abi.encode(id)),"canonical Bitcoin outcome");
  (bytes32 route,bytes32 asset,address sender,,uint256 amount,,bytes32 message,,,)=transfers.transfers(id);
  IBitcoinWithdrawal420.Request memory request=custody.adapter().outboundMessage(message);
  require(request.messageId==message&&request.routeId==route&&request.assetId==asset&&request.sender==sender&&request.amountSatoshis==amount&&request.sourceChainId==block.chainid&&keccak256(request.recipientProgram)==transfers.externalRecipientHash(id),"Bitcoin withdrawal binding");
  (bytes32 txid,bytes32 blockHash,bytes memory script,uint64 paid,bytes32 e)=custody.observedPayment(message);
  require(paid==amount&&keccak256(script)==keccak256(custody.adapter().outboundScript(message))&&e!=0,"Bitcoin payout receipt");
  r=Receipt(id,message,route,asset,sender,keccak256(request.recipientProgram),amount,txid,keccak256(abi.encode("420/BTC/OUTCOME/V1",message,txid,blockHash,e)),true,transfers.transferQualification(id));
 }
}

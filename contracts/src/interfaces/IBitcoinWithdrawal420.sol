// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
interface IBitcoinWithdrawal420 {
 struct Request {uint256 sourceChainId;address sourceRouter;address sourceAdapter;bytes32 messageId;bytes32 routeId;bytes32 assetId;address sender;bytes recipientProgram;uint8 scriptType;uint64 amountSatoshis;uint256 nonce;}
 function outboundMessage(bytes32 messageId) external view returns(Request memory);
 function outboundScript(bytes32 messageId) external view returns(bytes memory);
}
/// @notice Authenticates finalized representation burn/escrow backing and actual custody UTXOs.
/// @dev A qualified implementation must bind the full signing commitment and independently authenticate
/// UTXO amounts, scripts, ownership and unspentness against its approved full-node/custody authority.
/// RPC flags or caller-supplied input amounts alone are not authority. No implementation is auto-approved.
interface IBitcoinCustodyBacking420 {
 function verifyBacking(bytes32 requestId,bytes32 signingCommitment,bytes calldata evidence) external view returns(bool);
}
interface IBitcoinCustody420 {
 struct FundingInput {bytes32 txid;uint32 outputIndex;uint64 amountSatoshis;bytes32 scriptHash;}
 function authorizeSigning(bytes32 requestId,bytes calldata unsignedTransaction,FundingInput[] calldata funding,bytes calldata backingEvidence,bytes32 expectedPrevious) external returns(bytes32 signingCommitment);
 function signingAuthorization(bytes32 requestId,bytes32 signingCommitment) external view returns(bool);
}

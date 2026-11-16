// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
interface IBridgeValueToken420 {
 function decimals() external view returns(uint8);
 function balanceOf(address) external view returns(uint256);
 function totalSupply() external view returns(uint256);
 function transfer(address,uint256) external returns(bool);
 function transferFrom(address,address,uint256) external returns(bool);
 function bridgeMint(address,uint256) external;
 function bridgeBurnFrom(address,uint256) external;
}
/// Receipt verifier must authenticate final destination payment OR irrevocable cancellation
/// of every source payment authorization, including replaced transactions. A timeout is neither.
/// Authenticate the original transfer qualification/route/network/gateway binding, not current
/// route metadata or caller assertions. Source refunds additionally prove actual source repayment.
interface IBridgeWithdrawalOutcome420 {
 struct Receipt {bytes32 transferId;bytes32 messageId;bytes32 route;bytes32 asset;address sender;bytes32 recipientHash;uint256 amount;bytes32 sourceTxId;bytes32 proofId;bool paid;bytes32 qualification;}
 function verifyOutcome(bytes calldata) external returns(Receipt memory);
}
interface IBridgeValueCustody420 {
 function settleInbound(bytes32) external returns(bytes32);
 function reserve(bytes32,bytes32,address,uint256) external;
 function bindOutbound(bytes32) external;
 function resolveInboundRefund(bytes32,bytes calldata) external returns(bytes32);
 function resolveOutbound(bytes32,bytes calldata) external returns(bool,bytes32);
 function outcomeEvidence(bytes32) external view returns(bool,bytes32);
 function conservationHealthy(bytes32) external view returns(bool);
}

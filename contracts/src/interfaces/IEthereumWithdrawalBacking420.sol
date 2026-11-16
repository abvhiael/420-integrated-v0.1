// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./IEthereumOutboundMessage420.sol";
/// Approved source-side verifier of finalized 420 request AND actual burn/escrow backing.
/// Cancellation proves finalized cancellation intent; the gateway's permanent cancellation
/// marker must itself be finalized before 420 refunds. A stale pending-state proof is insufficient.
interface IEthereumWithdrawalBacking420 {
 function verifyBacking(IEthereumOutboundMessage420.OutboundMessage calldata,bytes calldata,bool cancellation) external view returns(bytes32 commitment);
}
/// Proves an irrevocable, unminted DISPUTED inbound on finalized 420 state, with its
/// source-message replay key consumed. This prevents old deposit proofs crediting after refund.
interface IEthereumDepositRefundBacking420 {function verifyDepositRefund(bytes32 messageId,bytes calldata proof) external view returns(bytes32 commitment);}

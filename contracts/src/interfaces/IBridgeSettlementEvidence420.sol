// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
/// @notice Receipt produced only after the qualified adapter authenticated actual destination delivery.
/// @dev Not a substitute for verifier qualification. Pure proof adapters without delivery cannot complete settlement.
interface IBridgeSettlementEvidence420 {
    function settlementEvidence(bytes32 sourceMessageId) external view returns(address token,address recipient,uint256 amount,bytes32 evidenceHash);
}

// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
interface IAccounting420 {
    struct Reconciliation {
        bytes32 subjectId; uint256 authorizedAmount; uint256 observedAmount;
        uint64 observedAt; bytes32 evidenceHash; bool healthy;
    }
    function reconciliation(bytes32 subjectId) external view returns (Reconciliation memory);
}

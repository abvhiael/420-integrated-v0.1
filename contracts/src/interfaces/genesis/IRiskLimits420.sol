// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface IRiskLimits420 {
    struct LimitView {
        bytes32 subjectId;
        bytes32 limitType;
        uint64 windowSeconds;
        uint256 maximum;
        uint256 used;
        uint256 remaining;
    }

    function limit(bytes32 subjectId,bytes32 limitType) external view returns(LimitView memory);
}

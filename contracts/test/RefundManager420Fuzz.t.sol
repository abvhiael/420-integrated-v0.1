// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/pay/RefundManager420.sol";
import "./helpers/GenesisMocks420.sol";

contract RefundManager420FuzzTest {
    function _recordRefund(
        RefundManager420 r,
        bytes32 refundId,
        bytes32 paymentId,
        address settlementAsset,
        uint256 amount,
        uint256 maximum
    ) internal {
        r.recordRefund(refundId, paymentId, settlementAsset, address(0xBEEF), amount, maximum, bytes32(0));
    }

    function testFuzz_RefundNeverExceedsMaximum(uint96 maximum, uint96 first, uint96 second) public {
        if (maximum == 0) return;
        GenesisMockEnvironment420 env = new GenesisMockEnvironment420();
        RefundManager420 r = new RefundManager420(address(this), address(env.registry()), keccak256("refund-fuzz"));
        env.registerResident(address(r), r.componentId());
        address settlementAsset = address(0xCA420);
        env.setSettlementAsset(settlementAsset, keccak256("CADC"), true);
        bytes32 paymentId = keccak256("payment");
        uint256 a = (uint256(first) % uint256(maximum)) + 1;
        _recordRefund(r, keccak256("r1"), paymentId, settlementAsset, a, maximum);
        uint256 room = uint256(maximum) - a;
        if (room == 0) return;
        uint256 b = (uint256(second) % room) + 1;
        _recordRefund(r, keccak256("r2"), paymentId, settlementAsset, b, maximum);
        require(r.refundedByPayment(paymentId) <= maximum, "refund overflow");
    }

    function testRefundAllowedWhenSystemDegraded() public {
        GenesisMockEnvironment420 env = new GenesisMockEnvironment420();
        RefundManager420 r = new RefundManager420(address(this), address(env.registry()), keccak256("refund-safe"));
        env.registerResident(address(r), r.componentId());
        address settlementAsset = address(0xCA420);
        env.setSettlementAsset(settlementAsset, keccak256("CADC"), true);
        env.safety().setState(ISystemSafety420.SafetyState.DEGRADED);
        _recordRefund(r, keccak256("r"), keccak256("p"), settlementAsset, 1, 1);
        require(r.refundedByPayment(keccak256("p")) == 1, "safe refund blocked");
    }
}

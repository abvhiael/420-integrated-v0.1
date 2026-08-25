// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/pay/RefundManager420.sol";
import "./helpers/GenesisMocks420.sol";

contract RefundManager420FuzzTest {
    function testFuzz_RefundNeverExceedsMaximum(uint96 maximum, uint96 first, uint96 second) public {
        if (maximum == 0) return;
        GenesisMockEnvironment420 env = new GenesisMockEnvironment420();
        RefundManager420 r = new RefundManager420(address(this), address(env.registry()), keccak256("refund-fuzz"));
        env.registerResident(address(r), r.componentId());
        address settlementAsset = address(0xCA420);
        bytes32 assetId = keccak256("CADC");
        env.setSettlementAsset(settlementAsset, assetId, true);
        bytes32 paymentId = keccak256("payment");
        uint256 a = (uint256(first) % uint256(maximum)) + 1;
        r.recordRefund(keccak256("r1"), paymentId, settlementAsset, address(0xBEEF), a, maximum, bytes32(0));
        uint256 room = uint256(maximum) - a;
        if (room == 0) return;
        uint256 b = (uint256(second) % room) + 1;
        r.recordRefund(keccak256("r2"), paymentId, settlementAsset, address(0xBEEF), b, maximum, bytes32(0));
        require(r.refundedByPayment(paymentId) <= maximum, "refund overflow");
    }

    function testRefundAllowedWhenSystemDegraded() public {
        GenesisMockEnvironment420 env = new GenesisMockEnvironment420();
        RefundManager420 r = new RefundManager420(address(this), address(env.registry()), keccak256("refund-safe"));
        env.registerResident(address(r), r.componentId());
        address settlementAsset = address(0xCA420);
        bytes32 assetId = keccak256("CADC");
        env.setSettlementAsset(settlementAsset, assetId, true);
        env.safety().setState(ISystemSafety420.SafetyState.DEGRADED);
        r.recordRefund(keccak256("r"), keccak256("p"), settlementAsset, address(0xBEEF), 1, 1, bytes32(0));
        require(r.refundedByPayment(keccak256("p")) == 1, "safe refund blocked");
    }
}

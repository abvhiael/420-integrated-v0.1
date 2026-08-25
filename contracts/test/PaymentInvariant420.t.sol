// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/pay/RefundManager420.sol";
import "../src/pay/SettlementRouter420.sol";
import "../src/pay/PaymentRouter420.sol";
import "./helpers/GenesisMocks420.sol";

interface Vm420Invariant {
    function targetContract(address target) external;
}

contract PayInvariantHandler420 {
    RefundManager420 public refunds;
    SettlementRouter420 public splits;
    address public settlementAsset;
    bool public configured;
    bytes32 public constant PAYMENT_ID = keccak256("invariant-payment");
    uint256 public constant REFUND_MAXIMUM = 1_000_000 ether;

    uint256 public lastSplitInput;
    uint256 public lastSplitOutput;

    function configure(RefundManager420 refunds_, SettlementRouter420 splits_, address settlementAsset_) external {
        if (configured) return;
        configured = true;
        refunds = refunds_;
        splits = splits_;
        settlementAsset = settlementAsset_;
    }

    function stepRefund(uint96 rawAmount) external {
        uint256 refunded = refunds.refundedByPayment(PAYMENT_ID);
        if (refunded >= REFUND_MAXIMUM) return;
        uint256 room = REFUND_MAXIMUM - refunded;
        uint256 amount = (uint256(rawAmount) % room) + 1;
        bytes32 refundId = keccak256(abi.encode(refunded, rawAmount, block.number));
        refunds.recordRefund(refundId, PAYMENT_ID, settlementAsset, address(0xBEEF), amount, REFUND_MAXIMUM, bytes32(0));
    }

    function stepSplit(uint96 rawAmount, uint16 a, uint16 b) external {
        uint256 amount = uint256(rawAmount) + 1;
        uint256 aa = uint256(a) % 10001;
        uint256 bb = uint256(b) % (10001 - aa);
        uint16[] memory bps = new uint16[](3);
        bps[0] = uint16(aa);
        bps[1] = uint16(bb);
        bps[2] = uint16(10000 - aa - bb);
        uint256[] memory out = splits.splitAmounts(amount, bps, 0);
        lastSplitInput = amount;
        lastSplitOutput = out[0] + out[1] + out[2];
    }
}

contract PaymentInvariant420Test {
    Vm420Invariant internal constant vm = Vm420Invariant(address(uint160(uint256(keccak256("hevm cheat code")))));

    GenesisMockEnvironment420 internal env;
    RefundManager420 internal refunds;
    SettlementRouter420 internal splits;
    PaymentRouter420 internal router;
    PayInvariantHandler420 internal handler;

    function setUp() public {
        env = new GenesisMockEnvironment420();
        refunds = new RefundManager420(address(this), address(env.registry()), keccak256("refund-invariant"));
        splits = new SettlementRouter420(address(this), address(env.registry()), keccak256("split-invariant"));
        router = new PaymentRouter420(address(this), address(env.registry()), keccak256("router-invariant"));
        env.registerResident(address(refunds), refunds.componentId());
        env.registerResident(address(splits), splits.componentId());
        env.registerResident(address(router), router.componentId());

        address settlementAsset = address(0xCA420);
        env.setSettlementAsset(settlementAsset, keccak256("CADC"), true);
        // The invariant handler is the governance timelock for the refund instance it mutates.
        handler = new PayInvariantHandler420();
        RefundManager420 handlerRefunds = new RefundManager420(
            address(handler), address(env.registry()), keccak256("handler-refund-invariant")
        );
        env.registerResident(address(handlerRefunds), handlerRefunds.componentId());
        handler.configure(handlerRefunds, splits, settlementAsset);
        vm.targetContract(address(handler));
    }

    function invariant_ProtocolFeeRemainsZero() public view {
        require(router.PROTOCOL_FEE_BPS() == 0, "protocol fee changed");
    }

    function invariant_RefundsNeverExceedMaximum() public view {
        RefundManager420 hRefunds = handler.refunds();
        require(
            hRefunds.refundedByPayment(handler.PAYMENT_ID()) <= handler.REFUND_MAXIMUM(),
            "refund maximum exceeded"
        );
    }

    function invariant_SplitConservation() public view {
        require(handler.lastSplitOutput() == handler.lastSplitInput(), "split conservation");
    }
}

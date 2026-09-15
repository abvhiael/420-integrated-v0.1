// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/accounts/EntryPoint420.sol";
import "../src/accounts/IPaymaster420.sol";
import "../src/accounts/PaymasterData420.sol";

interface VmGas4 {
    function chainId(uint256 newChainId) external;
    function warp(uint256 newTimestamp) external;
    function deal(address who, uint256 newBalance) external;
}

contract Gas4Account420 is IAccountValidation420 {
    uint256 public executions;

    function validateUserOp(PackedUserOperation420 calldata, bytes32, uint256) external pure returns (uint256) {
        return 0;
    }

    function execute() external { executions += 1; }

    function executeAndRevert() external pure { revert("account execution reverted"); }
}

contract Gas4Paymaster420 is IPaymaster420 {
    bool public revertPostOp;
    uint256 public postOpCalls;
    PostOpMode420 public lastMode;
    uint256 public lastActualGasCostWei;
    bytes32 public lastContextHash;

    function setRevertPostOp(bool value) external { revertPostOp = value; }

    function validatePaymasterUserOp(PackedUserOperation420 calldata, bytes32, uint256)
        external
        pure
        returns (bytes memory context, uint256 validationData)
    {
        return (abi.encode("gas4-context", uint256(420)), 0);
    }

    function postOp(PostOpMode420 mode, bytes calldata context, uint256 actualGasCostWei) external {
        if (revertPostOp) revert("postOp rejected");
        postOpCalls += 1;
        lastMode = mode;
        lastActualGasCostWei = actualGasCostWei;
        lastContextHash = keccak256(context);
    }
}

contract EntryPointPaymasterSettlement420Test {
    VmGas4 internal constant vm = VmGas4(address(uint160(uint256(keccak256("hevm cheat code")))));

    EntryPoint420 internal entryPoint;
    Gas4Account420 internal account;
    Gas4Paymaster420 internal paymaster;

    function setUp() public {
        vm.chainId(420);
        vm.warp(500);
        vm.deal(address(this), 100 ether);
        entryPoint = new EntryPoint420();
        account = new Gas4Account420();
        paymaster = new Gas4Paymaster420();
        entryPoint.depositTo{value: 10 ether}(address(paymaster));
    }

    function testSuccessfulExecutionSettlesAndCallsPostOp() public {
        bytes32 authorizationId = keccak256("420/GAS/GAS4/SUCCESS");
        PackedUserOperation420 memory op = _sponsoredOp(0, authorizationId, false);
        uint256 beforeDeposit = entryPoint.balanceOf(address(paymaster));
        uint256 reserve = 221_000 * 1 gwei;

        (bool success,) = entryPoint.handleOp(op);
        require(success, "execution failed");
        require(account.executions() == 1, "account not executed");
        require(paymaster.postOpCalls() == 1, "postOp not called");
        require(uint256(paymaster.lastMode()) == uint256(PostOpMode420.OpSucceeded), "wrong postOp mode");
        require(paymaster.lastActualGasCostWei() > 0, "zero settlement charge");
        require(paymaster.lastActualGasCostWei() <= reserve, "charge exceeds reservation");
        require(entryPoint.balanceOf(address(paymaster)) == beforeDeposit - paymaster.lastActualGasCostWei(), "deposit charge mismatch");
        require(entryPoint.reservedOf(address(paymaster)) == 0, "reservation not released");
        require(paymaster.lastContextHash() == keccak256(abi.encode("gas4-context", uint256(420))), "context mismatch");
    }

    function testRevertedExecutionStillSettlesWithRevertedMode() public {
        bytes32 authorizationId = keccak256("420/GAS/GAS4/REVERT");
        PackedUserOperation420 memory op = _sponsoredOp(0, authorizationId, true);
        uint256 beforeDeposit = entryPoint.balanceOf(address(paymaster));

        (bool success,) = entryPoint.handleOp(op);
        require(!success, "reverted account reported success");
        require(paymaster.postOpCalls() == 1, "postOp not called on revert");
        require(uint256(paymaster.lastMode()) == uint256(PostOpMode420.OpReverted), "wrong revert postOp mode");
        require(paymaster.lastActualGasCostWei() > 0, "reverted execution not charged");
        require(entryPoint.balanceOf(address(paymaster)) == beforeDeposit - paymaster.lastActualGasCostWei(), "revert charge mismatch");
        require(entryPoint.reservedOf(address(paymaster)) == 0, "revert reservation not released");
        require(entryPoint.getNonce(address(account), 0) == 1, "nonce not consumed after attempted execution");
    }

    function testRevertingPostOpCannotUndoSettlementOrExecution() public {
        paymaster.setRevertPostOp(true);
        bytes32 authorizationId = keccak256("420/GAS/GAS4/POSTOP-REVERT");
        PackedUserOperation420 memory op = _sponsoredOp(0, authorizationId, false);
        uint256 beforeDeposit = entryPoint.balanceOf(address(paymaster));

        (bool success,) = entryPoint.handleOp(op);
        require(success, "postOp revert escaped handleOp");
        require(account.executions() == 1, "execution undone by postOp");
        require(entryPoint.balanceOf(address(paymaster)) < beforeDeposit, "settlement undone by postOp");
        require(entryPoint.reservedOf(address(paymaster)) == 0, "reservation retained after postOp revert");
        require(entryPoint.getNonce(address(account), 0) == 1, "nonce undone by postOp revert");
    }

    function testSettlementNeverChargesBeyondReservedMaximum() public {
        bytes32 authorizationId = keccak256("420/GAS/GAS4/CAP");
        PackedUserOperation420 memory op = _sponsoredOp(0, authorizationId, false);
        uint256 reserve = 221_000 * 1 gwei;
        uint256 beforeDeposit = entryPoint.balanceOf(address(paymaster));

        entryPoint.handleOp(op);
        uint256 charged = beforeDeposit - entryPoint.balanceOf(address(paymaster));
        require(charged > 0, "nothing charged");
        require(charged <= reserve, "settlement exceeded reserved maximum");
    }

    function _sponsoredOp(uint256 nonceValue, bytes32 authorizationId, bool shouldRevert)
        internal
        view
        returns (PackedUserOperation420 memory op)
    {
        uint256 verificationGasLimit = 100_000;
        uint256 callGasLimit = 100_000;
        bytes memory callData = shouldRevert
            ? abi.encodeWithSelector(Gas4Account420.executeAndRevert.selector)
            : abi.encodeWithSelector(Gas4Account420.execute.selector);

        op = PackedUserOperation420({
            sender: address(account),
            nonce: nonceValue,
            initCode: bytes(""),
            callData: callData,
            accountGasLimits: bytes32((verificationGasLimit << 128) | callGasLimit),
            preVerificationGas: 21_000,
            gasFees: bytes32(uint256(1 gwei)),
            paymasterAndData: bytes(""),
            signature: bytes("")
        });

        PaymasterData420.V1 memory data = PaymasterData420.V1({
            version: 1,
            paymaster: address(paymaster),
            entryPoint: address(entryPoint),
            chainId: 420,
            policyId: keccak256("420/GAS/GAS4/POLICY"),
            validAfter: 100,
            validUntil: 1000,
            maxSponsoredCostWei: 1 ether,
            authorizationId: authorizationId,
            sponsorData: hex"0420"
        });
        op.paymasterAndData = PaymasterData420.encodeV1(data);
    }
}

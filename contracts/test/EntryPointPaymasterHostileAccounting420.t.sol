// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/accounts/EntryPoint420.sol";
import "../src/accounts/IPaymaster420.sol";
import "../src/accounts/PaymasterData420.sol";

interface VmGas11Accounting420 {
    function chainId(uint256 newChainId) external;
    function warp(uint256 newTimestamp) external;
    function deal(address who, uint256 newBalance) external;
}

contract Gas11HostileAccount420 is IAccountValidation420 {
    uint256 public executions;
    bool public shouldRevert;

    function setShouldRevert(bool value) external {
        shouldRevert = value;
    }

    function validateUserOp(PackedUserOperation420 calldata, bytes32, uint256) external pure returns (uint256) {
        return 0;
    }

    function execute() external {
        executions += 1;
        if (shouldRevert) revert("hostile account revert");
    }
}

contract Gas11HostilePaymaster420 is IPaymaster420 {
    EntryPoint420 public immutable entryPoint;

    bool public validateHandleOpReentryBlocked;
    bool public validateWithdrawReentryBlocked;
    bool public postOpHandleOpReentryBlocked;
    bool public postOpWithdrawReentryBlocked;
    uint256 public postOpCalls;
    uint256 public lastActualGasCostWei;

    constructor(EntryPoint420 entryPoint_) {
        entryPoint = entryPoint_;
    }

    function validatePaymasterUserOp(PackedUserOperation420 calldata userOp, bytes32, uint256)
        external
        returns (bytes memory context, uint256 validationData)
    {
        (bool handleOk,) = address(entryPoint).call(
            abi.encodeWithSelector(EntryPoint420.handleOp.selector, userOp)
        );
        validateHandleOpReentryBlocked = !handleOk;

        (bool withdrawOk,) = address(entryPoint).call(
            abi.encodeWithSelector(EntryPoint420.withdrawTo.selector, payable(address(this)), 1 wei)
        );
        validateWithdrawReentryBlocked = !withdrawOk;

        return (abi.encode(userOp.nonce), 0);
    }

    function postOp(PostOpMode420, bytes calldata, uint256 actualGasCostWei) external {
        postOpCalls += 1;
        lastActualGasCostWei = actualGasCostWei;

        PackedUserOperation420 memory emptyOp;
        (bool handleOk,) = address(entryPoint).call(
            abi.encodeWithSelector(EntryPoint420.handleOp.selector, emptyOp)
        );
        postOpHandleOpReentryBlocked = !handleOk;

        (bool withdrawOk,) = address(entryPoint).call(
            abi.encodeWithSelector(EntryPoint420.withdrawTo.selector, payable(address(this)), 1 wei)
        );
        postOpWithdrawReentryBlocked = !withdrawOk;
    }

    function withdrawTo(address payable recipient, uint256 amountWei) external {
        entryPoint.withdrawTo(recipient, amountWei);
    }

    receive() external payable {}
}

contract EntryPointPaymasterHostileAccounting420Test {
    VmGas11Accounting420 internal constant vm =
        VmGas11Accounting420(address(uint160(uint256(keccak256("hevm cheat code")))));

    EntryPoint420 internal entryPoint;
    Gas11HostileAccount420 internal account;
    Gas11HostilePaymaster420 internal paymaster;

    receive() external payable {}

    function setUp() public {
        vm.chainId(420);
        vm.warp(500);
        vm.deal(address(this), 100 ether);
        entryPoint = new EntryPoint420();
        account = new Gas11HostileAccount420();
        paymaster = new Gas11HostilePaymaster420(entryPoint);
        entryPoint.depositTo{value: 10 ether}(address(paymaster));
    }

    function testValidationCallbackCannotReenterHandleOpOrWithdraw() public {
        bytes32 authorizationId = keccak256("420/GAS/GAS11.2/VALIDATE-REENTRY");
        PackedUserOperation420 memory op = _sponsoredOp(0, authorizationId);
        uint256 beforeDeposit = entryPoint.balanceOf(address(paymaster));

        (bool success,) = entryPoint.handleOp(op);

        require(success, "outer operation failed");
        require(paymaster.validateHandleOpReentryBlocked(), "validate handleOp reentry succeeded");
        require(paymaster.validateWithdrawReentryBlocked(), "validate withdrawal race succeeded");
        require(account.executions() == 1, "outer account did not execute exactly once");
        require(entryPoint.reservedOf(address(paymaster)) == 0, "reservation remained after settlement");
        require(entryPoint.balanceOf(address(paymaster)) < beforeDeposit, "operation was not settled");
    }

    function testPostOpCannotReenterHandleOpOrWithdrawOrDoubleSettle() public {
        bytes32 authorizationId = keccak256("420/GAS/GAS11.2/POSTOP-REENTRY");
        PackedUserOperation420 memory op = _sponsoredOp(0, authorizationId);
        uint256 beforeDeposit = entryPoint.balanceOf(address(paymaster));

        (bool success,) = entryPoint.handleOp(op);
        require(success, "outer operation failed");

        uint256 charged = beforeDeposit - entryPoint.balanceOf(address(paymaster));
        require(charged == paymaster.lastActualGasCostWei(), "settlement charge mismatch");
        require(paymaster.postOpCalls() == 1, "postOp called more than once");
        require(paymaster.postOpHandleOpReentryBlocked(), "postOp handleOp reentry succeeded");
        require(paymaster.postOpWithdrawReentryBlocked(), "postOp withdrawal race succeeded");
        require(entryPoint.reservedOf(address(paymaster)) == 0, "reservation remained active");
        require(entryPoint.authorizationConsumed(address(paymaster), authorizationId), "authorization not consumed");
    }

    function testConsumedAuthorizationCannotChargeSponsorTwice() public {
        bytes32 authorizationId = keccak256("420/GAS/GAS11.2/DOUBLE-SETTLE");
        PackedUserOperation420 memory first = _sponsoredOp(0, authorizationId);

        (bool success,) = entryPoint.handleOp(first);
        require(success, "first sponsored operation failed");
        uint256 afterFirst = entryPoint.balanceOf(address(paymaster));

        PackedUserOperation420 memory second = _sponsoredOp(1, authorizationId);
        (bool ok, bytes memory reason) = address(entryPoint).call(
            abi.encodeWithSelector(EntryPoint420.handleOp.selector, second)
        );

        require(!ok, "consumed authorization replay accepted");
        require(
            _selector(reason) == EntryPoint420.SponsorshipAuthorizationAlreadyConsumed.selector,
            "wrong duplicate-authorization failure"
        );
        require(entryPoint.balanceOf(address(paymaster)) == afterFirst, "replay charged sponsor twice");
        require(entryPoint.reservedOf(address(paymaster)) == 0, "replay left stale reservation");
        require(entryPoint.getNonce(address(account), 0) == 1, "replay consumed nonce");
    }

    function testRevertedExecutionStillReleasesReservationAndCannotBeRetriedWithSameAuthorization() public {
        account.setShouldRevert(true);
        bytes32 authorizationId = keccak256("420/GAS/GAS11.2/REVERT-CLEANUP");
        PackedUserOperation420 memory op = _sponsoredOp(0, authorizationId);

        (bool success,) = entryPoint.handleOp(op);
        require(!success, "hostile account revert reported success");
        require(entryPoint.reservedOf(address(paymaster)) == 0, "reverted execution left stale reservation");
        require(entryPoint.authorizationConsumed(address(paymaster), authorizationId), "reverted authorization reusable");
        require(entryPoint.getNonce(address(account), 0) == 1, "reverted execution did not consume nonce");

        account.setShouldRevert(false);
        PackedUserOperation420 memory retry = _sponsoredOp(1, authorizationId);
        (bool ok, bytes memory reason) = address(entryPoint).call(
            abi.encodeWithSelector(EntryPoint420.handleOp.selector, retry)
        );
        require(!ok, "reverted authorization replay accepted");
        require(
            _selector(reason) == EntryPoint420.SponsorshipAuthorizationAlreadyConsumed.selector,
            "wrong reverted-replay failure"
        );
        require(account.executions() == 0, "retry executed account");
    }

    function testSettlementChargeNeverExceedsReservationUnderHostileCallbacks() public {
        bytes32 authorizationId = keccak256("420/GAS/GAS11.2/COST-CAP");
        PackedUserOperation420 memory op = _sponsoredOp(0, authorizationId);
        uint256 reserve = _maximumCost(op);
        uint256 beforeDeposit = entryPoint.balanceOf(address(paymaster));

        entryPoint.handleOp(op);

        uint256 charged = beforeDeposit - entryPoint.balanceOf(address(paymaster));
        require(charged > 0, "nothing charged");
        require(charged <= reserve, "settlement exceeded reservation cap");
        require(paymaster.lastActualGasCostWei() == charged, "postOp observed different settlement charge");
        require(entryPoint.availableOf(address(paymaster)) == entryPoint.balanceOf(address(paymaster)), "released funds unavailable");
    }

    function testWithdrawalAfterSettlementCanOnlyUseRemainingAvailableBalance() public {
        bytes32 authorizationId = keccak256("420/GAS/GAS11.2/WITHDRAW-AFTER");
        PackedUserOperation420 memory op = _sponsoredOp(0, authorizationId);
        entryPoint.handleOp(op);

        uint256 availableBefore = entryPoint.availableOf(address(paymaster));
        uint256 recipientBefore = address(this).balance;
        paymaster.withdrawTo(payable(address(this)), availableBefore);

        require(entryPoint.balanceOf(address(paymaster)) == 0, "remaining deposit not withdrawn");
        require(entryPoint.availableOf(address(paymaster)) == 0, "available balance not cleared");
        require(address(this).balance == recipientBefore + availableBefore, "recipient did not receive remaining funds");
    }

    function _sponsoredOp(uint256 nonceValue, bytes32 authorizationId)
        internal
        view
        returns (PackedUserOperation420 memory op)
    {
        uint256 verificationGasLimit = 100_000;
        uint256 callGasLimit = 100_000;
        op = PackedUserOperation420({
            sender: address(account),
            nonce: nonceValue,
            initCode: bytes(""),
            callData: abi.encodeWithSelector(Gas11HostileAccount420.execute.selector),
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
            policyId: keccak256("420/GAS/GAS11.2/POLICY"),
            validAfter: 100,
            validUntil: 1000,
            maxSponsoredCostWei: 1 ether,
            authorizationId: authorizationId,
            sponsorData: hex"1120"
        });
        op.paymasterAndData = PaymasterData420.encodeV1(data);
    }

    function _maximumCost(PackedUserOperation420 memory op) internal pure returns (uint256) {
        uint256 packedLimits = uint256(op.accountGasLimits);
        uint256 verificationGasLimit = packedLimits >> 128;
        uint256 callGasLimit = uint128(packedLimits);
        uint256 maxFeePerGas = uint128(uint256(op.gasFees));
        return (verificationGasLimit + callGasLimit + op.preVerificationGas) * maxFeePerGas;
    }

    function _selector(bytes memory reason) private pure returns (bytes4 selector) {
        if (reason.length < 4) return bytes4(0);
        assembly {
            selector := mload(add(reason, 32))
        }
    }
}

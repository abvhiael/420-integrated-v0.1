// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/accounts/EntryPoint420.sol";
import "../src/accounts/IPaymaster420.sol";
import "../src/accounts/PaymasterData420.sol";

interface VmGas2 {
    function chainId(uint256 newChainId) external;
    function warp(uint256 newTimestamp) external;
    function deal(address who, uint256 newBalance) external;
}

contract Gas2Account420 is IAccountValidation420 {
    uint256 public validationData;
    uint256 public executions;

    function setValidationData(uint256 value) external { validationData = value; }

    function validateUserOp(PackedUserOperation420 calldata, bytes32, uint256)
        external
        view
        returns (uint256)
    {
        return validationData;
    }

    function execute() external { executions += 1; }
}

contract Gas2Paymaster420 is IPaymaster420 {
    uint256 public validationData;
    uint256 public calls;
    bytes32 public lastHash;
    uint256 public lastMaxCostWei;

    function setValidationData(uint256 value) external { validationData = value; }

    function validatePaymasterUserOp(PackedUserOperation420 calldata, bytes32 userOpHash, uint256 maxCostWei)
        external
        returns (bytes memory context, uint256 data)
    {
        calls += 1;
        lastHash = userOpHash;
        lastMaxCostWei = maxCostWei;
        return (hex"0420", validationData);
    }

    function postOp(PostOpMode420, bytes calldata, uint256) external pure {
        revert("GAS-4 only");
    }
}

contract EntryPointPaymaster420Test {
    VmGas2 internal constant vm = VmGas2(address(uint160(uint256(keccak256("hevm cheat code")))));

    EntryPoint420 internal entryPoint;
    Gas2Account420 internal account;
    Gas2Paymaster420 internal paymaster;

    function setUp() public {
        vm.chainId(420);
        vm.warp(500);
        vm.deal(address(this), 100 ether);
        entryPoint = new EntryPoint420();
        account = new Gas2Account420();
        paymaster = new Gas2Paymaster420();
        entryPoint.depositTo{value: 50 ether}(address(paymaster));
    }

    function testValidSponsoredOperationRequiresAccountAndPaymasterValidation() public {
        PackedUserOperation420 memory op = _sponsoredOp(0, 10 ether);
        bytes32 expectedHash = entryPoint.getUserOpHash(op);

        (bool success,) = entryPoint.handleOp(op);
        require(success, "account execution failed");
        require(account.executions() == 1, "account not executed");
        require(paymaster.calls() == 1, "paymaster not validated");
        require(paymaster.lastHash() == expectedHash, "paymaster hash mismatch");
        require(paymaster.lastMaxCostWei() == 221_000 * 1 gwei, "max cost mismatch");
        require(entryPoint.getNonce(address(account), 0) == 1, "nonce not consumed");
    }

    function testAccountValidationFailureCannotBeBypassedByPaymaster() public {
        account.setValidationData(1);
        PackedUserOperation420 memory op = _sponsoredOp(0, 10 ether);

        (bool ok, bytes memory reason) = address(entryPoint).call(
            abi.encodeWithSelector(EntryPoint420.handleOp.selector, op)
        );
        require(!ok, "invalid account accepted");
        require(_selector(reason) == EntryPoint420.ValidationFailed.selector, "wrong failure authority");
        require(paymaster.calls() == 0, "paymaster ran before account authority gate");
        require(account.executions() == 0, "invalid account executed");
    }

    function testPaymasterValidationFailureBlocksOtherwiseValidAccount() public {
        paymaster.setValidationData(1);
        PackedUserOperation420 memory op = _sponsoredOp(0, 10 ether);

        (bool ok, bytes memory reason) = address(entryPoint).call(
            abi.encodeWithSelector(EntryPoint420.handleOp.selector, op)
        );
        require(!ok, "invalid sponsorship accepted");
        require(_selector(reason) == EntryPoint420.PaymasterValidationFailed.selector, "wrong paymaster failure");
        require(account.executions() == 0, "execution occurred after paymaster rejection");
        require(entryPoint.getNonce(address(account), 0) == 0, "nonce consumed on failed sponsorship");
    }

    function testWrongEntryPointBindingFailsClosedBeforePaymasterCall() public {
        PackedUserOperation420 memory op = _opWithPayload(0, address(0xBEEF), 10 ether);

        (bool ok, bytes memory reason) = address(entryPoint).call(
            abi.encodeWithSelector(EntryPoint420.handleOp.selector, op)
        );
        require(!ok, "wrong entrypoint binding accepted");
        require(_selector(reason) == EntryPoint420.InvalidPaymasterBinding.selector, "wrong binding failure");
        require(paymaster.calls() == 0, "paymaster called with wrong binding");
    }

    function testDeclaredSponsorshipCostCeilingIsEnforced() public {
        PackedUserOperation420 memory op = _sponsoredOp(0, 1 wei);

        (bool ok, bytes memory reason) = address(entryPoint).call(
            abi.encodeWithSelector(EntryPoint420.handleOp.selector, op)
        );
        require(!ok, "cost ceiling bypassed");
        require(_selector(reason) == EntryPoint420.SponsorshipCostExceeded.selector, "wrong cost failure");
        require(paymaster.calls() == 0, "paymaster called beyond authorized cost");
    }

    function testSelfFundedOperationRemainsAvailableWithoutPaymaster() public {
        PackedUserOperation420 memory op = _baseOp(0);
        (bool success,) = entryPoint.handleOp(op);
        require(success, "self-funded operation failed");
        require(account.executions() == 1, "self-funded account not executed");
        require(paymaster.calls() == 0, "paymaster unexpectedly involved");
    }

    function testPaymasterPayloadValidityWindowIsEnforced() public {
        PackedUserOperation420 memory op = _sponsoredOpWithWindow(0, 501, 1000, 10 ether);
        (bool early, bytes memory earlyReason) = address(entryPoint).call(
            abi.encodeWithSelector(EntryPoint420.handleOp.selector, op)
        );
        require(!early, "not-yet-valid sponsorship accepted");
        require(_selector(earlyReason) == EntryPoint420.ValidationNotYetValid.selector, "wrong early failure");

        op = _sponsoredOpWithWindow(0, 100, 499, 10 ether);
        (bool late, bytes memory lateReason) = address(entryPoint).call(
            abi.encodeWithSelector(EntryPoint420.handleOp.selector, op)
        );
        require(!late, "expired sponsorship accepted");
        require(_selector(lateReason) == EntryPoint420.ValidationExpired.selector, "wrong expiry failure");
    }

    function _sponsoredOp(uint256 nonceValue, uint128 maxSponsoredCostWei)
        internal
        view
        returns (PackedUserOperation420 memory)
    {
        return _sponsoredOpWithWindow(nonceValue, 100, 1000, maxSponsoredCostWei);
    }

    function _sponsoredOpWithWindow(uint256 nonceValue, uint48 validAfter, uint48 validUntil, uint128 maxSponsoredCostWei)
        internal
        view
        returns (PackedUserOperation420 memory op)
    {
        op = _baseOp(nonceValue);
        PaymasterData420.V1 memory data = PaymasterData420.V1({
            version: 1,
            paymaster: address(paymaster),
            entryPoint: address(entryPoint),
            chainId: 420,
            policyId: keccak256("420/GAS/GAS2/POLICY"),
            validAfter: validAfter,
            validUntil: validUntil,
            maxSponsoredCostWei: maxSponsoredCostWei,
            authorizationId: keccak256(abi.encode("420/GAS/GAS2/AUTH", nonceValue)),
            sponsorData: hex"0420"
        });
        op.paymasterAndData = PaymasterData420.encodeV1(data);
    }

    function _opWithPayload(uint256 nonceValue, address payloadEntryPoint, uint128 maxSponsoredCostWei)
        internal
        view
        returns (PackedUserOperation420 memory op)
    {
        op = _baseOp(nonceValue);
        PaymasterData420.V1 memory data = PaymasterData420.V1({
            version: 1,
            paymaster: address(paymaster),
            entryPoint: payloadEntryPoint,
            chainId: 420,
            policyId: keccak256("420/GAS/GAS2/POLICY"),
            validAfter: 100,
            validUntil: 1000,
            maxSponsoredCostWei: maxSponsoredCostWei,
            authorizationId: keccak256(abi.encode("420/GAS/GAS2/AUTH", nonceValue)),
            sponsorData: hex"0420"
        });
        op.paymasterAndData = PaymasterData420.encodeV1(data);
    }

    function _baseOp(uint256 nonceValue) internal view returns (PackedUserOperation420 memory) {
        uint256 verificationGasLimit = 100_000;
        uint256 callGasLimit = 100_000;
        bytes32 accountGasLimits = bytes32((verificationGasLimit << 128) | callGasLimit);
        bytes32 gasFees = bytes32(uint256(1 gwei));

        return PackedUserOperation420({
            sender: address(account),
            nonce: nonceValue,
            initCode: bytes(""),
            callData: abi.encodeWithSelector(Gas2Account420.execute.selector),
            accountGasLimits: accountGasLimits,
            preVerificationGas: 21_000,
            gasFees: gasFees,
            paymasterAndData: bytes(""),
            signature: bytes("")
        });
    }

    function _selector(bytes memory reason) private pure returns (bytes4 selector) {
        if (reason.length < 4) return bytes4(0);
        assembly { selector := mload(add(reason, 32)) }
    }
}

// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./IEntryPoint420.sol";

interface IAccountValidation420 {
    function validateUserOp(PackedUserOperation420 calldata userOp, bytes32 userOpHash, uint256 missingAccountFunds)
        external
        returns (uint256 validationData);
}

/// @notice Canonical 420 Integrated Smart Account EntryPoint.
/// @dev V1 intentionally supports deployed accounts only and no external paymaster/initCode path.
///      Validation is performed before nonce consumption. Once validation succeeds, the keyed nonce
///      is consumed even if account execution later fails, preventing replay while preserving atomic
///      rollback of account-internal state changes caused by a reverted execution call.
contract EntryPoint420 is IEntryPoint420 {
    bytes32 public constant USER_OPERATION_DOMAIN = keccak256("420/ENTRY_POINT/USER_OPERATION/V1");

    mapping(address => mapping(uint192 => uint64)) private _sequence;
    bool private _entered;

    event UserOperationHandled(
        bytes32 indexed userOpHash,
        address indexed sender,
        uint192 indexed nonceKey,
        uint64 nonceSequence,
        bool success
    );

    error ReentrantEntryPoint();
    error InvalidSender();
    error UnsupportedInitCode();
    error UnsupportedPaymaster();
    error InvalidNonce();
    error ValidationFailed();
    error ValidationNotYetValid(uint48 validAfter);
    error ValidationExpired(uint48 validUntil);

    modifier nonReentrant() {
        if (_entered) revert ReentrantEntryPoint();
        _entered = true;
        _;
        _entered = false;
    }

    receive() external payable {}

    function getNonce(address sender, uint192 key) public view returns (uint256) {
        return (uint256(key) << 64) | uint256(_sequence[sender][key]);
    }

    function getUserOpHash(PackedUserOperation420 calldata userOp) public view returns (bytes32) {
        return keccak256(
            abi.encode(
                USER_OPERATION_DOMAIN,
                block.chainid,
                address(this),
                userOp.sender,
                userOp.nonce,
                keccak256(userOp.initCode),
                keccak256(userOp.callData),
                userOp.accountGasLimits,
                userOp.preVerificationGas,
                userOp.gasFees,
                keccak256(userOp.paymasterAndData)
            )
        );
    }

    function handleOp(PackedUserOperation420 calldata userOp)
        external
        nonReentrant
        returns (bool success, bytes memory returnData)
    {
        if (userOp.sender == address(0) || userOp.sender.code.length == 0) revert InvalidSender();
        if (userOp.initCode.length != 0) revert UnsupportedInitCode();
        if (userOp.paymasterAndData.length != 0) revert UnsupportedPaymaster();

        uint192 key = uint192(userOp.nonce >> 64);
        uint64 sequence = uint64(userOp.nonce);
        if (userOp.nonce != getNonce(userOp.sender, key)) revert InvalidNonce();

        bytes32 userOpHash = getUserOpHash(userOp);
        uint256 validationData = IAccountValidation420(userOp.sender).validateUserOp(userOp, userOpHash, 0);
        _enforceValidationData(validationData);

        unchecked { _sequence[userOp.sender][key] = sequence + 1; }

        (success, returnData) = userOp.sender.call(userOp.callData);
        emit UserOperationHandled(userOpHash, userOp.sender, key, sequence, success);
    }

    function _enforceValidationData(uint256 validationData) private view {
        if (validationData == 1) revert ValidationFailed();
        // Low 160 bits are reserved for an aggregator address in ERC-4337-style validation data.
        if (address(uint160(validationData)) != address(0)) revert ValidationFailed();

        uint48 validUntil = uint48(validationData >> 160);
        uint48 validAfter = uint48(validationData >> 208);
        uint48 nowTs = uint48(block.timestamp);

        if (nowTs < validAfter) revert ValidationNotYetValid(validAfter);
        if (validUntil != 0 && nowTs > validUntil) revert ValidationExpired(validUntil);
    }
}

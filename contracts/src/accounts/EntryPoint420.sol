// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./IEntryPoint420.sol";
import "./IPaymaster420.sol";
import "./PaymasterData420.sol";

interface IAccountValidation420 {
    function validateUserOp(PackedUserOperation420 calldata userOp, bytes32 userOpHash, uint256 missingAccountFunds)
        external
        returns (uint256 validationData);
}

/// @notice Canonical 420 Integrated Smart Account EntryPoint.
/// @dev GAS-2 enables bounded paymaster validation for already-authorized deployed-account operations.
///      Account validation remains an independent authority gate and always runs before paymaster validation.
///      GAS-2 does not implement sponsor deposits/reservations or post-operation settlement; those are GAS-3/GAS-4.
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
    event PaymasterValidated(
        bytes32 indexed userOpHash,
        address indexed paymaster,
        bytes32 indexed policyId,
        bytes32 authorizationId,
        uint256 maxCostWei
    );

    error ReentrantEntryPoint();
    error InvalidSender();
    error UnsupportedInitCode();
    error InvalidNonce();
    error ValidationFailed();
    error ValidationNotYetValid(uint48 validAfter);
    error ValidationExpired(uint48 validUntil);
    error InvalidPaymasterBinding();
    error InvalidPaymasterContract();
    error SponsorshipCostExceeded(uint256 maxCostWei, uint256 authorizedCostWei);
    error PaymasterValidationFailed();

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

        uint192 key = uint192(userOp.nonce >> 64);
        uint64 sequence = uint64(userOp.nonce);
        if (userOp.nonce != getNonce(userOp.sender, key)) revert InvalidNonce();

        bytes32 userOpHash = getUserOpHash(userOp);

        // Account authorization is always evaluated first and cannot be replaced by sponsorship.
        uint256 accountValidationData = IAccountValidation420(userOp.sender).validateUserOp(userOp, userOpHash, 0);
        _enforceValidationData(accountValidationData);

        if (userOp.paymasterAndData.length != 0) {
            _validatePaymaster(userOp, userOpHash);
        }

        unchecked { _sequence[userOp.sender][key] = sequence + 1; }

        (success, returnData) = userOp.sender.call(userOp.callData);
        emit UserOperationHandled(userOpHash, userOp.sender, key, sequence, success);
    }

    function _validatePaymaster(PackedUserOperation420 calldata userOp, bytes32 userOpHash) private {
        PaymasterData420.V1 memory sponsorship = PaymasterData420.decodeV1(userOp.paymasterAndData);

        if (sponsorship.entryPoint != address(this) || sponsorship.chainId != block.chainid) {
            revert InvalidPaymasterBinding();
        }
        if (sponsorship.paymaster.code.length == 0) revert InvalidPaymasterContract();

        uint48 nowTs = uint48(block.timestamp);
        if (nowTs < sponsorship.validAfter) revert ValidationNotYetValid(sponsorship.validAfter);
        if (nowTs > sponsorship.validUntil) revert ValidationExpired(sponsorship.validUntil);

        uint256 maxCostWei = _maximumUserOpCostWei(userOp);
        if (maxCostWei > sponsorship.maxSponsoredCostWei) {
            revert SponsorshipCostExceeded(maxCostWei, sponsorship.maxSponsoredCostWei);
        }

        (, uint256 paymasterValidationData) =
            IPaymaster420(sponsorship.paymaster).validatePaymasterUserOp(userOp, userOpHash, maxCostWei);
        _enforcePaymasterValidationData(paymasterValidationData);

        emit PaymasterValidated(
            userOpHash,
            sponsorship.paymaster,
            sponsorship.policyId,
            sponsorship.authorizationId,
            maxCostWei
        );
    }

    function _maximumUserOpCostWei(PackedUserOperation420 calldata userOp) private pure returns (uint256) {
        uint256 packedLimits = uint256(userOp.accountGasLimits);
        uint256 verificationGasLimit = packedLimits >> 128;
        uint256 callGasLimit = uint128(packedLimits);
        uint256 maxFeePerGas = uint128(uint256(userOp.gasFees));
        uint256 totalGas = verificationGasLimit + callGasLimit + userOp.preVerificationGas;
        return totalGas * maxFeePerGas;
    }

    function _enforcePaymasterValidationData(uint256 validationData) private view {
        if (validationData == 1) revert PaymasterValidationFailed();
        if (address(uint160(validationData)) != address(0)) revert PaymasterValidationFailed();

        uint48 validUntil = uint48(validationData >> 160);
        uint48 validAfter = uint48(validationData >> 208);
        uint48 nowTs = uint48(block.timestamp);
        if (nowTs < validAfter) revert ValidationNotYetValid(validAfter);
        if (validUntil != 0 && nowTs > validUntil) revert ValidationExpired(validUntil);
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

// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./IEntryPoint420.sol";
import "./PaymasterData420.sol";

/// @notice Canonical non-circular digest for 420Gas sponsorship authorization.
/// @dev The base operation hash deliberately excludes paymasterAndData and signature so sponsor proof
///      bytes can be produced without hashing themselves. The final Wallet/Smart Account signature
///      still binds the complete EntryPoint420 user-op hash including the finished paymasterAndData.
library SponsorshipDigest420 {
    bytes32 internal constant BASE_OPERATION_DOMAIN = keccak256("420/GAS/BASE_USER_OPERATION/V1");
    bytes32 internal constant SPONSORSHIP_DOMAIN = keccak256("420/GAS/SPONSORSHIP_DIGEST/V1");

    function baseUserOpHash(PackedUserOperation420 calldata userOp, address entryPoint, uint256 chainId)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(
            abi.encode(
                BASE_OPERATION_DOMAIN,
                chainId,
                entryPoint,
                userOp.sender,
                userOp.nonce,
                keccak256(userOp.initCode),
                keccak256(userOp.callData),
                userOp.accountGasLimits,
                userOp.preVerificationGas,
                userOp.gasFees
            )
        );
    }

    function digestV1(PackedUserOperation420 calldata userOp, PaymasterData420.V1 memory sponsorship)
        internal
        pure
        returns (bytes32)
    {
        bytes32 baseHash = baseUserOpHash(userOp, sponsorship.entryPoint, sponsorship.chainId);
        return keccak256(
            abi.encode(
                SPONSORSHIP_DOMAIN,
                baseHash,
                sponsorship.paymaster,
                sponsorship.policyId,
                sponsorship.validAfter,
                sponsorship.validUntil,
                sponsorship.maxSponsoredCostWei,
                sponsorship.authorizationId
            )
        );
    }
}

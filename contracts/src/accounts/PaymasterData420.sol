// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Canonical versioned paymasterAndData codec for 420Gas.
/// @dev GAS-1 defines encoding and validation only. EntryPoint420 continues to reject paymasters
///      until GAS-2 explicitly enables sponsorship validation.
library PaymasterData420 {
    uint8 internal constant VERSION_V1 = 1;
    uint256 internal constant CHAIN_ID_420 = 420;
    uint256 internal constant MAX_SPONSOR_DATA_BYTES = 4096;

    struct V1 {
        uint8 version;
        address paymaster;
        address entryPoint;
        uint256 chainId;
        bytes32 policyId;
        uint48 validAfter;
        uint48 validUntil;
        uint128 maxSponsoredCostWei;
        bytes32 authorizationId;
        bytes sponsorData;
    }

    error InvalidPaymasterDataVersion(uint8 version);
    error InvalidPaymasterAddress();
    error InvalidEntryPointAddress();
    error InvalidChainId(uint256 chainId);
    error InvalidPolicyId();
    error InvalidValidityWindow(uint48 validAfter, uint48 validUntil);
    error InvalidMaxSponsoredCost();
    error InvalidAuthorizationId();
    error SponsorDataTooLarge(uint256 length);
    error NonCanonicalPaymasterData();

    function encodeV1(V1 memory data) internal pure returns (bytes memory encoded) {
        _validateV1(data);
        encoded = abi.encode(
            data.version,
            data.paymaster,
            data.entryPoint,
            data.chainId,
            data.policyId,
            data.validAfter,
            data.validUntil,
            data.maxSponsoredCostWei,
            data.authorizationId,
            data.sponsorData
        );
    }

    function decodeV1(bytes calldata raw) internal pure returns (V1 memory data) {
        (
            data.version,
            data.paymaster,
            data.entryPoint,
            data.chainId,
            data.policyId,
            data.validAfter,
            data.validUntil,
            data.maxSponsoredCostWei,
            data.authorizationId,
            data.sponsorData
        ) = abi.decode(raw, (uint8, address, address, uint256, bytes32, uint48, uint48, uint128, bytes32, bytes));

        _validateV1(data);

        bytes memory canonical = abi.encode(
            data.version,
            data.paymaster,
            data.entryPoint,
            data.chainId,
            data.policyId,
            data.validAfter,
            data.validUntil,
            data.maxSponsoredCostWei,
            data.authorizationId,
            data.sponsorData
        );
        if (canonical.length != raw.length || keccak256(canonical) != keccak256(raw)) {
            revert NonCanonicalPaymasterData();
        }
    }

    function _validateV1(V1 memory data) private pure {
        if (data.version != VERSION_V1) revert InvalidPaymasterDataVersion(data.version);
        if (data.paymaster == address(0)) revert InvalidPaymasterAddress();
        if (data.entryPoint == address(0)) revert InvalidEntryPointAddress();
        if (data.chainId != CHAIN_ID_420) revert InvalidChainId(data.chainId);
        if (data.policyId == bytes32(0)) revert InvalidPolicyId();
        if (data.validUntil == 0 || data.validUntil <= data.validAfter) {
            revert InvalidValidityWindow(data.validAfter, data.validUntil);
        }
        if (data.maxSponsoredCostWei == 0) revert InvalidMaxSponsoredCost();
        if (data.authorizationId == bytes32(0)) revert InvalidAuthorizationId();
        if (data.sponsorData.length > MAX_SPONSOR_DATA_BYTES) revert SponsorDataTooLarge(data.sponsorData.length);
    }
}

// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/SystemAccess.sol";
import "../interfaces/I420System.sol";

/// @notice Governance-curated registry of oracle providers and their submission operators.
/// @dev Registration grants only oracle-reporting authority. It grants no custody, governance,
/// bridge, validator, settlement, or arbitrary execution authority.
contract OracleProviderRegistry420 is SystemAccess, I420System {
    struct Provider {
        address operator;
        bytes32 metadataHash;
        bytes32 stakeRef;
        uint64 activatedAt;
        uint64 deactivatedAt;
        uint32 epoch;
        bool active;
    }

    mapping(bytes32 => Provider) public providers;
    mapping(address => bytes32) public providerOfOperator;

    error InvalidProviderId();
    error InvalidOperator();
    error OperatorAlreadyBound();

    event ProviderSet(
        bytes32 indexed providerId,
        address indexed operator,
        bytes32 metadataHash,
        bytes32 stakeRef,
        uint32 epoch,
        bool active
    );

    constructor(address timelock_) SystemAccess(timelock_) {}

    function systemName() external pure returns (string memory) { return "OracleProviderRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function setProvider(
        bytes32 providerId,
        address operator,
        bytes32 metadataHash,
        bytes32 stakeRef,
        bool active
    ) external onlyGovernance {
        if (providerId == bytes32(0)) revert InvalidProviderId();
        if (operator == address(0)) revert InvalidOperator();

        Provider memory previous = providers[providerId];
        bytes32 occupied = providerOfOperator[operator];
        if (occupied != bytes32(0) && occupied != providerId) revert OperatorAlreadyBound();

        bool operatorChanged = previous.operator != address(0) && previous.operator != operator;
        if (operatorChanged) delete providerOfOperator[previous.operator];

        uint64 activatedAt = previous.activatedAt;
        uint64 deactivatedAt = previous.deactivatedAt;
        uint32 epoch = previous.epoch;

        if (active && (!previous.active || operatorChanged || epoch == 0)) {
            activatedAt = uint64(block.timestamp);
            deactivatedAt = 0;
            ++epoch;
        } else if (!active && previous.active) {
            deactivatedAt = uint64(block.timestamp);
        } else if (operatorChanged) {
            ++epoch;
        }

        providers[providerId] = Provider({
            operator: operator,
            metadataHash: metadataHash,
            stakeRef: stakeRef,
            activatedAt: activatedAt,
            deactivatedAt: deactivatedAt,
            epoch: epoch,
            active: active
        });
        providerOfOperator[operator] = providerId;

        emit ProviderSet(providerId, operator, metadataHash, stakeRef, epoch, active);
    }

    function providerActive(bytes32 providerId) external view returns (bool) {
        return providers[providerId].active;
    }

    function providerEpoch(bytes32 providerId) external view returns (uint32) {
        return providers[providerId].epoch;
    }

    function isAuthorizedOperator(bytes32 providerId, address operator) external view returns (bool) {
        Provider memory provider = providers[providerId];
        return provider.active && provider.operator == operator;
    }
}

// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Immutable identity and interface declaration of a deployable High Country module.
interface IHighCountryModuleIdentity {
    function highCountryModuleIdentity() external view returns (
        bytes32 moduleId, uint32 version, bytes32 rulesetId, bytes32 interfaceId
    );
}

// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import { IEmergencyState } from "../interfaces/IEmergencyState.sol";
import { IHighCountryAuthorization } from "../interfaces/IHighCountryAuthorization.sol";
import { AuthorizationRequest } from "../types/HighCountryTypes.sol";
import { ActionIds } from "../constants/ActionIds.sol";
import { ModuleIds } from "../constants/ModuleIds.sol";

/// @notice Mandatory one-time deployment binding; restriction/release remain in canonical EmergencyState.
abstract contract R04EmergencyConsumer {
    error EmergencyBindingInvalid();
    error R04Restricted(bytes32 domain);
    address public immutable emergencyBinder = msg.sender;
    IEmergencyState public r04EmergencyState;
    address public immutable r04AuthorizationRoot;

    constructor(
        address root
    ) {
        if (root.code.length == 0) revert EmergencyBindingInvalid();
        r04AuthorizationRoot = root;
    }
    bytes32 public constant R04_BIND_ACTION = ActionIds.R04_EMERGENCY_BIND;
    event R04EmergencyBound(address indexed state, address indexed authorizationRoot);

    function emergencyBindingScope(
        address candidate
    ) public view returns (bytes32) {
        return keccak256(abi.encode("HC.R04.EMERGENCY_BIND.V1", block.chainid, address(this), candidate));
    }

    function bindR04Emergency(
        address candidate
    ) external {
        if (msg.sender != emergencyBinder || address(r04EmergencyState) != address(0) || candidate.code.length == 0) {
            revert EmergencyBindingInvalid();
        }
        address root = IEmergencyState(candidate).authorizationRoot();
        if (root != r04AuthorizationRoot) revert EmergencyBindingInvalid();
        IHighCountryAuthorization(root)
            .requireAuthorized(
                AuthorizationRequest(
                    msg.sender, ModuleIds.EMERGENCY_STATE, R04_BIND_ACTION, emergencyBindingScope(candidate), 0
                )
            );
        r04EmergencyState = IEmergencyState(candidate);
        emit R04EmergencyBound(candidate, root);
    }
    modifier r04Unrestricted(
        bytes32 domain
    ) {
        if (
            address(r04EmergencyState) == address(0) || !r04EmergencyState.isAllowedDomain(domain)
                || r04EmergencyState.isRestricted(domain)
        ) revert R04Restricted(domain);
        _;
    }

    function r04DomainOpen(
        bytes32 domain
    ) public view returns (bool) {
        return address(r04EmergencyState) != address(0) && r04EmergencyState.isAllowedDomain(domain)
            && !r04EmergencyState.isRestricted(domain);
    }
}

// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { AuthorizationRequest } from "../types/HighCountryTypes.sol";

interface IHighCountryAuthorization {
    function capabilityRegistry() external view returns (address);
    function isAuthorized(AuthorizationRequest calldata request) external view returns (bool);
    function requireAuthorized(AuthorizationRequest calldata request) external view;
}

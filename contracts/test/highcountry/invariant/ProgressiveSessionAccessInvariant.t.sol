// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { HighCountrySessionAccess420 } from "../../../src/highcountry/player/HighCountrySessionAccess420.sol";
import { IHighCountryAuthorization } from "../../../src/highcountry/interfaces/IHighCountryAuthorization.sol";
import { AuthorizationRequest } from "../../../src/highcountry/types/HighCountryTypes.sol";
import { InvariantTarget420 } from "../../helpers/InvariantTarget420.sol";

contract MockHCAuthorizationPA4 is IHighCountryAuthorization {
    function capabilityRegistry() external pure returns (address) { return address(1); }
    function isAuthorized(AuthorizationRequest calldata) external pure returns (bool) { return true; }
    function requireAuthorized(AuthorizationRequest calldata) external pure {}
}

contract RoutineTargetPA4 {
    function routine(uint256) external {}
    function sensitive(uint256) external {}
}

/// @notice Fuzz unrelated policy entries without rewriting the explicitly configured
/// routine/unknown selector pair that the invariants hold fixed.
contract ProgressiveSessionAccessHandlerPA4 {
    HighCountrySessionAccess420 private immutable sessionAccess;
    address private constant UNRELATED_TARGET = address(0xBEEF);

    constructor(HighCountrySessionAccess420 sessionAccess_) { sessionAccess = sessionAccess_; }

    function stepSetUnrelatedRoutine(bytes4 selector, bool allowed) external {
        if (selector == bytes4(0)) return;
        sessionAccess.setRoutineCall(UNRELATED_TARGET, selector, allowed);
    }
}

contract ProgressiveSessionAccessInvariantTest is InvariantTarget420 {
    HighCountrySessionAccess420 private sessionAccess;
    RoutineTargetPA4 private target;

    function setUp() public {
        sessionAccess = new HighCountrySessionAccess420(address(new MockHCAuthorizationPA4()));
        target = new RoutineTargetPA4();
        sessionAccess.setRoutineCall(address(target), target.routine.selector, true);
        targetContract(address(new ProgressiveSessionAccessHandlerPA4(sessionAccess)));
    }

    function invariant_HC_INV_ACCESS_024_SessionScopeCannotSpendNative420() public view {
        require(sessionAccess.native420SpendLimit() == 0, "HC-INV-ACCESS-024: native spend enabled");
        require(
            sessionAccess.requiresWalletEscalation(address(target), target.routine.selector, 1),
            "HC-INV-ACCESS-024: native spend did not escalate"
        );
    }

    function invariant_HC_INV_ACCESS_024_UnknownCallsFailClosed() public view {
        require(
            sessionAccess.requiresWalletEscalation(address(target), target.sensitive.selector, 0),
            "HC-INV-ACCESS-024: unknown selector became routine"
        );
    }

    function invariant_HC_INV_ACCESS_025_OnlyExplicitRoutineCallsAvoidWalletEscalation() public view {
        require(
            !sessionAccess.requiresWalletEscalation(address(target), target.routine.selector, 0),
            "HC-INV-ACCESS-025: explicit routine call escalated"
        );
        require(
            sessionAccess.requiresWalletEscalation(address(target), target.sensitive.selector, 0),
            "HC-INV-ACCESS-025: sensitive call silently downgraded"
        );
    }
}

// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { IHighCountryGamingAccess420 } from "../../../../src/highcountry/player/IHighCountryGamingAccess420.sol";

contract IHighCountryGamingAccess420CompileTest {
    function testInterfaceSelectorSurface() public pure {
        require(IHighCountryGamingAccess420.hasScopedEntitlement.selector != bytes4(0), "missing scoped selector");
        require(IHighCountryGamingAccess420.requireScopedEntitlement.selector != bytes4(0), "missing require selector");
        require(IHighCountryGamingAccess420.hasBonusRegion.selector != bytes4(0), "missing bonus region selector");
        require(IHighCountryGamingAccess420.hasCompetitionAccess.selector != bytes4(0), "missing competition selector");
    }
}

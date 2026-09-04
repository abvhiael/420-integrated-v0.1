// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ModuleIds } from "../../src/highcountry/constants/ModuleIds.sol";
import { ActionIds } from "../../src/highcountry/constants/ActionIds.sol";
import { RandomDomains } from "../../src/highcountry/constants/RandomDomains.sol";

contract BaseHighCountryTest {
    function testFoundationIdsAreDomainSeparated() public pure {
        require(ModuleIds.GENESIS_REGISTRY != ModuleIds.RULESET_REGISTRY, "module collision");
        require(ActionIds.GENESIS_FINALIZE != ActionIds.RULESET_REGISTER, "action collision");
        require(RandomDomains.BREEDING != RandomDomains.COMPETITION, "random domain collision");
    }
}

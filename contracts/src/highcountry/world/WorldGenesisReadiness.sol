// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { HCZeroAddress } from "../errors/HighCountryErrors.sol";
import { IGenesisRegistry } from "../interfaces/IGenesisRegistry.sol";

interface IFoundingRegionReadinessHC2 {
    function foundingRegionsReady() external view returns (bool);
}

contract WorldGenesisReadiness {
    IGenesisRegistry public immutable genesisRegistry;
    IFoundingRegionReadinessHC2 public immutable regionRegistry;

    constructor(address genesisRegistry_, address regionRegistry_) {
        if (genesisRegistry_ == address(0) || regionRegistry_ == address(0)) revert HCZeroAddress();
        genesisRegistry = IGenesisRegistry(genesisRegistry_);
        regionRegistry = IFoundingRegionReadinessHC2(regionRegistry_);
    }

    function worldReady() external view returns (bool) {
        return genesisRegistry.finalized() && regionRegistry.foundingRegionsReady();
    }
}

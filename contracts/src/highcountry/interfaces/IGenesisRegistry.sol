// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { GenesisRoots } from "../types/HighCountryTypes.sol";

interface IGenesisRegistry {
    event GenesisRootsSet(
        bytes32 manifestRoot,
        bytes32 parameterRoot,
        bytes32 rulesetRoot,
        bytes32 landRoot,
        bytes32 randomnessRoot,
        bytes32 qualificationRoot
    );
    event GenesisFinalized(uint64 finalizedAt);
    event GenesisAuthorityDisabled();

    function roots() external view returns (GenesisRoots memory);
    function finalized() external view returns (bool);
    function genesisAuthorityEnabled() external view returns (bool);
    function setRoots(GenesisRoots calldata newRoots) external;
    function finalizeGenesis() external;
}

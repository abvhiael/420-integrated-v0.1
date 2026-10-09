// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { CapabilityRegistry420 } from "../../../src/system/CapabilityRegistry420.sol";
import { HighCountryAuthorization } from "../../../src/highcountry/auth/HighCountryAuthorization.sol";
import { GenesisRegistry } from "../../../src/highcountry/genesis/GenesisRegistry.sol";
import { ActionIds } from "../../../src/highcountry/constants/ActionIds.sol";
import { ModuleIds } from "../../../src/highcountry/constants/ModuleIds.sol";
import { GenesisRoots } from "../../../src/highcountry/types/HighCountryTypes.sol";

contract RealCapabilityGenesisTest {
    function testGenesisUsesIssuableRealRegistryScopeAndHonorsRevocation() public {
        CapabilityRegistry420 caps = new CapabilityRegistry420();
        HighCountryAuthorization auth = new HighCountryAuthorization(address(caps));
        GenesisRegistry genesis = new GenesisRegistry(address(auth));
        caps.registerProtocolComponent(ModuleIds.GENESIS_REGISTRY, address(this));
        bytes32 setGrant = keccak256("real:set");
        bytes32 finalizeGrant = keccak256("real:finalize");
        caps.createGrant(
            setGrant,
            address(this),
            ModuleIds.GENESIS_REGISTRY,
            ActionIds.GENESIS_SET_ROOTS,
            genesis.ADMIN_SCOPE(),
            0,
            0,
            0,
            0,
            0
        );
        caps.createGrant(
            finalizeGrant,
            address(this),
            ModuleIds.GENESIS_REGISTRY,
            ActionIds.GENESIS_FINALIZE,
            genesis.ADMIN_SCOPE(),
            0,
            0,
            0,
            0,
            0
        );
        GenesisRoots memory roots = GenesisRoots(
            keccak256("m"), keccak256("p"), keccak256("r"), keccak256("l"), keccak256("x"), keccak256("q")
        );
        genesis.setRoots(roots);
        caps.revokeGrant(finalizeGrant);
        (bool revoked,) = address(genesis).call(abi.encodeWithSelector(genesis.finalizeGenesis.selector));
        require(!revoked && !genesis.finalized(), "revoked finalization accepted");
        caps.createGrant(
            keccak256("real:replacement"),
            address(this),
            ModuleIds.GENESIS_REGISTRY,
            ActionIds.GENESIS_FINALIZE,
            genesis.ADMIN_SCOPE(),
            0,
            0,
            0,
            0,
            0
        );
        genesis.finalizeGenesis();
        require(genesis.finalized() && !genesis.genesisAuthorityEnabled(), "real genesis failed");
        (bool changed,) = address(genesis).call(abi.encodeWithSelector(genesis.setRoots.selector, roots));
        require(!changed, "finalized genesis mutated");
    }
}

// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ICapabilityRegistry420 } from "../../../../src/interfaces/genesis/ICapabilityRegistry420.sol";
import { HighCountryAuthorization } from "../../../../src/highcountry/auth/HighCountryAuthorization.sol";
import { ActionIds } from "../../../../src/highcountry/constants/ActionIds.sol";
import { ModuleIds } from "../../../../src/highcountry/constants/ModuleIds.sol";
import { GenesisRegistry } from "../../../../src/highcountry/genesis/GenesisRegistry.sol";
import { GenesisRoots } from "../../../../src/highcountry/types/HighCountryTypes.sol";
import { MockCapabilityRegistry } from "../../mocks/MockCapabilityRegistry.sol";

contract GenesisRegistryTest {
    MockCapabilityRegistry private capabilityRegistry;
    HighCountryAuthorization private authorization;
    GenesisRegistry private genesis;

    constructor() {
        capabilityRegistry = new MockCapabilityRegistry();
        authorization = new HighCountryAuthorization(address(capabilityRegistry));
        genesis = new GenesisRegistry(address(authorization));
        _grant(ActionIds.GENESIS_SET_ROOTS, keccak256("grant:set-roots"));
        _grant(ActionIds.GENESIS_FINALIZE, keccak256("grant:finalize"));
    }

    function testSetRootsBeforeFinalization() public {
        GenesisRoots memory expected = _roots(1);
        genesis.setRoots(expected);
        GenesisRoots memory actual = genesis.roots();
        require(actual.manifestRoot == expected.manifestRoot, "manifest root");
        require(actual.parameterRoot == expected.parameterRoot, "parameter root");
        require(actual.rulesetRoot == expected.rulesetRoot, "ruleset root");
        require(actual.landRoot == expected.landRoot, "land root");
        require(actual.randomnessRoot == expected.randomnessRoot, "randomness root");
        require(actual.qualificationRoot == expected.qualificationRoot, "qualification root");
    }

    function testFinalizeDisablesGenesisAuthority() public {
        genesis.setRoots(_roots(1));
        genesis.finalizeGenesis();
        require(genesis.finalized(), "not finalized");
        require(!genesis.genesisAuthorityEnabled(), "genesis authority still enabled");
    }

    function testCannotFinalizeTwice() public {
        genesis.setRoots(_roots(1));
        genesis.finalizeGenesis();
        (bool ok,) = address(genesis).call(abi.encodeWithSelector(genesis.finalizeGenesis.selector));
        require(!ok, "second finalization succeeded");
    }

    function testCannotChangeRootsAfterFinalization() public {
        GenesisRoots memory original = _roots(1);
        genesis.setRoots(original);
        genesis.finalizeGenesis();

        GenesisRoots memory replacement = _roots(2);
        (bool ok,) = address(genesis).call(abi.encodeWithSelector(genesis.setRoots.selector, replacement));
        require(!ok, "post-finalization roots changed");

        GenesisRoots memory actual = genesis.roots();
        require(actual.manifestRoot == original.manifestRoot, "manifest mutated");
        require(actual.qualificationRoot == original.qualificationRoot, "qualification mutated");
    }

    function testCannotFinalizeWithoutCompleteRoots() public {
        (bool ok,) = address(genesis).call(abi.encodeWithSelector(genesis.finalizeGenesis.selector));
        require(!ok, "finalized without roots");
        require(!genesis.finalized(), "finalized flag changed");
    }

    function _grant(bytes32 actionId, bytes32 grantId) private {
        ICapabilityRegistry420.CapabilityGrant memory grant = ICapabilityRegistry420.CapabilityGrant({
            principal: address(this),
            componentId: ModuleIds.GENESIS_REGISTRY,
            capabilityId: actionId,
            scopeHash: bytes32(0),
            perCallLimit: 0,
            periodLimit: 0,
            periodSeconds: 0,
            validFrom: 0,
            validUntil: uint64(block.timestamp + 1 days),
            revoked: false
        });
        capabilityRegistry.setGrant(grantId, grant, 0);
    }

    function _roots(uint256 salt) private pure returns (GenesisRoots memory) {
        return GenesisRoots({
            manifestRoot: keccak256(abi.encode("manifest", salt)),
            parameterRoot: keccak256(abi.encode("parameters", salt)),
            rulesetRoot: keccak256(abi.encode("rulesets", salt)),
            landRoot: keccak256(abi.encode("land", salt)),
            randomnessRoot: keccak256(abi.encode("randomness", salt)),
            qualificationRoot: keccak256(abi.encode("qualification", salt))
        });
    }
}

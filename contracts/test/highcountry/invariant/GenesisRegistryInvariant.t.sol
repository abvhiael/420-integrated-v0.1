// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ICapabilityRegistry420 } from "../../../src/interfaces/genesis/ICapabilityRegistry420.sol";
import { HighCountryAuthorization } from "../../../src/highcountry/auth/HighCountryAuthorization.sol";
import { ActionIds } from "../../../src/highcountry/constants/ActionIds.sol";
import { ModuleIds } from "../../../src/highcountry/constants/ModuleIds.sol";
import { GenesisRegistry } from "../../../src/highcountry/genesis/GenesisRegistry.sol";
import { GenesisRoots } from "../../../src/highcountry/types/HighCountryTypes.sol";
import { InvariantTarget420 } from "../../helpers/InvariantTarget420.sol";
import { MockCapabilityRegistry } from "../mocks/MockCapabilityRegistry.sol";

contract GenesisInvariantHandler {
    GenesisRegistry public immutable genesis;

    constructor(GenesisRegistry genesis_) {
        genesis = genesis_;
    }

    function stepFinalizeAgain() external {
        address(genesis).call(abi.encodeWithSelector(genesis.finalizeGenesis.selector));
    }

    function stepReplaceRoots(uint256 salt) external {
        GenesisRoots memory replacement = GenesisRoots({
            manifestRoot: keccak256(abi.encode("manifest", salt)),
            parameterRoot: keccak256(abi.encode("parameters", salt)),
            rulesetRoot: keccak256(abi.encode("rulesets", salt)),
            landRoot: keccak256(abi.encode("land", salt)),
            randomnessRoot: keccak256(abi.encode("randomness", salt)),
            qualificationRoot: keccak256(abi.encode("qualification", salt))
        });
        address(genesis).call(abi.encodeWithSelector(genesis.setRoots.selector, replacement));
    }
}

contract GenesisRegistryInvariantTest is InvariantTarget420 {
    MockCapabilityRegistry private capabilityRegistry;
    HighCountryAuthorization private authorization;
    GenesisRegistry private genesis;
    GenesisInvariantHandler private handler;
    GenesisRoots private expected;

    function setUp() public {
        capabilityRegistry = new MockCapabilityRegistry();
        authorization = new HighCountryAuthorization(address(capabilityRegistry));
        genesis = new GenesisRegistry(address(authorization));
        handler = new GenesisInvariantHandler(genesis);

        _grant(address(this), ActionIds.GENESIS_SET_ROOTS, keccak256("setup:set-roots"));
        _grant(address(this), ActionIds.GENESIS_FINALIZE, keccak256("setup:finalize"));
        _grant(address(handler), ActionIds.GENESIS_SET_ROOTS, keccak256("handler:set-roots"));
        _grant(address(handler), ActionIds.GENESIS_FINALIZE, keccak256("handler:finalize"));

        expected = _roots();
        genesis.setRoots(expected);
        genesis.finalizeGenesis();
        targetContract(address(handler));
    }

    function invariant_HC_INV_GENESIS_001_FinalizesExactlyOnce() public view {
        require(genesis.finalized(), "HC-INV-GENESIS-001: finalization lost");
        require(!genesis.genesisAuthorityEnabled(), "HC-INV-GENESIS-001: authority re-enabled");
    }

    function invariant_HC_INV_GENESIS_002_RootsCannotChangeAfterFinalization() public view {
        GenesisRoots memory actual = genesis.roots();
        require(actual.manifestRoot == expected.manifestRoot, "HC-INV-GENESIS-002: manifest");
        require(actual.parameterRoot == expected.parameterRoot, "HC-INV-GENESIS-002: parameters");
        require(actual.rulesetRoot == expected.rulesetRoot, "HC-INV-GENESIS-002: rulesets");
        require(actual.landRoot == expected.landRoot, "HC-INV-GENESIS-002: land");
        require(actual.randomnessRoot == expected.randomnessRoot, "HC-INV-GENESIS-002: randomness");
        require(actual.qualificationRoot == expected.qualificationRoot, "HC-INV-GENESIS-002: qualification");
    }

    function _grant(address principal, bytes32 actionId, bytes32 grantId) private {
        ICapabilityRegistry420.CapabilityGrant memory grant = ICapabilityRegistry420.CapabilityGrant({
            principal: principal,
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

    function _roots() private pure returns (GenesisRoots memory) {
        return GenesisRoots({
            manifestRoot: keccak256("manifest"),
            parameterRoot: keccak256("parameters"),
            rulesetRoot: keccak256("rulesets"),
            landRoot: keccak256("land"),
            randomnessRoot: keccak256("randomness"),
            qualificationRoot: keccak256("qualification")
        });
    }
}

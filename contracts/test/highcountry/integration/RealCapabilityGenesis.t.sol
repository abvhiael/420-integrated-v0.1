// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { CapabilityRegistry420 } from "../../../src/system/CapabilityRegistry420.sol";
import { HighCountryAuthorization } from "../../../src/highcountry/auth/HighCountryAuthorization.sol";
import { GenesisRegistry } from "../../../src/highcountry/genesis/GenesisRegistry.sol";
import { ActionIds } from "../../../src/highcountry/constants/ActionIds.sol";
import { ModuleIds } from "../../../src/highcountry/constants/ModuleIds.sol";
import { AuthorizationRequest, GenesisRoots } from "../../../src/highcountry/types/HighCountryTypes.sol";

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

interface VmRealCapability {
    function prank(
        address caller
    ) external;
    function warp(
        uint256 timestamp
    ) external;
}

/// @dev Exercises the production registry, not a programmable authorization mock.
contract RealCapabilityWiringTest {
    VmRealCapability private constant vm = VmRealCapability(address(uint160(uint256(keccak256("hevm cheat code")))));
    CapabilityRegistry420 private caps;
    HighCountryAuthorization private auth;
    GenesisRegistry private genesis;
    address private constant OTHER = address(0xB0B);
    bytes32 private constant GRANT = keccak256("HC.R02.1.GRANT");

    constructor() {
        caps = new CapabilityRegistry420();
        auth = new HighCountryAuthorization(address(caps));
        genesis = new GenesisRegistry(address(auth));
    }

    function _register() private {
        caps.registerProtocolComponent(ModuleIds.GENESIS_REGISTRY, address(this));
    }

    function _grant(
        bytes32 id,
        bytes32 action,
        bytes32 scope,
        uint64 from,
        uint64 until
    ) private {
        caps.createGrant(id, address(this), ModuleIds.GENESIS_REGISTRY, action, scope, 0, 0, 0, from, until);
    }

    function _roots() private pure returns (GenesisRoots memory) {
        return
            GenesisRoots(keccak256("m"), keccak256("p"), keccak256("r"), keccak256("l"), keccak256("x"), keccak256("q"));
    }

    function _reject(
        address target,
        bytes memory input,
        bytes4 expected
    ) private {
        (bool ok, bytes memory reason) = target.call(input);
        require(!ok && reason.length >= 4 && bytes4(reason) == expected, "wrong failure or unexpectedly succeeded");
    }

    function testUnregisteredComponentCannotIssueGrant() public {
        _reject(
            address(caps),
            abi.encodeCall(
                caps.createGrant,
                (
                    GRANT,
                    address(this),
                    ModuleIds.GENESIS_REGISTRY,
                    ActionIds.GENESIS_SET_ROOTS,
                    genesis.ADMIN_SCOPE(),
                    0,
                    0,
                    0,
                    0,
                    0
                )
            ),
            CapabilityRegistry420.UnauthorizedAuthority.selector
        );
    }

    function testOnlyRegistrarCanRegisterOrRotateComponent() public {
        vm.prank(OTHER);
        _reject(
            address(caps),
            abi.encodeCall(caps.registerProtocolComponent, (ModuleIds.GENESIS_REGISTRY, OTHER)),
            CapabilityRegistry420.UnauthorizedAuthority.selector
        );
        _register();
        vm.prank(OTHER);
        _reject(
            address(caps),
            abi.encodeCall(caps.updateProtocolComponentAuthority, (ModuleIds.GENESIS_REGISTRY, OTHER)),
            CapabilityRegistry420.UnauthorizedAuthority.selector
        );
        require(caps.componentAuthority(ModuleIds.GENESIS_REGISTRY) == address(this), "authority changed");
    }

    function testOnlyComponentAuthorityCanIssueAndRevoke() public {
        _register();
        bytes32 scope = genesis.ADMIN_SCOPE();
        vm.prank(OTHER);
        _reject(
            address(caps),
            abi.encodeCall(
                caps.createGrant,
                (GRANT, OTHER, ModuleIds.GENESIS_REGISTRY, ActionIds.GENESIS_SET_ROOTS, scope, 0, 0, 0, 0, 0)
            ),
            CapabilityRegistry420.UnauthorizedAuthority.selector
        );
        _grant(GRANT, ActionIds.GENESIS_SET_ROOTS, scope, 0, 0);
        vm.prank(OTHER);
        _reject(
            address(caps),
            abi.encodeCall(caps.revokeGrant, (GRANT)),
            CapabilityRegistry420.UnauthorizedAuthority.selector
        );
        genesis.setRoots(_roots());
    }

    function testZeroScopeIsUnissuableAndAdminScopeIsCanonical() public {
        _register();
        require(genesis.ADMIN_SCOPE() == keccak256("HC.GENESIS.ADMIN.V1"), "admin scope drift");
        _reject(
            address(caps),
            abi.encodeCall(
                caps.createGrant,
                (
                    GRANT,
                    address(this),
                    ModuleIds.GENESIS_REGISTRY,
                    ActionIds.GENESIS_SET_ROOTS,
                    bytes32(0),
                    0,
                    0,
                    0,
                    0,
                    0
                )
            ),
            CapabilityRegistry420.InvalidIdentifier.selector
        );
        _grant(GRANT, ActionIds.GENESIS_SET_ROOTS, genesis.ADMIN_SCOPE(), 0, 0);
        genesis.setRoots(_roots());
    }

    function testWrongScopeCannotSetRoots() public {
        _register();
        _grant(GRANT, ActionIds.GENESIS_SET_ROOTS, keccak256("wrong scope"), 0, 0);
        (bool ok,) = address(genesis).call(abi.encodeCall(genesis.setRoots, (_roots())));
        require(!ok && genesis.roots().manifestRoot == bytes32(0), "wrong scope mutated roots");
    }

    function testWrongActionCannotSetRootsOrFinalize() public {
        _register();
        _grant(GRANT, ActionIds.GENESIS_FINALIZE, genesis.ADMIN_SCOPE(), 0, 0);
        (bool set,) = address(genesis).call(abi.encodeCall(genesis.setRoots, (_roots())));
        require(!set, "finalize grant set roots");
        _grant(keccak256("set"), ActionIds.GENESIS_SET_ROOTS, genesis.ADMIN_SCOPE(), 0, 0);
        genesis.setRoots(_roots());
        caps.revokeGrant(GRANT);
        (bool finish,) = address(genesis).call(abi.encodeCall(genesis.finalizeGenesis, ()));
        require(!finish && !genesis.finalized(), "set grant finalized");
    }

    function testWrongPrincipalCannotUseGrant() public {
        _register();
        _grant(GRANT, ActionIds.GENESIS_SET_ROOTS, genesis.ADMIN_SCOPE(), 0, 0);
        vm.prank(OTHER);
        (bool ok,) = address(genesis).call(abi.encodeCall(genesis.setRoots, (_roots())));
        require(!ok && genesis.roots().manifestRoot == bytes32(0), "wrong principal mutated roots");
    }

    function testModuleActionScopeAndAmountMatchExactly() public {
        _register();
        caps.createGrant(
            GRANT,
            address(this),
            ModuleIds.GENESIS_REGISTRY,
            ActionIds.GENESIS_SET_ROOTS,
            genesis.ADMIN_SCOPE(),
            1,
            0,
            0,
            0,
            0
        );
        AuthorizationRequest memory r = AuthorizationRequest(
            address(this), ModuleIds.GENESIS_REGISTRY, ActionIds.GENESIS_SET_ROOTS, genesis.ADMIN_SCOPE(), 1
        );
        require(auth.isAuthorized(r), "exact tuple denied");
        r.moduleId = ModuleIds.PLANT_REGISTRY;
        require(!auth.isAuthorized(r), "foreign component accepted");
        r.moduleId = ModuleIds.GENESIS_REGISTRY;
        r.amount = 2;
        require(!auth.isAuthorized(r), "per-call limit bypass");
        r.amount = 1;
        r.principal = address(0);
        require(!auth.isAuthorized(r), "zero principal accepted");
    }

    function testGrantTimeBoundariesAreInclusiveAndExpiredCallsDoNotMutate() public {
        vm.warp(100);
        _register();
        _grant(GRANT, ActionIds.GENESIS_SET_ROOTS, genesis.ADMIN_SCOPE(), 110, 120);
        (bool early,) = address(genesis).call(abi.encodeCall(genesis.setRoots, (_roots())));
        require(!early, "future grant accepted");
        vm.warp(110);
        genesis.setRoots(_roots());
        vm.warp(120);
        genesis.setRoots(_roots());
        vm.warp(121);
        GenesisRoots memory changed = _roots();
        changed.manifestRoot = keccak256("changed");
        (bool late,) = address(genesis).call(abi.encodeCall(genesis.setRoots, (changed)));
        require(!late && genesis.roots().manifestRoot == _roots().manifestRoot, "expired grant changed roots");
    }

    function testGrantReplacementRevokesOldTupleAndRevocationStopsConsumer() public {
        _register();
        _grant(GRANT, ActionIds.GENESIS_SET_ROOTS, genesis.ADMIN_SCOPE(), 0, 0);
        bytes32 replacement = keccak256("replacement");
        _grant(replacement, ActionIds.GENESIS_SET_ROOTS, genesis.ADMIN_SCOPE(), 0, 0);
        require(caps.grant(GRANT).revoked && !caps.grant(replacement).revoked, "old grant not revoked");
        genesis.setRoots(_roots());
        caps.revokeGrant(replacement);
        (bool ok,) = address(genesis).call(abi.encodeCall(genesis.setRoots, (_roots())));
        require(!ok, "revoked grant accepted");
    }

    function testAuthorityHandoffRequiresExplicitOldGrantRevocation() public {
        _register();
        _grant(GRANT, ActionIds.GENESIS_SET_ROOTS, genesis.ADMIN_SCOPE(), 0, 0);
        caps.updateProtocolComponentAuthority(ModuleIds.GENESIS_REGISTRY, OTHER);
        // Registry rotation changes issuance authority, not existing principal authorization.
        genesis.setRoots(_roots());
        _reject(
            address(caps),
            abi.encodeCall(caps.revokeGrant, (GRANT)),
            CapabilityRegistry420.UnauthorizedAuthority.selector
        );
        vm.prank(OTHER);
        caps.revokeGrant(GRANT);
        (bool ok,) = address(genesis).call(abi.encodeCall(genesis.setRoots, (_roots())));
        require(!ok, "handoff left bootstrap authorization active");
    }

    function testRegistrarHandoffDisablesOldRegistrar() public {
        caps.transferComponentRegistrar(OTHER);
        _reject(
            address(caps),
            abi.encodeCall(caps.registerProtocolComponent, (ModuleIds.GENESIS_REGISTRY, address(this))),
            CapabilityRegistry420.UnauthorizedAuthority.selector
        );
        vm.prank(OTHER);
        caps.registerProtocolComponent(ModuleIds.GENESIS_REGISTRY, address(this));
        require(caps.componentAuthority(ModuleIds.GENESIS_REGISTRY) == address(this), "new registrar failed");
    }
}

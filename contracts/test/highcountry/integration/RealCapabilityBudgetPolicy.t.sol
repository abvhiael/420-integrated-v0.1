// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { CapabilityRegistry420 } from "../../../src/system/CapabilityRegistry420.sol";
import { HighCountryAuthorization } from "../../../src/highcountry/auth/HighCountryAuthorization.sol";
import { GenesisRegistry } from "../../../src/highcountry/genesis/GenesisRegistry.sol";
import { ActionIds } from "../../../src/highcountry/constants/ActionIds.sol";
import { ModuleIds } from "../../../src/highcountry/constants/ModuleIds.sol";
import { AuthorizationRequest, GenesisRoots } from "../../../src/highcountry/types/HighCountryTypes.sol";

interface VmHCBudget {
    function prank(
        address caller
    ) external;
    function warp(
        uint256 timestamp
    ) external;
}

contract RealCapabilityBudgetPolicyTest {
    VmHCBudget private constant vm = VmHCBudget(address(uint160(uint256(keccak256("hevm cheat code")))));
    CapabilityRegistry420 private caps;
    HighCountryAuthorization private auth;
    GenesisRegistry private genesis;
    bytes32 private constant ID = keccak256("HC.BUDGET.TEST");

    constructor() {
        caps = new CapabilityRegistry420();
        auth = new HighCountryAuthorization(address(caps));
        genesis = new GenesisRegistry(address(auth));
        caps.registerProtocolComponent(ModuleIds.GENESIS_REGISTRY, address(this));
    }

    function _issue(
        bytes32 id,
        uint256 limit,
        uint64 seconds_
    ) private {
        caps.createGrant(
            id,
            address(this),
            ModuleIds.GENESIS_REGISTRY,
            ActionIds.GENESIS_SET_ROOTS,
            genesis.ADMIN_SCOPE(),
            0,
            limit,
            seconds_,
            0,
            0
        );
    }

    function _request() private view returns (AuthorizationRequest memory) {
        return AuthorizationRequest(
            address(this), ModuleIds.GENESIS_REGISTRY, ActionIds.GENESIS_SET_ROOTS, genesis.ADMIN_SCOPE(), 0
        );
    }

    function _roots() private pure returns (GenesisRoots memory) {
        return
            GenesisRoots(keccak256("m"), keccak256("p"), keccak256("r"), keccak256("l"), keccak256("x"), keccak256("q"));
    }

    function testPeriodicGrantNeverAdmitsRepeatedZeroAmountCalls() public {
        _issue(ID, 100, 60);
        require(
            caps.isAuthorized(
                address(this), ModuleIds.GENESIS_REGISTRY, ActionIds.GENESIS_SET_ROOTS, genesis.ADMIN_SCOPE(), 0
            ),
            "fixture must be authorized by real registry"
        );
        for (uint256 i; i < 32; ++i) {
            require(!auth.isAuthorized(_request()), "periodic grant admitted");
            (bool ok,) = address(genesis).call(abi.encodeCall(genesis.setRoots, (_roots())));
            require(!ok, "periodic mutator admitted");
        }
        require(genesis.roots().manifestRoot == bytes32(0), "failed calls mutated roots");
        require(caps.usage(ID).used == 0, "HC view consumed unauthorized budget");
    }

    function testPeriodicReplacementCannotFallBackToOldUnlimitedGrant() public {
        _issue(ID, 0, 0);
        genesis.setRoots(_roots());
        _issue(keccak256("periodic replacement"), 1, 60);
        require(caps.grant(ID).revoked, "old grant not revoked");
        require(!auth.isAuthorized(_request()), "old nonperiodic grant used as fallback");
    }

    function testExplicitNonperiodicReplacementRestoresAuthorization() public {
        _issue(ID, 1, 60);
        require(!auth.isAuthorized(_request()), "periodic admitted");
        bytes32 replacement = keccak256("nonperiodic replacement");
        _issue(replacement, 0, 0);
        require(caps.grant(ID).revoked && auth.isAuthorized(_request()), "replacement failed");
        genesis.setRoots(_roots());
        caps.revokeGrant(replacement);
        require(!auth.isAuthorized(_request()), "revocation failed");
    }

    function testPeriodicRolloverDoesNotEnableHCGrant() public {
        _issue(ID, 1, 60);
        for (uint256 i = 1; i <= 3; ++i) {
            vm.warp(i * 60);
            require(!auth.isAuthorized(_request()), "period rollover enabled HC authorization");
        }
    }

    function testHCDoesNotTakeComponentConsumptionAuthority() public {
        _issue(ID, 100, 60);
        vm.prank(address(auth));
        (bool ok,) = address(caps).call(abi.encodeCall(caps.consume, (ID, 1)));
        require(!ok && caps.usage(ID).used == 0, "adapter acquired component consumption authority");
        caps.consume(ID, 1);
        require(caps.usage(ID).used == 1, "actual component authority cannot consume");
        require(!auth.isAuthorized(_request()), "externally consumed periodic grant admitted");
    }

    function testPeriodicGrantDoesNotAuthorizePositiveAmounts() public {
        _issue(ID, 100, 60);
        AuthorizationRequest memory r = _request();
        r.amount = 1;
        require(!auth.isAuthorized(r), "positive amount bypassed rejection");
        r.amount = type(uint256).max;
        require(!auth.isAuthorized(r), "maximum amount bypassed rejection");
    }
}

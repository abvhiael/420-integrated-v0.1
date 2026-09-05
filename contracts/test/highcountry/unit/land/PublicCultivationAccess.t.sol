// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ICapabilityRegistry420 } from "../../../../src/interfaces/genesis/ICapabilityRegistry420.sol";
import { HighCountryAuthorization } from "../../../../src/highcountry/auth/HighCountryAuthorization.sol";
import { ActionIds } from "../../../../src/highcountry/constants/ActionIds.sol";
import { ModuleIds } from "../../../../src/highcountry/constants/ModuleIds.sol";
import { IGenesisRegistry } from "../../../../src/highcountry/interfaces/IGenesisRegistry.sol";
import { LandRegistry } from "../../../../src/highcountry/land/LandRegistry.sol";
import { PublicCultivationAccess } from "../../../../src/highcountry/land/PublicCultivationAccess.sol";
import { GenesisRoots } from "../../../../src/highcountry/types/HighCountryTypes.sol";
import { MockCapabilityRegistry } from "../../mocks/MockCapabilityRegistry.sol";

contract MockRegionRegistryHC3Public {
    function exists(uint16 regionId) external pure returns (bool) { return regionId >= 1 && regionId <= 3; }
}

contract MockGenesisRegistryHC3Public is IGenesisRegistry {
    GenesisRoots private _roots;
    bool public finalized = true;
    bool public genesisAuthorityEnabled;
    function roots() external view returns (GenesisRoots memory) { return _roots; }
    function setRoots(GenesisRoots calldata newRoots) external { _roots = newRoots; }
    function finalizeGenesis() external { finalized = true; genesisAuthorityEnabled = false; }
}

contract PublicCultivationAccessHC3Test {
    MockCapabilityRegistry private capabilityRegistry;
    HighCountryAuthorization private authorization;
    LandRegistry private land;
    PublicCultivationAccess private publicAccess;

    constructor() {
        capabilityRegistry = new MockCapabilityRegistry();
        authorization = new HighCountryAuthorization(address(capabilityRegistry));
        MockRegionRegistryHC3Public regions = new MockRegionRegistryHC3Public();
        MockGenesisRegistryHC3Public genesis = new MockGenesisRegistryHC3Public();
        land = new LandRegistry(address(authorization), address(regions), address(genesis));
        publicAccess = new PublicCultivationAccess(address(authorization), address(land));

        _grant(ModuleIds.LAND_REGISTRY, ActionIds.LAND_REGISTER, 1, 10, keccak256("land-1"));
        land.registerParcel(1, 1, address(this), 10, keccak256("PUBLIC_LAND"), keccak256("land-meta"));
    }

    function testPublicCapacityCannotExceedParcelCapacity() public {
        _grant(ModuleIds.PUBLIC_CULTIVATION_ACCESS, ActionIds.PUBLIC_PLOT_REGISTER, 1, 6, keccak256("plot-1"));
        publicAccess.registerPublicPlot(1, 1, 6);
        require(publicAccess.publicCapacityOnParcel(1) == 6, "wrong parcel public capacity");

        (bool ok,) = address(publicAccess).call(
            abi.encodeWithSelector(publicAccess.registerPublicPlot.selector, uint64(2), uint64(1), uint32(5))
        );
        require(!ok, "parcel public capacity exceeded");
        require(!publicAccess.exists(2), "overflow plot persisted");
    }

    function testAllocationAndReleaseConserveCapacity() public {
        _grant(ModuleIds.PUBLIC_CULTIVATION_ACCESS, ActionIds.PUBLIC_PLOT_REGISTER, 3, 10, keccak256("plot-3"));
        _grant(ModuleIds.PUBLIC_CULTIVATION_ACCESS, ActionIds.PUBLIC_PLOT_ALLOCATE, 3, 4, keccak256("allocate-3"));
        _grant(ModuleIds.PUBLIC_CULTIVATION_ACCESS, ActionIds.PUBLIC_PLOT_RELEASE, 3, 4, keccak256("release-3"));
        publicAccess.registerPublicPlot(3, 1, 10);

        publicAccess.allocate(3, 4);
        require(publicAccess.allocationOf(3, address(this)) == 4, "allocation missing");
        require(publicAccess.availableCapacity(3) == 6, "available capacity wrong");

        (bool duplicateOk,) = address(publicAccess).call(
            abi.encodeWithSelector(publicAccess.allocate.selector, uint64(3), uint32(1))
        );
        require(!duplicateOk, "duplicate allocation accepted");

        publicAccess.release(3);
        require(publicAccess.allocationOf(3, address(this)) == 0, "allocation not cleared");
        require(publicAccess.availableCapacity(3) == 10, "capacity not restored");
    }

    function testAllocationCannotOverbookPlot() public {
        _grant(ModuleIds.PUBLIC_CULTIVATION_ACCESS, ActionIds.PUBLIC_PLOT_REGISTER, 4, 5, keccak256("plot-4"));
        publicAccess.registerPublicPlot(4, 1, 5);

        (bool ok,) = address(publicAccess).call(
            abi.encodeWithSelector(publicAccess.allocate.selector, uint64(4), uint32(6))
        );
        require(!ok, "plot overbooked");
        require(publicAccess.availableCapacity(4) == 5, "failed allocation changed capacity");
    }

    function _grant(bytes32 moduleId, bytes32 actionId, uint64 id, uint256 amount, bytes32 grantId) private {
        ICapabilityRegistry420.CapabilityGrant memory grant = ICapabilityRegistry420.CapabilityGrant({
            principal: address(this),
            componentId: moduleId,
            capabilityId: actionId,
            scopeHash: bytes32(uint256(id)),
            perCallLimit: 0,
            periodLimit: 0,
            periodSeconds: 0,
            validFrom: 0,
            validUntil: uint64(block.timestamp + 1 days),
            revoked: false
        });
        capabilityRegistry.setGrant(grantId, grant, amount);
    }
}

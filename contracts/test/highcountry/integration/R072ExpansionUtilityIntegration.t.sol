// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import { CompositeRegionMembership } from "../../../src/highcountry/world/CompositeRegionMembership.sol";
import { RegionalUtilities } from "../../../src/highcountry/world/RegionalUtilities.sol";
import { RegionalClimatePolicy } from "../../../src/highcountry/world/RegionalClimatePolicy.sol";
import { HighCountryAuthorization } from "../../../src/highcountry/auth/HighCountryAuthorization.sol";
import { ICapabilityRegistry420 } from "../../../src/interfaces/genesis/ICapabilityRegistry420.sol";
import { MockCapabilityRegistry } from "../mocks/MockCapabilityRegistry.sol";

contract R072MockFounding {
    function exists(
        uint16 id
    ) external pure returns (bool) {
        return id >= 1 && id <= 3;
    }
}

contract R072MockExpansion {
    bool public opened;

    function setOpen(
        bool v
    ) external {
        opened = v;
    }

    function isOpen(
        uint16 id
    ) external view returns (bool) {
        return id == 4 && opened;
    }
}

contract R072ExpansionUtilityIntegrationTest {
    MockCapabilityRegistry private caps;
    HighCountryAuthorization private auth;
    R072MockFounding private founding;
    R072MockExpansion private expansions;
    CompositeRegionMembership private region;
    RegionalUtilities private utilities;

    constructor() {
        caps = new MockCapabilityRegistry();
        auth = new HighCountryAuthorization(address(caps));
        founding = new R072MockFounding();
        expansions = new R072MockExpansion();
        region = new CompositeRegionMembership(address(founding), address(expansions));
        utilities = new RegionalUtilities(address(auth), address(region));
        _grant(utilities.ISSUE(), 1, keccak256("issue1"));
        _grant(utilities.CONSUME(), 1, keccak256("consume1"));
        _grant(utilities.ISSUE(), 4, keccak256("issue4"));
        _grant(utilities.CONSUME(), 4, keccak256("consume4"));
    }

    function _grant(
        bytes32 action,
        uint16 r,
        bytes32 id
    ) private {
        ICapabilityRegistry420.CapabilityGrant memory g = ICapabilityRegistry420.CapabilityGrant({
            principal: address(this),
            componentId: utilities.MODULE_ID(),
            capabilityId: action,
            scopeHash: bytes32(uint256(r)),
            perCallLimit: 0,
            periodLimit: 0,
            periodSeconds: 0,
            validFrom: 0,
            validUntil: uint64(block.timestamp + 1 days),
            revoked: false
        });
        caps.setGrant(id, g, 0);
    }

    function testFoundingAndExpansionGates() public {
        require(region.exists(1) && region.exists(2) && region.exists(3), "founding closed");
        require(!region.exists(4) && !region.exists(0), "bad future/zero gate");
        (bool denied,) = address(utilities)
            .call(abi.encodeCall(utilities.provision, (keccak256("closed"), 4, uint8(1), address(this), uint256(1))));
        require(!denied, "closed region minted");
        expansions.setOpen(true);
        require(region.exists(4), "expansion not opened");
        utilities.provision(keccak256("opened"), 4, 1, address(this), 1000);
        require(utilities.balance(4, 1, address(this)) == 1000, "open region unavailable");
        expansions.setOpen(false);
        require(!region.exists(4), "close ineffective");
    }

    function testConservationAndReplay() public {
        utilities.provision(keccak256("p1"), 1, 1, address(this), 5000);
        utilities.transfer(keccak256("t1"), 1, 1, address(0xBEEF), 1000);
        utilities.consume(keccak256("c1"), 1, 1, address(this), 2000);
        require(utilities.issued(1, 1) == 5000 && utilities.spent(1, 1) == 2000, "issuance accounting");
        require(utilities.outstanding(1, 1) == 3000, "supply broken");
        require(
            utilities.balance(1, 1, address(this)) == 2000 && utilities.balance(1, 1, address(0xBEEF)) == 1000,
            "balance conservation"
        );
        (bool replay,) = address(utilities)
            .call(abi.encodeCall(utilities.provision, (keccak256("p1"), 1, uint8(1), address(this), uint256(5000))));
        require(!replay, "replay accepted");
        (bool overspend,) = address(utilities)
            .call(
                abi.encodeCall(utilities.consume, (keccak256("overspend"), 1, uint8(1), address(this), uint256(2001)))
            );
        require(!overspend, "over-consumption accepted");
        require(!utilities.applied(keccak256("overspend")), "failed op burned replay key");
    }

    function testWrongScopeAndAssetAndClimateRates() public {
        (bool wrong,) = address(utilities)
            .call(abi.encodeCall(utilities.provision, (keccak256("wrong"), 2, uint8(1), address(this), uint256(1))));
        require(!wrong, "wrong region grant accepted");
        (bool invalid,) = address(utilities)
            .call(abi.encodeCall(utilities.provision, (keccak256("invalid"), 1, uint8(3), address(this), uint256(1))));
        require(!invalid, "invalid asset accepted");
        (uint16 delta, uint256 ml) = RegionalClimatePolicy.irrigation(3);
        require(delta == 300 && ml == 3000, "water conversion");
        (delta, ml) = RegionalClimatePolicy.climateControl(4);
        require(delta == 400 && ml == 1000, "energy conversion");
    }
}

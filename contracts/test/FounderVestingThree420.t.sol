// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/system/FounderVestingRegistry.sol";

interface VmFounderVestingThree420 {
    function warp(uint256 timestamp) external;
    function prank(address actor) external;
    function deal(address recipient, uint256 amount) external;
}

contract FounderVestingThree420Test {
    VmFounderVestingThree420 private constant vm = VmFounderVestingThree420(
        address(uint160(uint256(keccak256("hevm cheat code"))))
    );
    address private constant ADMIN = address(0xA110);
    address private constant ANDREW = address(0xA220);
    address private constant JANET = address(0xA330);
    FounderVestingRegistry private vest;
    uint64 private genesisTime;

    function setUp() public {
        vm.warp(1_000_000);
        genesisTime = uint64(block.timestamp);
        address[3] memory founders = [ADMIN, ANDREW, JANET];
        vest = new FounderVestingRegistry(address(this), founders, genesisTime);
        vm.deal(address(vest), 500_000 ether);
    }

    function testExactThreeFounderAllocationAndSourceIsFullyFunded() public view {
        require(vest.FOUNDER_COUNT() == 3, "three beneficiaries");
        require(vest.TOTAL_FOUNDER_ALLOCATION() == 1_000_000 ether, "total genesis allocation");
        require(vest.TOTAL_LOCKED_ALLOCATION() == 500_000 ether, "total locked");
        require(vest.TOTAL_LIQUID_ALLOCATION() == 500_000 ether, "total liquid");
        require(address(vest).balance == 500_000 ether, "physical locked funding");
        require(vest.lockedAllocation(0) == 250_000 ether, "admin locked 50pct");
        require(vest.lockedAllocation(1) == 125_000 ether, "andrew locked 25pct");
        require(vest.lockedAllocation(2) == 125_000 ether, "janet locked 25pct");
        require(vest.liquidGenesisAllocation(0) == 250_000 ether, "admin liquid");
        require(vest.liquidGenesisAllocation(1) == 125_000 ether, "andrew liquid");
        require(vest.liquidGenesisAllocation(2) == 125_000 ether, "janet liquid");
        (address a,,) = vest.grants(0);
        (address b,,) = vest.grants(1);
        (address c,,) = vest.grants(2);
        require(a == ADMIN && b == ANDREW && c == JANET, "role mapping");
    }

    function testNoFounderCanClaimBeforeFirstFourteenDays() public {
        require(vest.vested(0, genesisTime) == 0, "not vested at genesis");
        require(vest.claimable(1) == 0, "not claimable at genesis");
        vm.prank(ADMIN);
        (bool early,) = address(vest).call(abi.encodeCall(vest.claim, (0)));
        require(!early, "no early vested claim");
        vm.warp(genesisTime + 14 days - 1);
        require(vest.claimable(0) == 0, "no precliff vest");
        vm.warp(genesisTime + 14 days);
        require(vest.vested(0, block.timestamp) == 250_000 ether / 13, "first 14day installment");
        require(vest.vested(1, block.timestamp) == 125_000 ether / 13, "first cofounder installment");
    }

    function testNonBeneficiaryCannotClaimOrRedirectAFounderGrant() public {
        vm.warp(genesisTime + 182 days);
        vm.prank(ANDREW);
        (bool stole,) = address(vest).call(abi.encodeCall(vest.claim, (0)));
        require(!stole, "andrew stole administrator grant");
        vm.prank(address(0xBAD));
        (bool outsider,) = address(vest).call(abi.encodeCall(vest.claim, (2)));
        require(!outsider, "unknown wallet claimed janet");
        require(vest.claimable(0) == 250_000 ether, "rejected claims change nothing");
    }

    function testThirteenFortnightlyCumulativeReleasesAndFullDay182Settlement() public {
        for (uint256 round = 1; round <= 13; ++round) {
            vm.warp(uint256(genesisTime) + round * 14 days);
            uint256 expectedAdmin = 250_000 ether * round / 13;
            uint256 expectedAndrew = 125_000 ether * round / 13;
            uint256 expectedJanet = 125_000 ether * round / 13;
            require(vest.vested(0, block.timestamp) == expectedAdmin, "admin cumulative");
            require(vest.vested(1, block.timestamp) == expectedAndrew, "andrew cumulative");
            require(vest.vested(2, block.timestamp) == expectedJanet, "janet cumulative");
            vm.prank(ADMIN); vest.claim(0);
            vm.prank(ANDREW); vest.claim(1);
            vm.prank(JANET); vest.claim(2);
            require(ADMIN.balance == expectedAdmin, "admin actually received");
            require(ANDREW.balance == expectedAndrew, "andrew actually received");
            require(JANET.balance == expectedJanet, "janet actually received");
            vm.prank(ADMIN);
            (bool twice,) = address(vest).call(abi.encodeCall(vest.claim, (0)));
            require(!twice, "double release within same interval");
        }
        require(address(vest).balance == 0, "entire 500k locked supply delivered");
        require(ADMIN.balance + ANDREW.balance + JANET.balance == 500_000 ether, "conservation");
        vm.warp(uint256(genesisTime) + 365 days);
        require(vest.claimable(0) == 0 && vest.claimable(1) == 0 && vest.claimable(2) == 0,
            "no new release after final installment");
    }

    function testUniqueNonzeroPersonalWalletsAndReservedSystemAddresses() public {
        address[3] memory dupes = [ADMIN, ADMIN, JANET];
        try new FounderVestingRegistry(address(this), dupes, genesisTime) {
            revert("duplicate founder recipients accepted");
        } catch {}
        address[3] memory zero = [ADMIN, address(0), JANET];
        try new FounderVestingRegistry(address(this), zero, genesisTime) {
            revert("empty founder recipient accepted");
        } catch {}
        address[3] memory reserved = [ADMIN, address(0x0427), JANET];
        try new FounderVestingRegistry(address(this), reserved, genesisTime) {
            revert("predeploy address used as founder signing key");
        } catch {}
    }

    function testNoArbitraryIndexOrPostGenesisGrantInsertion() public {
        (bool invalid,) = address(vest).call(abi.encodeCall(vest.claim, (3)));
        require(!invalid, "fourth wallet claims grant");
        (invalid,) = address(vest).staticcall(abi.encodeCall(vest.lockedAllocation, (3)));
        require(!invalid, "fourth allocation exists");
        require(vest.protocolVersion() == 2, "updated predeploy ABI version");
    }
}

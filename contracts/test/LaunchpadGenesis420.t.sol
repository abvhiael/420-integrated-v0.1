// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/launchpad/LaunchpadIds420.sol";
import "../src/launchpad/LaunchpadAuthorization420.sol";
import "../src/launchpad/LaunchpadProjectRegistry420.sol";
import "../src/launchpad/LaunchpadSaleRegistry420.sol";
import "../src/launchpad/LaunchpadAllocationRegistry420.sol";

interface VmLaunchpad420 {
    function warp(uint256) external;
    function prank(address) external;
    function expectRevert(bytes4) external;
}

contract MockLaunchpadCapabilities420 is ICapabilityRegistry420 {
    bool public allowed;
    function setAllowed(bool allowed_) external { allowed = allowed_; }
    function grant(bytes32) external pure returns (CapabilityGrant memory g) { return g; }
    function isAuthorized(address, bytes32, bytes32, bytes32, uint256) external view returns (bool) { return allowed; }
}

contract LaunchpadGenesis420Test {
    VmLaunchpad420 constant vm = VmLaunchpad420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant ALICE = address(0xA11CE);
    address constant TOKEN = address(0x7001);
    address constant PAYMENT = address(0x420);
    address constant RECEIVER = address(0xBEEF);

    MockLaunchpadCapabilities420 caps;
    LaunchpadAuthorization420 auth;
    LaunchpadProjectRegistry420 projects;
    LaunchpadSaleRegistry420 sales;
    LaunchpadAllocationRegistry420 allocations;
    bytes32 projectId;
    bytes32 saleId;

    function setUp() public {
        caps = new MockLaunchpadCapabilities420();
        auth = new LaunchpadAuthorization420(address(caps));
        projects = new LaunchpadProjectRegistry420(address(this));
        sales = new LaunchpadSaleRegistry420(address(this), address(projects));
        allocations = new LaunchpadAllocationRegistry420(address(auth), address(sales));
        sales.setController(address(allocations));

        bytes32 metadata = keccak256("project/metadata");
        bytes32 issuance = keccak256("project/issuance");
        projectId = projects.canonicalId(address(this), TOKEN, metadata, issuance);
        projects.registerProject(projectId, address(this), TOKEN, metadata, issuance);

        saleId = sales.canonicalId(projectId, PAYMENT, RECEIVER, 500, 1000, 600, 10000, 10, 20, 30, keccak256("eligibility"), keccak256("liquidity"));
        sales.createSale(saleId, projectId, PAYMENT, RECEIVER, 500, 1000, 600, 10000, 10, 20, 30, keccak256("eligibility"), keccak256("liquidity"));
        sales.activate(saleId);
    }

    function testContributionDefaultDenyThenBounded() public {
        vm.warp(10);
        vm.prank(ALICE);
        vm.expectRevert(LaunchpadAllocationRegistry420.InvalidContribution.selector);
        allocations.contribute(saleId, 500, keccak256("payment/1"));

        caps.setAllowed(true);
        vm.prank(ALICE);
        allocations.contribute(saleId, 500, keccak256("payment/2"));
        require(allocations.contributed(saleId, ALICE) == 500, "contribution recorded");

        vm.prank(ALICE);
        vm.expectRevert(LaunchpadAllocationRegistry420.InvalidContribution.selector);
        allocations.contribute(saleId, 101, keccak256("payment/3"));
    }

    function testSuccessfulSaleCannotClaimBeforeClaimStart() public {
        caps.setAllowed(true);
        vm.warp(10);
        vm.prank(ALICE);
        allocations.contribute(saleId, 500, keccak256("payment/success"));
        vm.warp(21);
        sales.finalize(saleId);
        require(sales.sale(saleId).state == LaunchpadSaleRegistry420.State.SUCCEEDED, "sale succeeded");

        vm.prank(ALICE);
        vm.expectRevert(LaunchpadAllocationRegistry420.NotClaimable.selector);
        allocations.claim(saleId, keccak256("delivery/early"));

        vm.warp(30);
        vm.prank(ALICE);
        allocations.claim(saleId, keccak256("delivery/final"));
        require(allocations.claimed(saleId, ALICE) == 10000, "allocation claimed");
    }

    function testSoftCapFailureBecomesRefundable() public {
        caps.setAllowed(true);
        vm.warp(10);
        vm.prank(ALICE);
        allocations.contribute(saleId, 400, keccak256("payment/fail"));
        vm.warp(21);
        sales.finalize(saleId);
        require(sales.sale(saleId).state == LaunchpadSaleRegistry420.State.FAILED, "sale failed");
        vm.prank(ALICE);
        allocations.recordRefund(saleId, keccak256("refund/1"));
        require(allocations.refunded(saleId, ALICE), "refund recorded");
    }

    function testHardCapCannotBeExceededAcrossWallets() public {
        caps.setAllowed(true);
        vm.warp(10);
        vm.prank(ALICE);
        allocations.contribute(saleId, 600, keccak256("payment/alice"));
        address bob = address(0xB0B);
        vm.prank(bob);
        allocations.contribute(saleId, 400, keccak256("payment/bob"));
        address carol = address(0xCA10);
        vm.prank(carol);
        vm.expectRevert(LaunchpadSaleRegistry420.InvalidState.selector);
        allocations.contribute(saleId, 1, keccak256("payment/carol"));
    }
}

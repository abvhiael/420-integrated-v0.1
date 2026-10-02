// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/launchpad/LaunchpadAuthorization420.sol";
import "../src/launchpad/LaunchpadProjectRegistry420.sol";
import "../src/launchpad/LaunchpadSaleRegistry420.sol";
import "../src/launchpad/LaunchpadAllocationRegistry420.sol";

interface VmLaunchpadAudit420 {
    function warp(uint256) external;
    function prank(address) external;
    function expectRevert(bytes4) external;
}

contract MockLaunchpadAuditCapabilities420 is ICapabilityRegistry420 {
    bool allowed;
    function setAllowed(bool v) external { allowed = v; }
    function grant(bytes32) external pure override returns (CapabilityGrant memory g) { return g; }
    function isAuthorized(address, bytes32, bytes32, bytes32, uint256) external view override returns (bool) { return allowed; }
}

contract LaunchpadAudit420Test {
    VmLaunchpadAudit420 constant vm = VmLaunchpadAudit420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant ALICE = address(0xA11CE);
    MockLaunchpadAuditCapabilities420 caps;
    LaunchpadProjectRegistry420 projects;
    LaunchpadSaleRegistry420 sales;
    LaunchpadAllocationRegistry420 allocations;
    bytes32 saleId;

    function setUp() public {
        caps = new MockLaunchpadAuditCapabilities420();
        LaunchpadAuthorization420 auth = new LaunchpadAuthorization420(address(caps));
        projects = new LaunchpadProjectRegistry420(address(this));
        sales = new LaunchpadSaleRegistry420(address(this), address(projects));
        allocations = new LaunchpadAllocationRegistry420(address(auth), address(sales));
        sales.setController(address(allocations));

        bytes32 metadata = keccak256("audit/meta");
        bytes32 issuance = keccak256("audit/issuance");
        bytes32 projectId = projects.canonicalId(address(this), address(0x7001), metadata, issuance);
        projects.registerProject(projectId, address(this), address(0x7001), metadata, issuance);

        saleId = sales.canonicalId(
            projectId, address(0x420), address(0xBEEF),
            500, 1000, 600, 10000, 10, 20, 30,
            keccak256("audit/eligibility"), bytes32(0)
        );
        sales.createSale(
            saleId, projectId, address(0x420), address(0xBEEF),
            500, 1000, 600, 10000, 10, 20, 30,
            keccak256("audit/eligibility"), bytes32(0)
        );
    }

    function testControllerIsOneShot() public {
        vm.expectRevert(LaunchpadSaleRegistry420.InvalidState.selector);
        sales.setController(address(0x1234));
    }

    function testContributionRejectedBeforeStartEvenWhenActivated() public {
        sales.activate(saleId);
        caps.setAllowed(true);
        vm.warp(9);
        vm.prank(ALICE);
        vm.expectRevert(LaunchpadAllocationRegistry420.InvalidContribution.selector);
        allocations.contribute(saleId, 1, keccak256("payment"));
    }

    function testUnauthorizedClaimFailsAfterSuccess() public {
        sales.activate(saleId);
        caps.setAllowed(true);
        vm.warp(10);
        vm.prank(ALICE);
        allocations.contribute(saleId, 500, keccak256("payment"));
        vm.warp(21);
        sales.finalize(saleId);
        caps.setAllowed(false);
        vm.warp(30);
        vm.prank(ALICE);
        vm.expectRevert(LaunchpadAllocationRegistry420.NotClaimable.selector);
        allocations.claim(saleId, keccak256("delivery"));
    }

    function testSuccessfulSaleIsNotRefundable() public {
        sales.activate(saleId);
        caps.setAllowed(true);
        vm.warp(10);
        vm.prank(ALICE);
        allocations.contribute(saleId, 500, keccak256("payment"));
        vm.warp(21);
        sales.finalize(saleId);
        vm.prank(ALICE);
        vm.expectRevert(LaunchpadAllocationRegistry420.NotRefundable.selector);
        allocations.recordRefund(saleId, keccak256("refund"));
    }

    function testCancellationIsTerminal() public {
        sales.cancel(saleId);
        vm.expectRevert(LaunchpadSaleRegistry420.InvalidState.selector);
        sales.cancel(saleId);
    }
}

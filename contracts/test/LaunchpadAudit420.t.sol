// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/launchpad/LaunchpadAuthorization420.sol";
import "../src/launchpad/LaunchpadProjectRegistry420.sol";
import "../src/launchpad/LaunchpadSaleRegistry420.sol";
import "../src/launchpad/LaunchpadAllocationRegistry420.sol";

interface VmLaunchpadAudit420 {
    function warp(
        uint256
    ) external;
    function prank(
        address
    ) external;
    function expectRevert(
        bytes4
    ) external;
}

contract MockLaunchpadAuditCapabilities420 is ICapabilityRegistry420 {
    bool allowed;

    function setAllowed(
        bool v
    ) external {
        allowed = v;
    }

    function grant(
        bytes32
    ) external pure override returns (CapabilityGrant memory g) {
        return g;
    }

    function isAuthorized(
        address,
        bytes32,
        bytes32,
        bytes32,
        uint256
    ) external view override returns (bool) {
        return allowed;
    }
}

contract LaunchpadAudit420Test {
    VmLaunchpadAudit420 constant vm = VmLaunchpadAudit420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant ALICE = address(0xA11CE);
    address constant BOB = address(0xB0B);
    address constant TOKEN = address(0x7001);
    address constant PAYMENT = address(0x420);
    address constant RECEIVER = address(0xBEEF);

    MockLaunchpadAuditCapabilities420 caps;
    LaunchpadProjectRegistry420 projects;
    LaunchpadSaleRegistry420 sales;
    LaunchpadAllocationRegistry420 allocations;
    bytes32 projectId;
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
        projectId = projects.canonicalId(address(this), TOKEN, metadata, issuance);
        projects.registerProject(projectId, address(this), TOKEN, metadata, issuance);

        saleId = sales.canonicalId(
            projectId, PAYMENT, RECEIVER, 500, 1000, 600, 10000, 10, 20, 30, keccak256("audit/eligibility"), bytes32(0)
        );
        sales.createSale(
            saleId,
            projectId,
            PAYMENT,
            RECEIVER,
            500,
            1000,
            600,
            10000,
            10,
            20,
            30,
            keccak256("audit/eligibility"),
            bytes32(0)
        );
    }

    function testCanonicalProjectIdentityRejectsReplay() public {
        vm.expectRevert(LaunchpadProjectRegistry420.ProjectExists.selector);
        projects.registerProject(projectId, address(this), TOKEN, keccak256("audit/meta"), keccak256("audit/issuance"));
    }

    function testCanonicalSaleIdentityRejectsReplay() public {
        vm.expectRevert(LaunchpadSaleRegistry420.SaleExists.selector);
        sales.createSale(
            saleId,
            projectId,
            PAYMENT,
            RECEIVER,
            500,
            1000,
            600,
            10000,
            10,
            20,
            30,
            keccak256("audit/eligibility"),
            bytes32(0)
        );
    }

    function testInvalidCanonicalSaleIdentityRejected() public {
        vm.expectRevert(LaunchpadSaleRegistry420.InvalidSale.selector);
        sales.createSale(
            keccak256("wrong/sale/id"),
            projectId,
            PAYMENT,
            RECEIVER,
            500,
            1000,
            600,
            10000,
            10,
            20,
            30,
            keccak256("audit/eligibility"),
            bytes32(0)
        );
    }

    function testSaleZeroAndBoundaryConfigurationRejected() public {
        bytes32 invalidId = sales.canonicalId(
            projectId, PAYMENT, RECEIVER, 500, 499, 499, 10000, 10, 20, 30, keccak256("audit/eligibility"), bytes32(0)
        );
        vm.expectRevert(LaunchpadSaleRegistry420.InvalidSale.selector);
        sales.createSale(
            invalidId,
            projectId,
            PAYMENT,
            RECEIVER,
            500,
            499,
            499,
            10000,
            10,
            20,
            30,
            keccak256("audit/eligibility"),
            bytes32(0)
        );
    }

    function testProjectActiveIsRegistrationMarker() public view {
        LaunchpadProjectRegistry420.Project memory p = projects.project(projectId);
        require(p.active && p.exists, "registered project marker");
    }

    function testControllerIsOneShot() public {
        vm.expectRevert(LaunchpadSaleRegistry420.InvalidState.selector);
        sales.setController(address(0x1234));
    }

    function testContributionDefaultDeny() public {
        sales.activate(saleId);
        vm.warp(10);
        vm.prank(ALICE);
        vm.expectRevert(LaunchpadAllocationRegistry420.InvalidContribution.selector);
        allocations.contribute(saleId, 1, keccak256("payment/deny"));
    }

    function testContributionRejectedBeforeStartEvenWhenActivated() public {
        sales.activate(saleId);
        caps.setAllowed(true);
        vm.warp(9);
        vm.prank(ALICE);
        vm.expectRevert(LaunchpadAllocationRegistry420.InvalidContribution.selector);
        allocations.contribute(saleId, 1, keccak256("payment/before"));
    }

    function testContributionAcceptedAtStartBoundary() public {
        sales.activate(saleId);
        caps.setAllowed(true);
        vm.warp(10);
        vm.prank(ALICE);
        allocations.contribute(saleId, 1, keccak256("payment/start"));
        require(allocations.contributed(saleId, ALICE) == 1, "start boundary contribution");
    }

    function testContributionAcceptedAtEndBoundary() public {
        sales.activate(saleId);
        caps.setAllowed(true);
        vm.warp(20);
        vm.prank(ALICE);
        allocations.contribute(saleId, 1, keccak256("payment/end"));
        require(allocations.contributed(saleId, ALICE) == 1, "end boundary contribution");
    }

    function testZeroAmountAndZeroPaymentCommitmentRejected() public {
        sales.activate(saleId);
        caps.setAllowed(true);
        vm.warp(10);

        vm.prank(ALICE);
        vm.expectRevert(LaunchpadAllocationRegistry420.InvalidContribution.selector);
        allocations.contribute(saleId, 0, keccak256("payment/zero-amount"));

        vm.prank(ALICE);
        vm.expectRevert(LaunchpadAllocationRegistry420.InvalidContribution.selector);
        allocations.contribute(saleId, 1, bytes32(0));
    }

    function testExactPerWalletAndHardCapBoundaries() public {
        sales.activate(saleId);
        caps.setAllowed(true);
        vm.warp(10);

        vm.prank(ALICE);
        allocations.contribute(saleId, 600, keccak256("payment/alice"));

        vm.prank(BOB);
        allocations.contribute(saleId, 400, keccak256("payment/bob"));

        require(sales.sale(saleId).raised == 1000, "exact hard cap");

        vm.prank(BOB);
        vm.expectRevert(LaunchpadSaleRegistry420.InvalidState.selector);
        allocations.contribute(saleId, 1, keccak256("payment/over-hard-cap"));
    }

    function testPaymentCommitmentReuseIsAllowedInV1() public {
        sales.activate(saleId);
        caps.setAllowed(true);
        vm.warp(10);
        bytes32 commitment = keccak256("opaque/payment/reference");

        vm.prank(ALICE);
        allocations.contribute(saleId, 100, commitment);
        vm.prank(ALICE);
        allocations.contribute(saleId, 100, commitment);

        require(allocations.contributed(saleId, ALICE) == 200, "opaque commitment may repeat");
    }

    function testSaleEconomicsRemainImmutableAcrossContribution() public {
        sales.activate(saleId);
        caps.setAllowed(true);
        vm.warp(10);
        vm.prank(ALICE);
        allocations.contribute(saleId, 100, keccak256("payment/economics"));

        LaunchpadSaleRegistry420.Sale memory s = sales.sale(saleId);
        require(s.softCap == 500, "soft cap immutable");
        require(s.hardCap == 1000, "hard cap immutable");
        require(s.perWalletCap == 600, "wallet cap immutable");
        require(s.tokenAllocation == 10000, "allocation immutable");
        require(s.startsAt == 10 && s.endsAt == 20 && s.claimStartsAt == 30, "schedule immutable");
        require(s.eligibilityPolicyHash == keccak256("audit/eligibility"), "eligibility immutable");
    }

    function testFinalizeRequiresStrictlyAfterEnd() public {
        sales.activate(saleId);
        caps.setAllowed(true);
        vm.warp(10);
        vm.prank(ALICE);
        allocations.contribute(saleId, 500, keccak256("payment/finalize"));

        vm.warp(20);
        vm.expectRevert(LaunchpadSaleRegistry420.InvalidState.selector);
        sales.finalize(saleId);

        vm.warp(21);
        sales.finalize(saleId);
        require(sales.sale(saleId).state == LaunchpadSaleRegistry420.State.SUCCEEDED, "finalized after end");
    }

    function testSoftCapBoundaryDeterminesSuccessAndFailure() public {
        sales.activate(saleId);
        caps.setAllowed(true);
        vm.warp(10);
        vm.prank(ALICE);
        allocations.contribute(saleId, 499, keccak256("payment/below-soft"));
        vm.warp(21);
        sales.finalize(saleId);
        require(sales.sale(saleId).state == LaunchpadSaleRegistry420.State.FAILED, "below soft cap fails");
    }

    function testClaimRequiresSuccessClaimStartAuthorizationAndNonzeroCommitment() public {
        sales.activate(saleId);
        caps.setAllowed(true);
        vm.warp(10);
        vm.prank(ALICE);
        allocations.contribute(saleId, 500, keccak256("payment/claim"));
        vm.warp(21);
        sales.finalize(saleId);

        vm.prank(ALICE);
        vm.expectRevert(LaunchpadAllocationRegistry420.NotClaimable.selector);
        allocations.claim(saleId, keccak256("delivery/early"));

        vm.warp(30);
        caps.setAllowed(false);
        vm.prank(ALICE);
        vm.expectRevert(LaunchpadAllocationRegistry420.NotClaimable.selector);
        allocations.claim(saleId, keccak256("delivery/denied"));

        caps.setAllowed(true);
        vm.prank(ALICE);
        vm.expectRevert(LaunchpadAllocationRegistry420.NotClaimable.selector);
        allocations.claim(saleId, bytes32(0));

        vm.prank(ALICE);
        allocations.claim(saleId, keccak256("delivery/final"));

        vm.prank(ALICE);
        vm.expectRevert(LaunchpadAllocationRegistry420.NotClaimable.selector);
        allocations.claim(saleId, keccak256("delivery/duplicate"));
    }

    function testFailedSaleRefundRequiresAuthorizationAndNonzeroCommitment() public {
        sales.activate(saleId);
        caps.setAllowed(true);
        vm.warp(10);
        vm.prank(ALICE);
        allocations.contribute(saleId, 400, keccak256("payment/refund"));
        vm.warp(21);
        sales.finalize(saleId);

        caps.setAllowed(false);
        vm.prank(ALICE);
        vm.expectRevert(LaunchpadAllocationRegistry420.NotRefundable.selector);
        allocations.recordRefund(saleId, keccak256("refund/denied"));

        caps.setAllowed(true);
        vm.prank(ALICE);
        vm.expectRevert(LaunchpadAllocationRegistry420.NotRefundable.selector);
        allocations.recordRefund(saleId, bytes32(0));

        vm.prank(ALICE);
        allocations.recordRefund(saleId, keccak256("refund/final"));

        vm.prank(ALICE);
        vm.expectRevert(LaunchpadAllocationRegistry420.NotRefundable.selector);
        allocations.recordRefund(saleId, keccak256("refund/duplicate"));
    }

    function testSuccessfulSaleIsNotRefundable() public {
        sales.activate(saleId);
        caps.setAllowed(true);
        vm.warp(10);
        vm.prank(ALICE);
        allocations.contribute(saleId, 500, keccak256("payment/success"));
        vm.warp(21);
        sales.finalize(saleId);
        vm.prank(ALICE);
        vm.expectRevert(LaunchpadAllocationRegistry420.NotRefundable.selector);
        allocations.recordRefund(saleId, keccak256("refund/not-allowed"));
    }

    function testCancellationIsTerminalAndRefundable() public {
        sales.activate(saleId);
        caps.setAllowed(true);
        vm.warp(10);
        vm.prank(ALICE);
        allocations.contribute(saleId, 100, keccak256("payment/cancel"));
        sales.cancel(saleId);

        vm.expectRevert(LaunchpadSaleRegistry420.InvalidState.selector);
        sales.cancel(saleId);

        vm.prank(ALICE);
        allocations.recordRefund(saleId, keccak256("refund/cancelled"));
        require(allocations.refunded(saleId, ALICE), "cancelled sale refundable");
    }

    function testFuzzCapsAndAllocationConservation(
        uint128 aRaw,
        uint128 bRaw
    ) public {
        uint128 a = uint128(250 + (uint256(aRaw) % 251));
        uint128 b = uint128(250 + (uint256(bRaw) % 251));

        sales.activate(saleId);
        caps.setAllowed(true);
        vm.warp(10);

        vm.prank(ALICE);
        allocations.contribute(saleId, a, keccak256(abi.encode("payment/fuzz/alice", aRaw)));
        vm.prank(BOB);
        allocations.contribute(saleId, b, keccak256(abi.encode("payment/fuzz/bob", bRaw)));

        LaunchpadSaleRegistry420.Sale memory beforeFinalize = sales.sale(saleId);
        require(beforeFinalize.raised == a + b, "raised conservation");
        require(beforeFinalize.raised <= beforeFinalize.hardCap, "hard cap property");
        require(a <= beforeFinalize.perWalletCap && b <= beforeFinalize.perWalletCap, "wallet cap property");

        vm.warp(21);
        sales.finalize(saleId);
        require(sales.sale(saleId).state == LaunchpadSaleRegistry420.State.SUCCEEDED, "fuzz sale success");

        vm.warp(30);
        vm.prank(ALICE);
        allocations.claim(saleId, keccak256(abi.encode("delivery/fuzz/alice", aRaw)));
        vm.prank(BOB);
        allocations.claim(saleId, keccak256(abi.encode("delivery/fuzz/bob", bRaw)));

        uint256 totalClaimed = uint256(allocations.claimed(saleId, ALICE)) + allocations.claimed(saleId, BOB);
        require(totalClaimed <= 10000, "allocation conservation");
        require(10000 - totalClaimed <= 1, "floor rounding dust bounded");
    }
}

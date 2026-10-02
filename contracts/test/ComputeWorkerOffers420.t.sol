// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeOfferRegistry420.sol";
import "../src/system/CapabilityRegistry420.sol";

interface VmWorkerOffers420 {
    function prank(address caller) external;
    function warp(uint256 timestamp) external;
}

contract ComputeWorkerOffers420Test {
    VmWorkerOffers420 private constant vm =
        VmWorkerOffers420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant GOV = address(0x420);
    address private constant OPERATOR = address(0xC0FFEE);
    address private constant DELEGATE = address(0xD311);
    address private constant OUTSIDER = address(0xBAD);
    address private constant BENEFICIARY = address(0xFEE1);

    bytes32 private constant MANIFEST = keccak256("cmp-2.1/manifest");
    bytes32 private constant SECURITY = keccak256("cmp-2.1/security");
    bytes32 private constant HARDWARE = keccak256("cmp-2.1/hardware");
    bytes32 private constant RUNTIME = keccak256("cmp-2.1/runtime");
    bytes32 private constant CAPABILITY = keccak256("cmp-2.1/capability");
    bytes32 private constant JURISDICTION = keccak256("CA-SK");
    bytes32 private constant JURISDICTION_V2 = keccak256("CA-AB");
    bytes32 private constant PRICING = keccak256("cmp/fixed/native-420/v1");

    CapabilityRegistry420 private caps;
    ComputeAuthorization420 private auth;
    ComputeProviderRegistry420 private providers;
    ComputeNodeRegistry420 private nodes;
    ComputeResourceRegistry420 private resources;
    ComputeOfferRegistry420 private offers;

    bytes32 private providerId;
    bytes32 private nodeId;
    bytes32 private resourceId;
    uint256 private grantNonce;

    function setUp() public {
        caps = new CapabilityRegistry420();
        auth = new ComputeAuthorization420(address(caps));
        caps.registerProtocolComponent(auth.COMPONENT_COMPUTE(), address(this));

        providers = new ComputeProviderRegistry420(GOV);
        nodes = new ComputeNodeRegistry420(address(providers), GOV);
        resources = new ComputeResourceRegistry420(address(nodes), GOV);
        offers = new ComputeOfferRegistry420(address(resources), address(auth));

        vm.prank(OPERATOR);
        providerId = providers.register(MANIFEST, SECURITY, BENEFICIARY);
        vm.prank(GOV);
        providers.activate(providerId);

        vm.prank(OPERATOR);
        nodeId = nodes.register(
            providerId,
            MANIFEST,
            keccak256("cmp-2.1/endpoint"),
            uint64(block.timestamp + 30 days)
        );
        vm.prank(OPERATOR);
        nodes.activate(nodeId);

        bytes32 cls = resources.GPU_INFERENCE();
        vm.prank(OPERATOR);
        resourceId = resources.register(
            nodeId,
            cls,
            HARDWARE,
            RUNTIME,
            CAPABILITY,
            16
        );
        vm.prank(OPERATOR);
        resources.activate(resourceId);
    }

    function testWorkerOfferAdvertisesCanonicalResourceAvailabilityJurisdictionAndPrice() public {
        uint64 from = uint64(block.timestamp + 1 hours);
        uint64 until = uint64(block.timestamp + 12 hours);

        vm.prank(OPERATOR);
        bytes32 offerId = offers.publishWorkerOffer(
            resourceId,
            JURISDICTION,
            from,
            until,
            PRICING,
            1,
            3 ether
        );

        ComputeOfferRegistry420.Offer memory o = offers.offer(offerId);
        require(o.providerId == providerId && o.nodeId == nodeId && o.resourceId == resourceId,
            "identity snapshot");
        require(o.computeClass == resources.GPU_INFERENCE(), "compute class");
        require(o.hardwareProfileHash == HARDWARE && o.runtimeProfileHash == RUNTIME
            && o.capabilityHash == CAPABILITY && o.capacityUnits == 16, "resource profile snapshot");
        require(o.jurisdictionHash == JURISDICTION
            && o.availableFrom == from && o.validUntil == until, "availability/jurisdiction");
        require(o.pricingPolicyId == PRICING && o.pricingVersion == 1
            && o.fixedPrice == 3 ether, "price");
        require(o.revision == 1 && o.predecessorCommitment == bytes32(0)
            && o.exists && o.active, "initial revision");

        require(!offers.isEffective(offerId), "offer effective before availability");
        vm.warp(from);
        require(offers.isEffective(offerId), "offer not effective at availability");
        vm.warp(until + 1);
        require(!offers.isEffective(offerId), "expired offer effective");
    }

    function testResourceDriftInvalidatesUntilAuthorizedOfferRevisionRefreshesSnapshot() public {
        vm.prank(OPERATOR);
        bytes32 offerId = offers.publishWorkerOffer(
            resourceId,
            JURISDICTION,
            uint64(block.timestamp),
            uint64(block.timestamp + 12 hours),
            PRICING,
            1,
            3 ether
        );
        bytes32 firstCommitment = offers.commitment(offerId, 1);

        vm.prank(OPERATOR);
        resources.update(
            resourceId,
            keccak256("cmp-2.1/hardware-v2"),
            keccak256("cmp-2.1/runtime-v2"),
            keccak256("cmp-2.1/capability-v2"),
            24
        );
        vm.prank(OPERATOR);
        resources.activate(resourceId);
        require(!offers.isEffective(offerId), "stale resource snapshot remained effective");

        vm.prank(OPERATOR);
        offers.updateOffer(
            offerId,
            JURISDICTION_V2,
            uint64(block.timestamp),
            uint64(block.timestamp + 2 days),
            PRICING,
            2,
            4 ether
        );

        ComputeOfferRegistry420.Offer memory v1 = offers.revision(offerId, 1);
        ComputeOfferRegistry420.Offer memory v2 = offers.revision(offerId, 2);
        require(v1.hardwareProfileHash == HARDWARE && v1.capacityUnits == 16
            && v1.fixedPrice == 3 ether && v1.jurisdictionHash == JURISDICTION,
            "history rewritten");
        require(v2.hardwareProfileHash == keccak256("cmp-2.1/hardware-v2")
            && v2.runtimeProfileHash == keccak256("cmp-2.1/runtime-v2")
            && v2.capabilityHash == keccak256("cmp-2.1/capability-v2")
            && v2.capacityUnits == 24, "revised resource snapshot");
        require(v2.fixedPrice == 4 ether && v2.pricingVersion == 2
            && v2.jurisdictionHash == JURISDICTION_V2, "revised market terms");
        require(v2.predecessorCommitment == firstCommitment && offers.isEffective(offerId),
            "revision chain/effectiveness");
    }

    function testScopedDelegateCanPublishUpdateAndCancelButWrongScopeAndOutsiderFail() public {
        _grant(DELEGATE, auth.ACTION_PUBLISH_OFFER(), resourceId, 3 ether);

        vm.prank(DELEGATE);
        bytes32 offerId = offers.publishWorkerOffer(
            resourceId,
            JURISDICTION,
            uint64(block.timestamp),
            uint64(block.timestamp + 12 hours),
            PRICING,
            1,
            3 ether
        );

        vm.prank(OUTSIDER);
        (bool ok,) = address(offers).call(
            abi.encodeCall(
                offers.updateOffer,
                (
                    offerId,
                    JURISDICTION,
                    uint64(block.timestamp),
                    uint64(block.timestamp + 1 days),
                    PRICING,
                    uint32(2),
                    4 ether
                )
            )
        );
        require(!ok, "outsider updated offer");

        _grant(DELEGATE, auth.ACTION_UPDATE_OFFER(), resourceId, 4 ether);
        vm.prank(DELEGATE);
        offers.updateOffer(
            offerId,
            JURISDICTION,
            uint64(block.timestamp),
            uint64(block.timestamp + 1 days),
            PRICING,
            2,
            4 ether
        );

        _grant(DELEGATE, auth.ACTION_CANCEL_OFFER(), resourceId, 0);
        vm.prank(DELEGATE);
        offers.cancel(offerId);

        ComputeOfferRegistry420.Offer memory current = offers.offer(offerId);
        ComputeOfferRegistry420.Offer memory beforeCancel = offers.revision(offerId, 2);
        ComputeOfferRegistry420.Offer memory cancelled = offers.revision(offerId, 3);
        require(beforeCancel.active, "historical active revision changed");
        require(!current.active && !cancelled.active && cancelled.revision == 3,
            "cancel terminal revision");
        require(cancelled.predecessorCommitment == offers.commitment(offerId, 2),
            "cancel predecessor");

        vm.prank(DELEGATE);
        (ok,) = address(offers).call(
            abi.encodeCall(
                offers.updateOffer,
                (
                    offerId,
                    JURISDICTION,
                    uint64(block.timestamp),
                    uint64(block.timestamp + 1 days),
                    PRICING,
                    uint32(3),
                    5 ether
                )
            )
        );
        require(!ok, "cancelled offer resurrected");
    }

    function testWrongResourceScopeAndPriceLimitFailClosed() public {
        _grant(DELEGATE, auth.ACTION_PUBLISH_OFFER(), keccak256("wrong-resource"), 3 ether);
        vm.prank(DELEGATE);
        (bool ok,) = address(offers).call(
            abi.encodeCall(
                offers.publishWorkerOffer,
                (
                    resourceId,
                    JURISDICTION,
                    uint64(block.timestamp),
                    uint64(block.timestamp + 1 days),
                    PRICING,
                    uint32(1),
                    3 ether
                )
            )
        );
        require(!ok && offers.nextSerial() == 0, "wrong scope published offer");

        _grant(DELEGATE, auth.ACTION_PUBLISH_OFFER(), resourceId, 2 ether);
        vm.prank(DELEGATE);
        (ok,) = address(offers).call(
            abi.encodeCall(
                offers.publishWorkerOffer,
                (
                    resourceId,
                    JURISDICTION,
                    uint64(block.timestamp),
                    uint64(block.timestamp + 1 days),
                    PRICING,
                    uint32(1),
                    3 ether
                )
            )
        );
        require(!ok && offers.nextSerial() == 0, "price limit bypassed");
    }

    function testInvalidWindowJurisdictionAndResourceRevisionFailClosed() public {
        vm.prank(OPERATOR);
        (bool ok,) = address(offers).call(
            abi.encodeCall(
                offers.publishWorkerOffer,
                (
                    resourceId,
                    bytes32(0),
                    uint64(block.timestamp),
                    uint64(block.timestamp + 1 days),
                    PRICING,
                    uint32(1),
                    3 ether
                )
            )
        );
        require(!ok, "zero jurisdiction accepted");

        vm.prank(OPERATOR);
        (ok,) = address(offers).call(
            abi.encodeCall(
                offers.publishWorkerOffer,
                (
                    resourceId,
                    JURISDICTION,
                    uint64(block.timestamp + 2 days),
                    uint64(block.timestamp + 1 days),
                    PRICING,
                    uint32(1),
                    3 ether
                )
            )
        );
        require(!ok, "inverted availability accepted");

        vm.prank(OPERATOR);
        bytes32 offerId = offers.publishWorkerOffer(
            resourceId,
            JURISDICTION,
            uint64(block.timestamp),
            uint64(block.timestamp + 1 days),
            PRICING,
            1,
            3 ether
        );
        vm.prank(OPERATOR);
        resources.update(
            resourceId,
            keccak256("drifted-hardware"),
            RUNTIME,
            CAPABILITY,
            16
        );
        require(!offers.isEffective(offerId), "drifted resource remained effective");
    }

    function testLegacyFixedPricePublishRemainsDirectOperatorCompatible() public {
        vm.prank(OPERATOR);
        bytes32 offerId = offers.publish(
            resourceId,
            PRICING,
            1,
            3 ether,
            uint64(block.timestamp + 12 hours)
        );
        ComputeOfferRegistry420.Offer memory o = offers.offer(offerId);
        require(o.jurisdictionHash == offers.LEGACY_JURISDICTION()
            && o.fixedPrice == 3 ether && offers.isEffective(offerId),
            "legacy accepted-price offer compatibility");
    }

    function _grant(address principal, bytes32 action, bytes32 scopedResource, uint256 limit) private {
        bytes32 scope;
        if (scopedResource == resourceId) {
            scope = auth.scopeResource(providerId, nodeId, resourceId);
        } else {
            scope = keccak256(abi.encode("cmp-2.1/wrong-scope", scopedResource));
        }
        caps.createGrant(
            keccak256(abi.encode("cmp-2.1/grant", principal, action, scopedResource, grantNonce++)),
            principal,
            auth.COMPONENT_COMPUTE(),
            action,
            scope,
            limit,
            0,
            0,
            0,
            0
        );
    }
}

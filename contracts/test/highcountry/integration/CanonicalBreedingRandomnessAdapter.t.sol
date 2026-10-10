// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { IRandomnessRouter420 } from "../../../src/interfaces/IRandomnessRouter420.sol";
import {
    CanonicalBreedingRandomnessAdapter
} from "../../../src/highcountry/random/CanonicalBreedingRandomnessAdapter.sol";
import { RandomDomains } from "../../../src/highcountry/constants/RandomDomains.sol";
import { ModuleIds } from "../../../src/highcountry/constants/ModuleIds.sol";
import { ActionIds } from "../../../src/highcountry/constants/ActionIds.sol";
import { HighCountryAuthorization } from "../../../src/highcountry/auth/HighCountryAuthorization.sol";
import { MockCapabilityRegistry } from "../mocks/MockCapabilityRegistry.sol";
import { ICapabilityRegistry420 } from "../../../src/interfaces/genesis/ICapabilityRegistry420.sol";

contract MockBoundRandomRouter is IRandomnessRouter420 {
    Request internal bound;
    bytes32 internal root;
    bytes32 internal proof;
    bytes32 internal identifier;

    function requestRandomness(
        bytes32 profile,
        bytes32 domain,
        bytes32 purpose,
        uint64 deadline
    ) external override returns (bytes32 requestId) {
        identifier = keccak256(abi.encode(msg.sender, profile, domain, purpose, deadline));
        bound.requester = msg.sender;
        bound.profileId = profile;
        bound.domain = domain;
        bound.purpose = purpose;
        bound.deadline = deadline;
        bound.status = Status.REQUESTED;
        return identifier;
    }

    function setResult(
        Status state,
        bytes32 randomness,
        bytes32 proofHash
    ) external {
        bound.status = state;
        root = randomness;
        proof = proofHash;
    }

    function request(
        bytes32 id
    ) external view override returns (Request memory) {
        require(id == identifier, "wrong id");
        return bound;
    }

    function status(
        bytes32 id
    ) external view override returns (Status) {
        require(id == identifier, "wrong id");
        return bound.status;
    }

    function result(
        bytes32 id
    ) external view override returns (bytes32, bytes32) {
        require(id == identifier, "wrong id");
        return (root, proof);
    }

    function fulfillRandomness(
        bytes32,
        bytes32,
        bytes calldata
    ) external pure override {
        revert("fixture");
    }

    function activateFallback(
        bytes32
    ) external pure override {
        revert("fixture");
    }

    function voidExpired(
        bytes32
    ) external pure override {
        revert("fixture");
    }
}

contract MockBreedingAdapterCaller {
    CanonicalBreedingRandomnessAdapter public randomness;
    HighCountryAuthorization public authorization;

    constructor(
        CanonicalBreedingRandomnessAdapter adapter,
        HighCountryAuthorization auth
    ) {
        randomness = adapter;
        authorization = auth;
    }

    function request(
        bytes32 id,
        bytes32 domain,
        bytes32 context
    ) external {
        randomness.request(id, domain, context);
    }

    function cancel(
        bytes32 id
    ) external {
        randomness.cancel(id);
    }

    function consume(
        bytes32 id,
        bytes32 domain,
        bytes32 context
    ) external returns (bytes32) {
        return randomness.consume(id, domain, context);
    }
}

contract CanonicalBreedingRandomnessAdapterTest {
    MockCapabilityRegistry internal caps;
    HighCountryAuthorization internal auth;
    MockBoundRandomRouter internal router;
    CanonicalBreedingRandomnessAdapter internal adapter;
    MockBreedingAdapterCaller internal caller;
    bytes32 internal constant PROFILE = keccak256("hc:r0210:profile");
    bytes32 internal constant CONTEXT = keccak256("hc:r0210:context");
    bytes32 internal constant DOMAIN = keccak256("HC.RANDOM.BREEDING.V1");

    constructor() {
        caps = new MockCapabilityRegistry();
        auth = new HighCountryAuthorization(address(caps));
        router = new MockBoundRandomRouter();
        adapter = new CanonicalBreedingRandomnessAdapter(address(router), address(auth), PROFILE, 1 days);
        caller = new MockBreedingAdapterCaller(adapter, auth);
        bytes32 grantId = keccak256("hc:r0210:bind");
        caps.setGrant(
            grantId,
            ICapabilityRegistry420.CapabilityGrant({
                principal: address(this),
                componentId: ModuleIds.RANDOMNESS_COORDINATOR,
                capabilityId: ActionIds.RANDOMNESS_BIND_BREEDING,
                scopeHash: adapter.BIND_SCOPE(),
                perCallLimit: 0,
                periodLimit: 0,
                periodSeconds: 0,
                validFrom: 0,
                validUntil: uint64(block.timestamp + 2 days),
                revoked: false
            }),
            0
        );
        adapter.bindBreedingEngine(address(caller));
    }

    function _request() internal returns (bytes32 id) {
        id = keccak256(abi.encode(DOMAIN, CONTEXT));
        caller.request(id, DOMAIN, CONTEXT);
    }

    function testUnverifiedStaleOrMalformedResultFailsClosed() public {
        bytes32 id = _request();
        (bool ok,) = address(caller).call(abi.encodeCall(caller.consume, (id, DOMAIN, CONTEXT)));
        require(!ok, "accepted pending request");
        router.setResult(IRandomnessRouter420.Status.VOIDED, bytes32(uint256(42)), bytes32(uint256(1)));
        (ok,) = address(caller).call(abi.encodeCall(caller.consume, (id, DOMAIN, CONTEXT)));
        require(!ok, "accepted void result");
        router.setResult(IRandomnessRouter420.Status.FULFILLED, bytes32(uint256(42)), bytes32(0));
        (ok,) = address(caller).call(abi.encodeCall(caller.consume, (id, DOMAIN, CONTEXT)));
        require(!ok, "accepted proofless result");
        router.setResult(IRandomnessRouter420.Status.FULFILLED, bytes32(uint256(42)), bytes32(uint256(1)));
        (ok,) = address(caller).call(abi.encodeCall(caller.consume, (id, DOMAIN, keccak256("wrong"))));
        require(!ok, "accepted mismatched context");
        require(caller.consume(id, DOMAIN, CONTEXT) == bytes32(uint256(42)), "verified root mismatch");
        (ok,) = address(caller).call(abi.encodeCall(caller.consume, (id, DOMAIN, CONTEXT)));
        require(!ok, "replayed consumed result");
    }

    function testCancelledAndUnauthorizedRequestsFailClosed() public {
        bytes32 id = _request();
        (bool ok,) = address(adapter).call(abi.encodeCall(adapter.cancel, (id)));
        require(!ok, "outsider cancelled");
        (ok,) = address(adapter).call(abi.encodeCall(adapter.request, (id, DOMAIN, CONTEXT)));
        require(!ok, "outsider requested");
        caller.cancel(id);
        router.setResult(IRandomnessRouter420.Status.FULFILLED, bytes32(uint256(7)), bytes32(uint256(2)));
        (ok,) = address(caller).call(abi.encodeCall(caller.consume, (id, DOMAIN, CONTEXT)));
        require(!ok, "cancelled result consumed");
        (ok,) = address(caller).call(abi.encodeCall(caller.request, (id, DOMAIN, CONTEXT)));
        require(!ok, "request reroll");
    }

    function testCannotRebindOrUseWrongDomain() public {
        (bool ok,) = address(adapter).call(abi.encodeCall(adapter.bindBreedingEngine, (address(caller))));
        require(!ok, "rebound");
        bytes32 wrongDomain = keccak256("HC.RANDOM.UNAPPROVED");
        (ok,) = address(caller)
            .call(abi.encodeCall(caller.request, (keccak256(abi.encode(wrongDomain, CONTEXT)), wrongDomain, CONTEXT)));
        require(!ok, "accepted unrelated domain");
        (ok,) = address(caller).call(abi.encodeCall(caller.request, (bytes32(uint256(1)), DOMAIN, CONTEXT)));
        require(!ok, "accepted forged local request id");
    }
}

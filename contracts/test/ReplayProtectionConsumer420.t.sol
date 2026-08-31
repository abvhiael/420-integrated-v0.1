// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/system/ReplayProtectionConsumer420.sol";
import "../src/pay/ReplayDomainIds420.sol";
import "../src/pay/PaymentRouter420.sol";
import "../src/pay/adapters/CanonicalSettlementAdapter420.sol";
import "../src/swap/CanonicalSwapExecutor420.sol";
import "../src/libraries/AppDependencyIds420.sol";
import "./helpers/GenesisMocks420.sol";

interface VmReplay420 { function prank(address) external; }

contract ReplayConsumerCaller420 {
    function consume(ReplayProtectionConsumer420 replay, bytes32 objectId, bytes32 domain) external {
        replay.consume(objectId, domain);
    }
}

contract ReplayProtectionConsumer420Test {
    VmReplay420 internal constant vm = VmReplay420(address(uint160(uint256(keccak256("hevm cheat code")))));

    function testDomainBoundReplayRejectsGriefAndConsumesOnce() public {
        GenesisMockEnvironment420 env = new GenesisMockEnvironment420();
        ReplayProtectionConsumer420 replay = new ReplayProtectionConsumer420(address(this), address(env.registry()), keccak256("replay"));
        env.registerResident(address(replay), replay.componentId());

        ReplayConsumerCaller420 allowed = new ReplayConsumerCaller420();
        ReplayConsumerCaller420 attacker = new ReplayConsumerCaller420();
        bytes32 domain = keccak256("domain");
        bytes32 objectId = keccak256("object");
        replay.setDomainConsumer(domain, address(allowed));

        (bool griefOk,) = address(attacker).call(abi.encodeWithSelector(attacker.consume.selector, replay, objectId, domain));
        require(!griefOk, "unbound consumer griefed replay id");
        require(!replay.isConsumed(objectId), "failed grief consumed object");

        allowed.consume(replay, objectId, domain);
        require(replay.isConsumed(objectId), "object not consumed");
        require(replay.objectDomain(objectId) == domain, "domain not recorded");
        require(replay.nonce(address(allowed), domain) == 1, "consumer nonce not advanced");

        (bool duplicateOk,) = address(allowed).call(abi.encodeWithSelector(allowed.consume.selector, replay, objectId, domain));
        require(!duplicateOk, "duplicate replay consumption accepted");
    }

    function testGenesisPaySwapWiringInvariant() public {
        GenesisMockEnvironment420 env = new GenesisMockEnvironment420();
        bytes32 cfg = keccak256("pay-wiring");

        CanonicalSwapExecutor420 executor = new CanonicalSwapExecutor420(address(this), address(env.registry()), cfg);
        env.registerResident(address(executor), executor.componentId());

        CanonicalSettlementAdapter420 adapter = new CanonicalSettlementAdapter420(address(this), address(env.registry()), cfg, address(executor));
        env.registerResident(address(adapter), adapter.componentId());

        PaymentRouter420 router = new PaymentRouter420(address(this), address(env.registry()), cfg);
        env.registerResident(address(router), router.componentId());

        ReplayProtectionConsumer420 replay = new ReplayProtectionConsumer420(address(this), address(env.registry()), cfg);
        env.registerResident(address(replay), replay.componentId());
        env.registry().set(AppDependencyIds420.REPLAY_PROTECTION, address(replay));

        router.setSettlementAdapter(address(adapter));
        executor.setTrustedCaller(address(adapter), true);
        replay.setDomainConsumer(ReplayDomainIds420.PAY_SETTLEMENT, address(router));

        require(router.settlementAdapter() == address(adapter), "router adapter wiring");
        require(adapter.swapExecutor() == address(executor), "adapter executor wiring");
        require(executor.trustedCaller(address(adapter)), "executor trust wiring");
        require(replay.domainConsumer(ReplayDomainIds420.PAY_SETTLEMENT) == address(router), "replay consumer wiring");
    }
}

// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeExternalDoubleRewardGuard420.sol";

contract ExternalRewardConsumerHarness420 {
    function setConsumer(
        ComputeExternalDoubleRewardGuard420 guard,
        address target,
        bool active
    ) external {
        guard.setConsumer(target, active);
    }

    function consume(
        ComputeExternalDoubleRewardGuard420 guard,
        ComputeExternalProofCreditAdapter420.ExternalSource calldata source,
        bytes32 canonicalWorkCommitment,
        bytes32 rewardRef,
        bytes32 evidenceCommitment
    ) external returns (bytes32) {
        return guard.consume(source, canonicalWorkCommitment, rewardRef, evidenceCommitment);
    }
}

contract ComputeExternalDoubleRewardGuard420Test {
    ComputeExternalProofCreditAdapter420 private adapter;
    ComputeExternalDoubleRewardGuard420 private guard;
    ExternalRewardConsumerHarness420 private consumer;
    ExternalRewardConsumerHarness420 private otherConsumer;

    function setUp() public {
        adapter = new ComputeExternalProofCreditAdapter420();
        guard = new ComputeExternalDoubleRewardGuard420(address(this), address(adapter));
        consumer = new ExternalRewardConsumerHarness420();
        otherConsumer = new ExternalRewardConsumerHarness420();
        guard.setConsumer(address(consumer), true);
    }

    function _source(bytes32 salt)
        private pure
        returns (ComputeExternalProofCreditAdapter420.ExternalSource memory s)
    {
        s = ComputeExternalProofCreditAdapter420.ExternalSource({
            adapterKind: keccak256(abi.encode("adapter", salt)),
            externalSystemId: keccak256(abi.encode("system", salt)),
            contributionId: keccak256(abi.encode("contribution", salt))
        });
    }

    function testAuthorizedConsumerConsumesCanonicalWorkExactlyOnce() public {
        ComputeExternalProofCreditAdapter420.ExternalSource memory source = _source("a");
        bytes32 work = keccak256("canonical-work");
        bytes32 rewardRef = keccak256("reward-ref");
        bytes32 evidence = keccak256("evidence");

        bytes32 claimKey =
            consumer.consume(guard, source, work, rewardRef, evidence);

        require(claimKey == guard.claimKeyFor(work), "claim key drift");
        require(guard.consumed(work), "work not consumed");

        ComputeExternalDoubleRewardGuard420.ClaimRecord memory record =
            guard.claimRecord(claimKey);
        require(record.canonicalWorkCommitment == work, "work mismatch");
        require(record.sourceBinding == adapter.sourceBinding(source), "source mismatch");
        require(record.rewardRef == rewardRef, "reward ref mismatch");
        require(record.evidenceCommitment == evidence, "evidence mismatch");
        require(record.consumer == address(consumer), "consumer mismatch");
        require(record.exists, "claim missing");
    }

    function testAlternateProofCreditEvidenceCannotRewardSameWorkTwice() public {
        ComputeExternalProofCreditAdapter420.ExternalSource memory source = _source("a");
        bytes32 work = keccak256("same-work");

        consumer.consume(
            guard,
            source,
            work,
            keccak256("proof-reward"),
            keccak256("proof-evidence")
        );

        (bool ok,) = address(consumer).call(
            abi.encodeCall(
                consumer.consume,
                (
                    guard,
                    source,
                    work,
                    keccak256("credit-reward"),
                    keccak256("credit-evidence")
                )
            )
        );
        require(!ok, "alternate evidence double rewarded");
    }

    function testCrossSourceWrapperCannotRewardSameCanonicalWorkTwice() public {
        bytes32 work = keccak256("same-canonical-work");
        consumer.consume(
            guard,
            _source("adapter-a"),
            work,
            keccak256("reward-a"),
            keccak256("evidence-a")
        );

        (bool ok,) = address(consumer).call(
            abi.encodeCall(
                consumer.consume,
                (
                    guard,
                    _source("adapter-b"),
                    work,
                    keccak256("reward-b"),
                    keccak256("evidence-b")
                )
            )
        );
        require(!ok, "cross-source duplicate accepted");
    }

    function testDistinctCanonicalWorkCanBeConsumedIndependently() public {
        ComputeExternalProofCreditAdapter420.ExternalSource memory source = _source("a");
        bytes32 first = consumer.consume(
            guard,
            source,
            keccak256("work-1"),
            keccak256("reward-1"),
            keccak256("evidence-1")
        );
        bytes32 second = consumer.consume(
            guard,
            source,
            keccak256("work-2"),
            keccak256("reward-2"),
            keccak256("evidence-2")
        );

        require(first != second, "distinct work collapsed");
    }

    function testUnauthorizedCallerCannotBurnClaim() public {
        ComputeExternalProofCreditAdapter420.ExternalSource memory source = _source("a");
        bytes32 work = keccak256("protected-work");

        (bool ok,) = address(guard).call(
            abi.encodeCall(
                guard.consume,
                (
                    source,
                    work,
                    keccak256("reward"),
                    keccak256("evidence")
                )
            )
        );
        require(!ok, "unauthorized claim burn");

        require(
            consumer.consume(
                guard,
                source,
                work,
                keccak256("reward"),
                keccak256("evidence")
            ) == guard.claimKeyFor(work),
            "authorized consumer blocked after attack"
        );
    }

    function testConsumerAuthorizationAndRevocationFailClosed() public {
        ComputeExternalProofCreditAdapter420.ExternalSource memory source = _source("a");

        (bool beforeOk,) = address(otherConsumer).call(
            abi.encodeCall(
                otherConsumer.consume,
                (
                    guard,
                    source,
                    keccak256("work-before"),
                    keccak256("reward-before"),
                    keccak256("evidence-before")
                )
            )
        );
        require(!beforeOk, "unauthorized consumer accepted");

        guard.setConsumer(address(otherConsumer), true);
        otherConsumer.consume(
            guard,
            source,
            keccak256("work-authorized"),
            keccak256("reward-authorized"),
            keccak256("evidence-authorized")
        );

        guard.setConsumer(address(otherConsumer), false);
        (bool afterOk,) = address(otherConsumer).call(
            abi.encodeCall(
                otherConsumer.consume,
                (
                    guard,
                    source,
                    keccak256("work-after"),
                    keccak256("reward-after"),
                    keccak256("evidence-after")
                )
            )
        );
        require(!afterOk, "revoked consumer accepted");
    }

    function testClaimKeyIsIndependentOfSourceAndRewardEvidence() public {
        bytes32 work = keccak256("canonical-work");
        bytes32 expected = guard.claimKeyFor(work);

        consumer.consume(
            guard,
            _source("a"),
            work,
            keccak256("reward-a"),
            keccak256("evidence-a")
        );

        require(expected == guard.claimKeyFor(work), "claim key changed");
    }

    function testZeroAndInvalidBindingsFailClosed() public {
        ComputeExternalProofCreditAdapter420.ExternalSource memory source = _source("a");

        (bool zeroWork,) = address(consumer).call(
            abi.encodeCall(
                consumer.consume,
                (
                    guard,
                    source,
                    bytes32(0),
                    keccak256("reward"),
                    keccak256("evidence")
                )
            )
        );
        require(!zeroWork, "zero work accepted");

        (bool zeroReward,) = address(consumer).call(
            abi.encodeCall(
                consumer.consume,
                (
                    guard,
                    source,
                    keccak256("work-r"),
                    bytes32(0),
                    keccak256("evidence")
                )
            )
        );
        require(!zeroReward, "zero reward ref accepted");

        (bool zeroEvidence,) = address(consumer).call(
            abi.encodeCall(
                consumer.consume,
                (
                    guard,
                    source,
                    keccak256("work-e"),
                    keccak256("reward"),
                    bytes32(0)
                )
            )
        );
        require(!zeroEvidence, "zero evidence accepted");

        source.contributionId = bytes32(0);
        (bool badSource,) = address(consumer).call(
            abi.encodeCall(
                consumer.consume,
                (
                    guard,
                    source,
                    keccak256("work-s"),
                    keccak256("reward"),
                    keccak256("evidence")
                )
            )
        );
        require(!badSource, "invalid source accepted");
    }

    function testOnlyGovernanceCanAuthorizeOrRevokeConsumers() public {
        (bool ok,) = address(otherConsumer).call(
            abi.encodeCall(
                otherConsumer.setConsumer,
                (guard, address(otherConsumer), true)
            )
        );
        require(!ok, "outsider authorized consumer");
        require(guard.consumerCodeHash(address(otherConsumer)) == bytes32(0), "authorization mutated");
    }

    function testCannotAuthorizeEOAOrZeroCodeConsumer() public {
        (bool ok,) = address(guard).call(
            abi.encodeCall(guard.setConsumer, (address(0xBEEF), true))
        );
        require(!ok, "EOA consumer authorized");
    }
}


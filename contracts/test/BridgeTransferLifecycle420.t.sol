// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bridge/BridgeTransferRegistry.sol";
import "./helpers/GenesisMocks420.sol";

contract BridgeLifecycleCaller420 {
    function markSourcePending(BridgeTransferRegistry registry, bytes32 id, bytes32 evidence) external {
        registry.markSourcePending(id, evidence);
    }
}

contract BridgeTransferLifecycle420Test {
    bytes32 private constant ROUTE = keccak256("route");
    bytes32 private constant ASSET = keccak256("asset");
    bytes32 private constant SOURCE_TX = keccak256("source-tx");
    bytes32 private constant SOURCE_MESSAGE = keccak256("source-message");
    address private constant SENDER = address(0xA11CE);
    address private constant RECIPIENT = address(0xB0B);

    GenesisMockEnvironment420 private env;
    BridgeTransferRegistry private registry;

    function setUp() public {
        env = new GenesisMockEnvironment420();
        registry = new BridgeTransferRegistry(address(this), address(env.registry()), keccak256("transfer-lifecycle"));
        env.registerResident(address(registry), registry.componentId());
        registry.setRouter(address(this), true);
    }

    function _evidence(string memory label) private pure returns (bytes32) {
        return keccak256(bytes(label));
    }

    function _createInbound() private returns (bytes32 id) {
        id = registry.create(ROUTE, ASSET, SENDER, RECIPIENT, 42 ether, SOURCE_TX, SOURCE_MESSAGE);
    }

    function _advanceTo(BridgeTransferRegistry.Status target) private returns (bytes32 id) {
        id = _createInbound();
        if (target == BridgeTransferRegistry.Status.CREATED) return id;

        registry.markSourcePending(id, _evidence("source-pending"));
        if (target == BridgeTransferRegistry.Status.SOURCE_PENDING) return id;

        registry.markSourceFinalized(id, _evidence("source-finalized"));
        if (target == BridgeTransferRegistry.Status.SOURCE_FINALIZED) return id;

        registry.markProofPending(id, _evidence("proof-pending"));
        if (target == BridgeTransferRegistry.Status.PROOF_PENDING) return id;

        registry.markVerified(id, _evidence("verified"));
        if (target == BridgeTransferRegistry.Status.VERIFIED) return id;

        registry.markDestinationPending(id, _evidence("destination-pending"));
        if (target == BridgeTransferRegistry.Status.DESTINATION_PENDING) return id;

        registry.markCompleted(id, _evidence("completed"));
        require(target == BridgeTransferRegistry.Status.COMPLETED, "unsupported target");
    }

    function _status(bytes32 id) private view returns (BridgeTransferRegistry.Status status) {
        (,,,,,,,status,,) = registry.transfers(id);
    }

    function testNormalLifecycleProgressesMonotonicallyToCompletion() public {
        bytes32 id = _createInbound();
        registry.markSourcePending(id, _evidence("p1"));
        registry.markSourceFinalized(id, _evidence("p2"));
        registry.markProofPending(id, _evidence("p3"));
        registry.markVerified(id, _evidence("p4"));
        registry.markDestinationPending(id, _evidence("p5"));
        registry.markCompleted(id, _evidence("p6"));
        require(_status(id) == BridgeTransferRegistry.Status.COMPLETED, "not completed");

        (bool ok,) = address(registry).call(
            abi.encodeWithSelector(registry.disputeTransfer.selector, id, _evidence("reopen"))
        );
        require(!ok, "completed reopened");
    }

    function testFailureRetryReturnsOnlyToRecordedStage() public {
        bytes32 id = _advanceTo(BridgeTransferRegistry.Status.PROOF_PENDING);
        registry.markFailed(id, _evidence("proof failure"));
        require(registry.retryTarget(id) == BridgeTransferRegistry.Status.PROOF_PENDING, "retry stage");
        registry.markRetryable(id, _evidence("retryable"));
        registry.retry(id, _evidence("retry"));
        require(_status(id) == BridgeTransferRegistry.Status.PROOF_PENDING, "wrong retry target");
        require(registry.retryTarget(id) == BridgeTransferRegistry.Status.NONE, "retry target not cleared");
    }

    function testSourceReorgReturnsRetryToSourcePending() public {
        bytes32 id = _advanceTo(BridgeTransferRegistry.Status.VERIFIED);
        registry.markSourceReorg(id, _evidence("source reorg"));
        require(_status(id) == BridgeTransferRegistry.Status.FAILED, "reorg not failed");
        require(registry.retryTarget(id) == BridgeTransferRegistry.Status.SOURCE_PENDING, "reorg retry target");
        registry.markRetryable(id, _evidence("reorg retryable"));
        registry.retry(id, _evidence("reorg retry"));
        require(_status(id) == BridgeTransferRegistry.Status.SOURCE_PENDING, "reorg retry stage");
    }

    function testPauseAndResumeRestoreExactPriorState() public {
        bytes32 id = _advanceTo(BridgeTransferRegistry.Status.VERIFIED);
        registry.pauseTransfer(id, _evidence("pause"));
        require(_status(id) == BridgeTransferRegistry.Status.PAUSED, "not paused");
        require(registry.pausedFrom(id) == BridgeTransferRegistry.Status.VERIFIED, "pause origin");
        registry.resumeTransfer(id, _evidence("resume"));
        require(_status(id) == BridgeTransferRegistry.Status.VERIFIED, "wrong resume state");
        require(registry.pausedFrom(id) == BridgeTransferRegistry.Status.NONE, "pause origin not cleared");
    }

    function testDisputeCanOnlyResolveToRefund() public {
        bytes32 id = _advanceTo(BridgeTransferRegistry.Status.VERIFIED);
        registry.disputeTransfer(id, _evidence("dispute"));
        require(_status(id) == BridgeTransferRegistry.Status.DISPUTED, "not disputed");

        (bool ok,) = address(registry).call(
            abi.encodeWithSelector(registry.markDestinationPending.selector, id, _evidence("skip dispute"))
        );
        require(!ok, "dispute bypassed");

        registry.refundTransfer(id, _evidence("refund"));
        require(_status(id) == BridgeTransferRegistry.Status.REFUNDED, "not refunded");

        (ok,) = address(registry).call(
            abi.encodeWithSelector(registry.resumeTransfer.selector, id, _evidence("reopen refund"))
        );
        require(!ok, "refund reopened");
    }

    function testExpiryCanResolveToRefundButCannotResume() public {
        bytes32 id = _advanceTo(BridgeTransferRegistry.Status.PROOF_PENDING);
        registry.expireTransfer(id, _evidence("expired"));
        require(_status(id) == BridgeTransferRegistry.Status.EXPIRED, "not expired");

        (bool ok,) = address(registry).call(
            abi.encodeWithSelector(registry.markVerified.selector, id, _evidence("expired verify"))
        );
        require(!ok, "expired resumed");

        registry.refundTransfer(id, _evidence("expired refund"));
        require(_status(id) == BridgeTransferRegistry.Status.REFUNDED, "expired not refunded");
    }

    function testZeroEvidenceFailsClosed() public {
        bytes32 id = _createInbound();
        (bool ok,) = address(registry).call(
            abi.encodeWithSelector(registry.markSourcePending.selector, id, bytes32(0))
        );
        require(!ok, "zero evidence accepted");
    }

    function testUnauthorizedLifecycleActorFailsClosed() public {
        bytes32 id = _createInbound();
        BridgeLifecycleCaller420 caller = new BridgeLifecycleCaller420();
        (bool ok,) = address(caller).call(
            abi.encodeWithSelector(caller.markSourcePending.selector, registry, id, _evidence("unauthorized"))
        );
        require(!ok, "unauthorized actor accepted");
    }

    function testOutboundIdentityIncludesRecipientAndIsReplaySafe() public {
        bytes32 recipientHash = keccak256(hex"010203");
        bytes32 messageId = keccak256("outbound-message");
        bytes32 id = registry.createOutbound(ROUTE, ASSET, address(this), recipientHash, 7 ether, messageId);

        require(registry.transferDirection(id) == BridgeTransferRegistry.Direction.OUTBOUND, "direction");
        require(registry.externalRecipientHash(id) == recipientHash, "recipient hash");
        require(_status(id) == BridgeTransferRegistry.Status.CREATED, "initial status");

        registry.markSourcePending(id, _evidence("outbound pending"));
        require(_status(id) == BridgeTransferRegistry.Status.SOURCE_PENDING, "pending status");

        (bool ok,) = address(registry).call(
            abi.encodeWithSelector(
                registry.createOutbound.selector,
                ROUTE,
                ASSET,
                address(this),
                recipientHash,
                7 ether,
                messageId
            )
        );
        require(!ok, "outbound replay accepted");
    }

    function testOutboundSourceTransactionMustBindBeforeFinality() public {
        bytes32 id = registry.createOutbound(
            ROUTE, ASSET, address(this), keccak256("recipient"), 9 ether, keccak256("message")
        );
        registry.markSourcePending(id, _evidence("outbound source pending"));

        (bool ok,) = address(registry).call(
            abi.encodeWithSelector(registry.markSourceFinalized.selector, id, _evidence("premature finality"))
        );
        require(!ok, "finalized without source tx");

        bytes32 sourceTx = keccak256("outbound-source-tx");
        registry.bindSourceTransaction(id, sourceTx, _evidence("source tx bind"));
        registry.markSourceFinalized(id, _evidence("outbound finalized"));
        (,,,,,bytes32 storedSourceTx,,,,) = registry.transfers(id);
        require(storedSourceTx == sourceTx, "source tx not bound");
    }

    function testBackwardAndSkippedNormalTransitionsFailClosed() public {
        bytes32 id = _advanceTo(BridgeTransferRegistry.Status.SOURCE_FINALIZED);

        (bool ok,) = address(registry).call(
            abi.encodeWithSelector(registry.markSourcePending.selector, id, _evidence("backward"))
        );
        require(!ok, "backward transition");

        (ok,) = address(registry).call(
            abi.encodeWithSelector(registry.markVerified.selector, id, _evidence("skip proof"))
        );
        require(!ok, "skipped transition");
    }

    function testAllowedTransitionMatrixMatchesFrozenGraph() public view {
        for (uint256 i = 0; i <= uint256(BridgeTransferRegistry.Status.REFUNDED); ++i) {
            for (uint256 j = 0; j <= uint256(BridgeTransferRegistry.Status.REFUNDED); ++j) {
                BridgeTransferRegistry.Status fromStatus = BridgeTransferRegistry.Status(i);
                BridgeTransferRegistry.Status toStatus = BridgeTransferRegistry.Status(j);
                require(
                    registry.isAllowedTransition(fromStatus, toStatus) == _expected(fromStatus, toStatus),
                    "transition graph mismatch"
                );
            }
        }
    }

    function _expected(BridgeTransferRegistry.Status fromStatus, BridgeTransferRegistry.Status toStatus)
        private
        pure
        returns (bool)
    {
        if (
            fromStatus == BridgeTransferRegistry.Status.NONE
                || fromStatus == BridgeTransferRegistry.Status.COMPLETED
                || fromStatus == BridgeTransferRegistry.Status.REFUNDED
                || fromStatus == toStatus
        ) return false;

        if (fromStatus == BridgeTransferRegistry.Status.CREATED) {
            return toStatus == BridgeTransferRegistry.Status.SOURCE_PENDING
                || toStatus == BridgeTransferRegistry.Status.PAUSED
                || toStatus == BridgeTransferRegistry.Status.DISPUTED
                || toStatus == BridgeTransferRegistry.Status.EXPIRED;
        }
        if (fromStatus == BridgeTransferRegistry.Status.SOURCE_PENDING) {
            return toStatus == BridgeTransferRegistry.Status.SOURCE_FINALIZED
                || toStatus == BridgeTransferRegistry.Status.FAILED
                || toStatus == BridgeTransferRegistry.Status.PAUSED
                || toStatus == BridgeTransferRegistry.Status.DISPUTED
                || toStatus == BridgeTransferRegistry.Status.EXPIRED;
        }
        if (fromStatus == BridgeTransferRegistry.Status.SOURCE_FINALIZED) {
            return toStatus == BridgeTransferRegistry.Status.PROOF_PENDING
                || toStatus == BridgeTransferRegistry.Status.FAILED
                || toStatus == BridgeTransferRegistry.Status.PAUSED
                || toStatus == BridgeTransferRegistry.Status.DISPUTED
                || toStatus == BridgeTransferRegistry.Status.EXPIRED;
        }
        if (fromStatus == BridgeTransferRegistry.Status.PROOF_PENDING) {
            return toStatus == BridgeTransferRegistry.Status.VERIFIED
                || toStatus == BridgeTransferRegistry.Status.FAILED
                || toStatus == BridgeTransferRegistry.Status.PAUSED
                || toStatus == BridgeTransferRegistry.Status.DISPUTED
                || toStatus == BridgeTransferRegistry.Status.EXPIRED;
        }
        if (fromStatus == BridgeTransferRegistry.Status.VERIFIED) {
            return toStatus == BridgeTransferRegistry.Status.DESTINATION_PENDING
                || toStatus == BridgeTransferRegistry.Status.FAILED
                || toStatus == BridgeTransferRegistry.Status.PAUSED
                || toStatus == BridgeTransferRegistry.Status.DISPUTED;
        }
        if (fromStatus == BridgeTransferRegistry.Status.DESTINATION_PENDING) {
            return toStatus == BridgeTransferRegistry.Status.COMPLETED
                || toStatus == BridgeTransferRegistry.Status.FAILED
                || toStatus == BridgeTransferRegistry.Status.PAUSED
                || toStatus == BridgeTransferRegistry.Status.DISPUTED;
        }
        if (fromStatus == BridgeTransferRegistry.Status.FAILED) {
            return toStatus == BridgeTransferRegistry.Status.RETRYABLE
                || toStatus == BridgeTransferRegistry.Status.DISPUTED
                || toStatus == BridgeTransferRegistry.Status.REFUNDED;
        }
        if (fromStatus == BridgeTransferRegistry.Status.RETRYABLE) {
            return _retryStage(toStatus)
                || toStatus == BridgeTransferRegistry.Status.PAUSED
                || toStatus == BridgeTransferRegistry.Status.DISPUTED
                || toStatus == BridgeTransferRegistry.Status.EXPIRED;
        }
        if (fromStatus == BridgeTransferRegistry.Status.PAUSED) {
            return _pausable(toStatus)
                || toStatus == BridgeTransferRegistry.Status.DISPUTED
                || toStatus == BridgeTransferRegistry.Status.EXPIRED;
        }
        if (fromStatus == BridgeTransferRegistry.Status.EXPIRED) {
            return toStatus == BridgeTransferRegistry.Status.DISPUTED
                || toStatus == BridgeTransferRegistry.Status.REFUNDED;
        }
        if (fromStatus == BridgeTransferRegistry.Status.DISPUTED) {
            return toStatus == BridgeTransferRegistry.Status.REFUNDED;
        }
        return false;
    }

    function _retryStage(BridgeTransferRegistry.Status status_) private pure returns (bool) {
        return status_ == BridgeTransferRegistry.Status.SOURCE_PENDING
            || status_ == BridgeTransferRegistry.Status.SOURCE_FINALIZED
            || status_ == BridgeTransferRegistry.Status.PROOF_PENDING
            || status_ == BridgeTransferRegistry.Status.VERIFIED
            || status_ == BridgeTransferRegistry.Status.DESTINATION_PENDING;
    }

    function _pausable(BridgeTransferRegistry.Status status_) private pure returns (bool) {
        return status_ == BridgeTransferRegistry.Status.CREATED
            || _retryStage(status_)
            || status_ == BridgeTransferRegistry.Status.RETRYABLE;
    }
}

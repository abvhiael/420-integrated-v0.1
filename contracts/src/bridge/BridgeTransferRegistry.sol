// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../libraries/AppDependencyIds420.sol";

import "../system/GenesisResidentAccess420.sol";
import "../interfaces/genesis/Types420.sol";
import "../interfaces/genesis/ISystemSafety420.sol";
import "../interfaces/genesis/IReplayProtection420.sol";
import "../interfaces/genesis/Errors420.sol";
import "./BridgeIds420.sol";

contract BridgeTransferRegistry is GenesisResidentAccess420 {
    enum Status {
        NONE, CREATED, SOURCE_PENDING, SOURCE_FINALIZED, PROOF_PENDING, VERIFIED,
        DESTINATION_PENDING, COMPLETED, FAILED, RETRYABLE, EXPIRED, PAUSED, DISPUTED, REFUNDED
    }

    enum Direction { NONE, INBOUND, OUTBOUND }

    struct Transfer {
        bytes32 routeId;
        bytes32 assetId;
        address sender;
        address recipient;
        uint256 amount;
        bytes32 sourceTxId;
        bytes32 sourceMessageId;
        Status status;
        uint64 createdAt;
        uint64 updatedAt;
    }

    mapping(bytes32 => Transfer) public transfers;
    mapping(bytes32 => bool) public consumedTransferId;
    mapping(bytes32 => Direction) public transferDirection;
    mapping(bytes32 => bytes32) public externalRecipientHash;
    mapping(bytes32 => bytes32) public lastEvidenceHash;
    mapping(bytes32 => Status) public retryTarget;
    mapping(bytes32 => Status) public pausedFrom;
    mapping(address => bool) public trustedRouter;
    mapping(address => bool) public trustedOperator;

    event RouterSet(address indexed router, bool trusted);
    event OperatorSet(address indexed operator, bool trusted);
    event TransferCreated(bytes32 indexed transferId, bytes32 indexed routeId, bytes32 indexed assetId, uint256 amount);
    event OutboundTransferCreated(
        bytes32 indexed transferId,
        bytes32 indexed routeId,
        bytes32 indexed assetId,
        address sender,
        bytes32 recipientHash,
        bytes32 sourceMessageId,
        uint256 amount
    );
    event SourceTransactionBound(bytes32 indexed transferId, bytes32 indexed sourceTxId, bytes32 evidenceHash);
    event TransferStatus(bytes32 indexed transferId, Status status);
    event TransferTransition(
        bytes32 indexed transferId,
        Status indexed fromStatus,
        Status indexed toStatus,
        bytes32 evidenceHash,
        address actor
    );

    constructor(address timelock_, address registry_, bytes32 genesisConfigHash_)
        GenesisResidentAccess420(timelock_, registry_, genesisConfigHash_)
    {}

    function componentId() public pure override returns (bytes32) { return BridgeIds420.TRANSFER_REGISTRY; }

    function setRouter(address router, bool trusted) external {
        _requireGenesisGovernance(BridgeIds420.ACTION_CONFIGURE);
        require(router != address(0) && router.code.length != 0, "router");
        trustedRouter[router] = trusted;
        emit RouterSet(router, trusted);
    }

    function setOperator(address operator, bool trusted) external {
        _requireGenesisGovernance(BridgeIds420.ACTION_CONFIGURE);
        require(operator != address(0) && operator.code.length != 0, "operator");
        trustedOperator[operator] = trusted;
        emit OperatorSet(operator, trusted);
    }

    function deriveTransferId(
        bytes32 routeId,
        bytes32 assetId,
        address sender,
        address recipient,
        uint256 amount,
        bytes32 sourceTxId,
        bytes32 sourceMessageId
    ) public pure returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256("420/BRIDGE_TRANSFER"), routeId, assetId, sender, recipient, amount, sourceTxId, sourceMessageId
            )
        );
    }

    function deriveOutboundTransferId(
        bytes32 routeId,
        bytes32 assetId,
        address sender,
        bytes32 recipientHash,
        uint256 amount,
        bytes32 sourceMessageId
    ) public pure returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256("420/BRIDGE_TRANSFER_OUTBOUND"),
                routeId,
                assetId,
                sender,
                recipientHash,
                amount,
                sourceMessageId
            )
        );
    }

    function create(
        bytes32 routeId,
        bytes32 assetId,
        address sender,
        address recipient,
        uint256 amount,
        bytes32 sourceTxId,
        bytes32 sourceMessageId
    ) external returns (bytes32 id) {
        require(trustedRouter[msg.sender], "router");
        _requireOperational(
            BridgeIds420.ACTION_INBOUND,
            ISystemSafety420.ActionClass.NORMAL_ONLY,
            Types420.Direction.INBOUND
        );
        require(
            routeId != bytes32(0) && assetId != bytes32(0) && sender != address(0) && recipient != address(0)
                && amount > 0 && sourceTxId != bytes32(0) && sourceMessageId != bytes32(0),
            "transfer"
        );
        id = deriveTransferId(routeId, assetId, sender, recipient, amount, sourceTxId, sourceMessageId);
        _consumeIdentity(id);
        transfers[id] = Transfer(
            routeId, assetId, sender, recipient, amount, sourceTxId, sourceMessageId,
            Status.CREATED, uint64(block.timestamp), uint64(block.timestamp)
        );
        transferDirection[id] = Direction.INBOUND;
        externalRecipientHash[id] = bytes32(uint256(uint160(recipient)));
        emit TransferCreated(id, routeId, assetId, amount);
    }

    function createOutbound(
        bytes32 routeId,
        bytes32 assetId,
        address sender,
        bytes32 recipientHash,
        uint256 amount,
        bytes32 sourceMessageId
    ) external returns (bytes32 id) {
        require(trustedRouter[msg.sender], "router");
        _requireOperational(
            BridgeIds420.ACTION_OUTBOUND,
            ISystemSafety420.ActionClass.NORMAL_ONLY,
            Types420.Direction.OUTBOUND
        );
        require(
            routeId != bytes32(0) && assetId != bytes32(0) && sender != address(0)
                && recipientHash != bytes32(0) && amount > 0 && sourceMessageId != bytes32(0),
            "transfer"
        );
        id = deriveOutboundTransferId(routeId, assetId, sender, recipientHash, amount, sourceMessageId);
        _consumeIdentity(id);
        transfers[id] = Transfer(
            routeId, assetId, sender, address(0), amount, bytes32(0), sourceMessageId,
            Status.CREATED, uint64(block.timestamp), uint64(block.timestamp)
        );
        transferDirection[id] = Direction.OUTBOUND;
        externalRecipientHash[id] = recipientHash;
        emit TransferCreated(id, routeId, assetId, amount);
        emit OutboundTransferCreated(id, routeId, assetId, sender, recipientHash, sourceMessageId, amount);
    }

    function bindSourceTransaction(bytes32 id, bytes32 sourceTxId, bytes32 evidenceHash) external {
        _requireLifecycleActor(id);
        Transfer storage t = _transfer(id);
        require(t.status == Status.SOURCE_PENDING, "source state");
        require(t.sourceTxId == bytes32(0) && sourceTxId != bytes32(0), "source tx");
        _requireEvidence(evidenceHash);
        t.sourceTxId = sourceTxId;
        t.updatedAt = uint64(block.timestamp);
        lastEvidenceHash[id] = evidenceHash;
        emit SourceTransactionBound(id, sourceTxId, evidenceHash);
    }

    function markSourcePending(bytes32 id, bytes32 evidenceHash) external {
        _requireLifecycleActor(id);
        _transition(id, Status.SOURCE_PENDING, evidenceHash);
    }

    function markSourceFinalized(bytes32 id, bytes32 evidenceHash) external {
        _requireLifecycleActor(id);
        require(_transfer(id).sourceTxId != bytes32(0), "source tx");
        _transition(id, Status.SOURCE_FINALIZED, evidenceHash);
    }

    function markProofPending(bytes32 id, bytes32 evidenceHash) external {
        _requireLifecycleActor(id);
        _transition(id, Status.PROOF_PENDING, evidenceHash);
    }

    function markVerified(bytes32 id, bytes32 evidenceHash) external {
        _requireLifecycleActor(id);
        _transition(id, Status.VERIFIED, evidenceHash);
    }

    function markDestinationPending(bytes32 id, bytes32 evidenceHash) external {
        _requireLifecycleActor(id);
        _transition(id, Status.DESTINATION_PENDING, evidenceHash);
    }

    function markCompleted(bytes32 id, bytes32 evidenceHash) external {
        _requireLifecycleActor(id);
        _transition(id, Status.COMPLETED, evidenceHash);
    }

    function markFailed(bytes32 id, bytes32 evidenceHash) external {
        _requireLifecycleActor(id);
        Status current = _transfer(id).status;
        require(_isRetryStage(current), "failure state");
        retryTarget[id] = current;
        _transition(id, Status.FAILED, evidenceHash);
    }

    function markSourceReorg(bytes32 id, bytes32 evidenceHash) external {
        _requireLifecycleActor(id);
        Status current = _transfer(id).status;
        require(
            current == Status.SOURCE_FINALIZED || current == Status.PROOF_PENDING || current == Status.VERIFIED,
            "reorg state"
        );
        retryTarget[id] = Status.SOURCE_PENDING;
        _transition(id, Status.FAILED, evidenceHash);
    }

    function markRetryable(bytes32 id, bytes32 evidenceHash) external {
        _requireLifecycleActor(id);
        require(retryTarget[id] != Status.NONE, "retry target");
        _transition(id, Status.RETRYABLE, evidenceHash);
    }

    function retry(bytes32 id, bytes32 evidenceHash) external {
        _requireLifecycleActor(id);
        Status target = retryTarget[id];
        require(_isRetryStage(target), "retry target");
        _transition(id, target, evidenceHash);
        retryTarget[id] = Status.NONE;
    }

    function pauseTransfer(bytes32 id, bytes32 evidenceHash) external {
        _requireGenesisGovernance(BridgeIds420.ACTION_CONFIGURE);
        Status current = _transfer(id).status;
        require(_isPausable(current), "pause state");
        pausedFrom[id] = current;
        _transition(id, Status.PAUSED, evidenceHash);
    }

    function resumeTransfer(bytes32 id, bytes32 evidenceHash) external {
        _requireGenesisGovernance(BridgeIds420.ACTION_CONFIGURE);
        require(_transfer(id).status == Status.PAUSED, "not paused");
        Status target = pausedFrom[id];
        require(_isPausable(target), "resume state");
        _transition(id, target, evidenceHash);
        pausedFrom[id] = Status.NONE;
    }

    function disputeTransfer(bytes32 id, bytes32 evidenceHash) external {
        _requireGenesisGovernance(BridgeIds420.ACTION_CONFIGURE);
        Status current = _transfer(id).status;
        require(!_isTerminal(current) && current != Status.NONE && current != Status.DISPUTED, "dispute state");
        _transition(id, Status.DISPUTED, evidenceHash);
    }

    function expireTransfer(bytes32 id, bytes32 evidenceHash) external {
        _requireGenesisGovernance(BridgeIds420.ACTION_CONFIGURE);
        Status current = _transfer(id).status;
        require(
            current == Status.CREATED || current == Status.SOURCE_PENDING || current == Status.SOURCE_FINALIZED
                || current == Status.PROOF_PENDING || current == Status.RETRYABLE || current == Status.PAUSED,
            "expiry state"
        );
        _transition(id, Status.EXPIRED, evidenceHash);
    }

    function refundTransfer(bytes32 id, bytes32 evidenceHash) external {
        _requireGenesisGovernance(BridgeIds420.ACTION_WITHDRAWAL_RECOVERY);
        _requireOperational(
            BridgeIds420.ACTION_WITHDRAWAL_RECOVERY,
            ISystemSafety420.ActionClass.WITHDRAWAL_ONLY,
            Types420.Direction.NONE
        );
        Status current = _transfer(id).status;
        require(current == Status.FAILED || current == Status.EXPIRED || current == Status.DISPUTED, "refund state");
        _transition(id, Status.REFUNDED, evidenceHash);
    }

    function isAllowedTransition(Status fromStatus, Status toStatus) public pure returns (bool) {
        if (fromStatus == Status.NONE || _isTerminal(fromStatus) || fromStatus == toStatus) return false;

        if (fromStatus == Status.CREATED) {
            return toStatus == Status.SOURCE_PENDING || toStatus == Status.PAUSED
                || toStatus == Status.DISPUTED || toStatus == Status.EXPIRED;
        }
        if (fromStatus == Status.SOURCE_PENDING) {
            return toStatus == Status.SOURCE_FINALIZED || toStatus == Status.FAILED || toStatus == Status.PAUSED
                || toStatus == Status.DISPUTED || toStatus == Status.EXPIRED;
        }
        if (fromStatus == Status.SOURCE_FINALIZED) {
            return toStatus == Status.PROOF_PENDING || toStatus == Status.FAILED || toStatus == Status.PAUSED
                || toStatus == Status.DISPUTED || toStatus == Status.EXPIRED;
        }
        if (fromStatus == Status.PROOF_PENDING) {
            return toStatus == Status.VERIFIED || toStatus == Status.FAILED || toStatus == Status.PAUSED
                || toStatus == Status.DISPUTED || toStatus == Status.EXPIRED;
        }
        if (fromStatus == Status.VERIFIED) {
            return toStatus == Status.DESTINATION_PENDING || toStatus == Status.FAILED
                || toStatus == Status.PAUSED || toStatus == Status.DISPUTED;
        }
        if (fromStatus == Status.DESTINATION_PENDING) {
            return toStatus == Status.COMPLETED || toStatus == Status.FAILED
                || toStatus == Status.PAUSED || toStatus == Status.DISPUTED;
        }
        if (fromStatus == Status.FAILED) {
            return toStatus == Status.RETRYABLE || toStatus == Status.DISPUTED || toStatus == Status.REFUNDED;
        }
        if (fromStatus == Status.RETRYABLE) {
            return _isRetryStage(toStatus) || toStatus == Status.PAUSED
                || toStatus == Status.DISPUTED || toStatus == Status.EXPIRED;
        }
        if (fromStatus == Status.PAUSED) {
            return _isPausable(toStatus) || toStatus == Status.DISPUTED || toStatus == Status.EXPIRED;
        }
        if (fromStatus == Status.EXPIRED) {
            return toStatus == Status.DISPUTED || toStatus == Status.REFUNDED;
        }
        if (fromStatus == Status.DISPUTED) return toStatus == Status.REFUNDED;
        return false;
    }

    function _consumeIdentity(bytes32 id) private {
        IReplayProtection420 replay = IReplayProtection420(_resolveRequired(AppDependencyIds420.REPLAY_PROTECTION));
        if (replay.isConsumed(id)) revert Errors420.Replay(id);
        require(!consumedTransferId[id], "replay");
        consumedTransferId[id] = true;
    }

    function _transition(bytes32 id, Status toStatus, bytes32 evidenceHash) private {
        Transfer storage t = _transfer(id);
        Status fromStatus = t.status;
        _requireEvidence(evidenceHash);
        require(isAllowedTransition(fromStatus, toStatus), "transition");
        t.status = toStatus;
        t.updatedAt = uint64(block.timestamp);
        lastEvidenceHash[id] = evidenceHash;
        emit TransferStatus(id, toStatus);
        emit TransferTransition(id, fromStatus, toStatus, evidenceHash, msg.sender);
    }

    function _requireLifecycleActor(bytes32 id) private view {
        require(trustedRouter[msg.sender] || trustedOperator[msg.sender], "lifecycle actor");
        Direction direction = transferDirection[id];
        require(direction != Direction.NONE, "direction");
        if (direction == Direction.INBOUND) {
            _requireOperational(
                BridgeIds420.ACTION_INBOUND,
                ISystemSafety420.ActionClass.NORMAL_ONLY,
                Types420.Direction.INBOUND
            );
        } else {
            _requireOperational(
                BridgeIds420.ACTION_OUTBOUND,
                ISystemSafety420.ActionClass.NORMAL_ONLY,
                Types420.Direction.OUTBOUND
            );
        }
    }

    function _transfer(bytes32 id) private view returns (Transfer storage t) {
        t = transfers[id];
        require(t.status != Status.NONE, "unknown");
    }

    function _requireEvidence(bytes32 evidenceHash) private pure {
        require(evidenceHash != bytes32(0), "evidence");
    }

    function _isRetryStage(Status status_) private pure returns (bool) {
        return status_ == Status.SOURCE_PENDING || status_ == Status.SOURCE_FINALIZED
            || status_ == Status.PROOF_PENDING || status_ == Status.VERIFIED
            || status_ == Status.DESTINATION_PENDING;
    }

    function _isPausable(Status status_) private pure returns (bool) {
        return status_ == Status.CREATED || _isRetryStage(status_) || status_ == Status.RETRYABLE;
    }

    function _isTerminal(Status status_) private pure returns (bool) {
        return status_ == Status.COMPLETED || status_ == Status.REFUNDED;
    }
}

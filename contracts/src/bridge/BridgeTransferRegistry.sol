// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../libraries/AppDependencyIds420.sol";

import "../system/GenesisResidentAccess420.sol";
import "../interfaces/genesis/Types420.sol";
import "../interfaces/genesis/ISystemSafety420.sol";
import "../interfaces/genesis/IReplayProtection420.sol";
import "../interfaces/genesis/Errors420.sol";
import "../libraries/GenesisInterfaceIds420.sol";
import "./BridgeIds420.sol";

contract BridgeTransferRegistry is GenesisResidentAccess420 {
    enum Status {
        NONE, CREATED, SOURCE_PENDING, SOURCE_FINALIZED, PROOF_PENDING, VERIFIED,
        DESTINATION_PENDING, COMPLETED, FAILED, RETRYABLE, EXPIRED, PAUSED, DISPUTED, REFUNDED
    }
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
    mapping(address => bool) public trustedRouter;

    event RouterSet(address indexed router, bool trusted);
    event TransferCreated(bytes32 indexed transferId, bytes32 indexed routeId, bytes32 indexed assetId, uint256 amount);
    event TransferStatus(bytes32 indexed transferId, Status status);

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
        id = deriveTransferId(routeId, assetId, sender, recipient, amount, sourceTxId, sourceMessageId);
        IReplayProtection420 replay = IReplayProtection420(_resolveRequired(AppDependencyIds420.REPLAY_PROTECTION));
        if (replay.isConsumed(id)) revert Errors420.Replay(id);
        require(!consumedTransferId[id], "replay");
        consumedTransferId[id] = true;
        transfers[id] = Transfer(
            routeId, assetId, sender, recipient, amount, sourceTxId, sourceMessageId,
            Status.CREATED, uint64(block.timestamp), uint64(block.timestamp)
        );
        emit TransferCreated(id, routeId, assetId, amount);
    }

    function setStatus(bytes32 id, Status status_) external {
        _requireGenesisGovernance(BridgeIds420.ACTION_CONFIGURE);
        require(transfers[id].status != Status.NONE, "unknown");
        transfers[id].status = status_;
        transfers[id].updatedAt = uint64(block.timestamp);
        emit TransferStatus(id, status_);
    }
}

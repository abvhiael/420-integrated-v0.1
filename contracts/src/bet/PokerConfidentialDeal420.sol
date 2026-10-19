// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./PokerSeatLedger420.sol";

/// @notice A non-custodial, commitment-only poker-dealing coordination envelope.
/// @dev NEVER stores or emits card identities, plaintext shuffle seeds, private keys
///      or decryptable hole cards. Commitment registration alone proves NO secrecy,
///      unbiased shuffle, receipt by a player or independently controlled providers.
///      No consumer may treat Committed as a playable hand or authorize fund settlement.
contract PokerConfidentialDeal420 {
    bytes32 public constant ACTION_BEGIN = keccak256("BET_POKER_DEAL_BEGIN");
    bytes32 public constant ACTION_PROVIDER_COMMIT = keccak256("BET_POKER_DEAL_COMMIT");
    bytes32 public constant DOMAIN = keccak256("420.BET.POKER.CONFIDENTIAL.DEAL.V1");

    enum State { NONE, AWAITING, COMMITTED, EXPIRED }
    struct Hand {
        bytes32 tableId;
        bytes32 configHash;
        bytes32 rulesetId;
        bytes32 versionId;
        bytes32 priorStateHash;
        bytes32 seatSnapshotHash;
        uint64 epoch;
        uint64 nonce;
        uint64 deadline;
        bytes32 rootA;
        bytes32 rootB;
        bytes32 transcriptCommitment;
        State state;
    }
    PokerTableRegistry420 public immutable tables;
    PokerSeatLedger420 public immutable ledger;
    BetAuthorization420 public immutable authorization;
    address public immutable providerA;
    address public immutable providerB;
    mapping(bytes32 => uint64) public lastNonce;
    mapping(bytes32 => uint16) public handSeatMask;
    mapping(bytes32 => Hand) private hands;

    error InvalidInput(); error Unauthorized(); error InvalidState();
    error NotOpen(); error EmergencyHalt(); error Expired(); error NotExpired();
    error WrongProvider(); error Duplicate(); error ParticipantsChanged();

    event DealRequested(bytes32 indexed handId, bytes32 indexed tableId, uint64 nonce, uint64 deadline);
    event ProviderCommitted(bytes32 indexed handId, address indexed provider, bytes32 commitment);
    event CommitmentsCompleted(bytes32 indexed handId, bytes32 aggregateCommitment);
    event DealExpired(bytes32 indexed handId);

    constructor(address tables_, address ledger_, address providerA_, address providerB_) {
        if (tables_ == address(0) || ledger_ == address(0) || providerA_ == address(0)
            || providerB_ == address(0) || providerA_ == providerB_) revert InvalidInput();
        tables = PokerTableRegistry420(tables_);
        ledger = PokerSeatLedger420(ledger_);
        if (address(ledger.tables()) != tables_) revert InvalidInput();
        authorization = tables.authorization();
        providerA = providerA_;
        providerB = providerB_;
    }

    /// @notice All claims of encrypted-packet integrity remain off-chain until a later
    ///         independently reviewed proof verifier and recipient authentication exist.
    function begin(bytes32 tableId, uint64 nonce, uint64 deadline, bytes32 priorStateHash,
        bytes32 seatSnapshotHash, uint16 seatsMask) external returns (bytes32 handId) {
        PokerTableRegistry420.Table memory t = tables.getTable(tableId);
        if (t.status != PokerTableRegistry420.Status.OPEN || !tables.operators().isActive(t.config.operatorId))
            revert NotOpen();
        if (tables.emergency().isHalted(BetTypes420.EmergencyDomain.POKER_NEW_HANDS,t.config.gameVersionId))
            revert EmergencyHalt();
        if (nonce == 0 || nonce != lastNonce[tableId] + 1 || deadline <= block.timestamp
            || deadline > block.timestamp + 1 days || priorStateHash == bytes32(0)
            || seatSnapshotHash == bytes32(0) || seatsMask == 0) revert InvalidInput();
        if (!authorization.isAuthorized(msg.sender,ACTION_BEGIN,authorization.scopeForTable(tableId),0))
            revert Unauthorized();
        if (msg.sender == providerA || msg.sender == providerB) revert Unauthorized();
        if (_verifySeats(tableId,t.config.seats,seatsMask) < 2) revert InvalidInput();
        if (seatSnapshotHash != snapshotFor(tableId,seatsMask)) revert ParticipantsChanged();
        uint64 epoch = ledger.seatingEpoch(tableId);
        handId = keccak256(abi.encode(DOMAIN,block.chainid,address(this),tableId,t.configHash,
            t.config.gameVersionId,t.config.rulesetId,nonce,epoch,priorStateHash,seatSnapshotHash,seatsMask));
        if (hands[handId].state != State.NONE) revert Duplicate();
        hands[handId] = Hand(tableId,t.configHash,t.config.rulesetId,t.config.gameVersionId,
            priorStateHash,seatSnapshotHash,epoch,nonce,deadline,bytes32(0),bytes32(0),bytes32(0),State.AWAITING);
        lastNonce[tableId]=nonce;
        handSeatMask[handId]=seatsMask;
        emit DealRequested(handId,tableId,nonce,deadline);
    }

    function commit(bytes32 handId,bytes32 commitment) external {
        Hand storage h = hands[handId];
        if (h.state != State.AWAITING) revert InvalidState();
        if (block.timestamp >= h.deadline) revert Expired();
        if (commitment == bytes32(0)) revert InvalidInput();
        if (msg.sender != providerA && msg.sender != providerB) revert WrongProvider();
        if (!authorization.isAuthorized(msg.sender,ACTION_PROVIDER_COMMIT,
            authorization.scopeForTable(h.tableId),0)) revert Unauthorized();
        PokerTableRegistry420.Table memory t = tables.getTable(h.tableId);
        if (t.status != PokerTableRegistry420.Status.OPEN || !tables.operators().isActive(t.config.operatorId)) revert NotOpen();
        if (ledger.seatingEpoch(h.tableId) != h.epoch || t.configHash != h.configHash
            || snapshotFor(h.tableId,handSeatMask[handId]) != h.seatSnapshotHash) revert ParticipantsChanged();
        if (msg.sender == providerA) {
            if (h.rootA != bytes32(0)) revert Duplicate();
            h.rootA=commitment;
        } else {
            if (h.rootB != bytes32(0)) revert Duplicate();
            if (commitment == h.rootA) revert InvalidInput();
            h.rootB=commitment;
        }
        emit ProviderCommitted(handId,msg.sender,commitment);
        if (h.rootA != bytes32(0) && h.rootB != bytes32(0)) {
            h.transcriptCommitment=keccak256(abi.encode(DOMAIN,handId,h.rootA,h.rootB));
            h.state=State.COMMITTED;
            emit CommitmentsCompleted(handId,h.transcriptCommitment);
        }
    }

    function expire(bytes32 handId) external {
        Hand storage h=hands[handId];
        if (h.state != State.AWAITING) revert InvalidState();
        if (block.timestamp < h.deadline) revert NotExpired();
        h.state=State.EXPIRED;
        emit DealExpired(handId);
    }

    function getHand(bytes32 handId) external view returns (Hand memory) { return hands[handId]; }

    /// @notice Canonical snapshot committed from actual public seating, not caller-supplied metadata.
    function snapshotFor(bytes32 id, uint16 mask) public view returns (bytes32 digest) {
        PokerTableRegistry420.Table memory t=tables.getTable(id);
        if ((uint256(mask) >> t.config.seats) != 0) revert InvalidInput();
        digest=keccak256(abi.encode(DOMAIN,block.chainid,address(this),id,
            t.configHash,ledger.seatingEpoch(id),mask));
        for (uint8 i=0; i<t.config.seats; ++i) {
            if ((mask & (uint16(1)<<i)) != 0) {
                PokerSeatLedger420.Seat memory s=ledger.seatOf(id,i);
                digest=keccak256(abi.encode(digest,i,s.player,s.chips,s.sittingOut,s.epoch));
            }
        }
    }

    function _verifySeats(bytes32 id,uint8 maxSeats,uint16 mask) private view returns(uint256 occupied) {
        if ((uint256(mask) >> maxSeats) != 0) revert InvalidInput();
        for (uint8 i=0; i<maxSeats; ++i) {
            if ((mask & (uint16(1)<<i)) != 0) {
                PokerSeatLedger420.Seat memory s=ledger.seatOf(id,i);
                if (s.player==address(0) || s.sittingOut || s.chips==0) revert InvalidInput();
                if (s.player==providerA || s.player==providerB) revert InvalidInput();
                ++occupied;
            }
        }
    }
}

// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./PokerConfidentialDeal420.sol";

/// @notice Fail-closed hand-specific deadline and dispute holds.
/// @dev No callback into chip custody; a completed timeout is NOT payout authority.
///      Caller-supplied turn authority requires independent deterministic hand-engine
///      verification prior to any operational use.
contract PokerActionDisputeClock420 {
    PokerConfidentialDeal420 public immutable deals;
    bytes32 public constant ACTION_START_CLOCK=keccak256("BET_POKER_START_ACTION_CLOCK");
    struct Clock { uint64 deadline; uint64 nonce; uint8 seat; bytes32 stateHash; bool active; bool disputed; }
    mapping(bytes32=>Clock) public clocks;
    mapping(bytes32=>bytes32) public evidenceHash;
    bytes32 public constant ACTION_BIND_RESOLVER=keccak256("BET_POKER_BIND_NATIVE_DISPUTE_RESOLVER.V1");
    uint64 public constant REVIEW_WINDOW=1 days;
    struct Resolution {
        bytes32 outcomeHash;
        bytes32 appealEvidence;
        uint64 proposedAt;
        uint64 executableAfter;
        bool appealed;
        bool finalized;
    }
    mapping(bytes32=>Resolution) public resolutions;
    mapping(bytes32=>address) public resolverForTable;
    error InvalidInput(); error Unauthorized(); error InvalidState(); error Premature();
    event ClockStarted(bytes32 indexed handId,uint8 seat,uint64 nonce,uint64 deadline,bytes32 stateHash);
    event ClockExpired(bytes32 indexed handId,uint8 seat,uint64 nonce);
    event Disputed(bytes32 indexed handId,address challenger,bytes32 evidence);
    event NativeResolverBound(bytes32 indexed tableId,address resolver);
    event ResolutionProposed(bytes32 indexed handId,bytes32 outcomeHash,uint64 executableAfter);
    event ResolutionAppealed(bytes32 indexed handId,bytes32 evidence,uint64 executableAfter);
    event ResolutionFinalized(bytes32 indexed handId,bytes32 outcomeHash);
    constructor(address deals_) {
        if(deals_==address(0))revert InvalidInput();
        deals=PokerConfidentialDeal420(deals_);
    }
    function start(bytes32 handId,uint8 seat,uint64 nonce,uint64 deadline,bytes32 stateHash) external {
        Clock storage existing=clocks[handId];
        if(existing.disputed) revert InvalidState();
        PokerConfidentialDeal420.Hand memory h=deals.getHand(handId);
        if(h.state!=PokerConfidentialDeal420.State.COMMITTED||seat>=9||
           (deals.handSeatMask(handId)&(uint16(1)<<seat))==0||
           nonce==0||stateHash==bytes32(0)||deadline<=block.timestamp||
           deadline>block.timestamp+1 hours)revert InvalidInput();
        if(!deals.authorization().isAuthorized(msg.sender,ACTION_START_CLOCK,
             deals.authorization().scopeForTable(h.tableId),0))revert Unauthorized();
        Clock storage c=clocks[handId];
        if(c.disputed||(c.active && block.timestamp<c.deadline)||nonce!=c.nonce+1)
            revert InvalidState();
        if(deals.ledger().seatingEpoch(h.tableId)!=h.epoch ||
           deals.snapshotFor(h.tableId,deals.handSeatMask(handId))!=h.seatSnapshotHash)
            revert InvalidState();
        clocks[handId]=Clock(deadline,nonce,seat,stateHash,true,false);
        emit ClockStarted(handId,seat,nonce,deadline,stateHash);
    }
    function expire(bytes32 handId) external {
        Clock storage c=clocks[handId];
        if(!c.active||c.disputed)revert InvalidState();
        if(block.timestamp<c.deadline)revert Premature();
        c.active=false;
        emit ClockExpired(handId,c.seat,c.nonce);
    }
    function dispute(bytes32 handId,bytes32 evidence) external {
        if(evidence==bytes32(0))revert InvalidInput();
        PokerConfidentialDeal420.Hand memory h=deals.getHand(handId);
        Clock storage c=clocks[handId];
        if(c.nonce==0||c.disputed)revert InvalidState();
        bool authorized=false;
        for(uint8 i=0;i<9;i++)if((deals.handSeatMask(handId)&(uint16(1)<<i))!=0 &&
           deals.ledger().seatOf(h.tableId,i).player==msg.sender)authorized=true;
        if(!authorized)revert Unauthorized();
        c.active=false;c.disputed=true;
        evidenceHash[handId]=evidence;
        emit Disputed(handId,msg.sender,evidence);
    }
    /// @notice Bind a native on-chain outcome verifier once per table; no human
    /// adjudicator can supply payout amounts or override proof failure.
    function bindResolver(bytes32 tableId,address resolver) external {
        if(resolver==address(0)||resolver.code.length==0||
           resolverForTable[tableId]!=address(0))revert InvalidInput();
        deals.tables().getTable(tableId);
        if(!deals.authorization().isAuthorized(msg.sender,ACTION_BIND_RESOLVER,
            deals.authorization().scopeForTable(tableId),0))revert Unauthorized();
        resolverForTable[tableId]=resolver;
        emit NativeResolverBound(tableId,resolver);
    }
    function _requireResolver(bytes32 handId) private view {
        PokerConfidentialDeal420.Hand memory h=deals.getHand(handId);
        if(msg.sender==address(0)||msg.sender!=resolverForTable[h.tableId])
            revert Unauthorized();
    }
    /// @notice The native engine must independently recompute the COMPLETE final
    /// action/board/escrow result before recording this outcome commitment.
    function proposeVerifiedOutcome(bytes32 handId,bytes32 resultHash) external {
        _requireResolver(handId);
        if(!clocks[handId].disputed||resultHash==bytes32(0)||
           resolutions[handId].proposedAt!=0)revert InvalidState();
        uint64 deadline=uint64(block.timestamp+REVIEW_WINDOW);
        resolutions[handId]=Resolution(resultHash,bytes32(0),
            uint64(block.timestamp),deadline,false,false);
        emit ResolutionProposed(handId,resultHash,deadline);
    }
    /// @notice One appeal opportunity by a seated participant. This extends
    /// review, but cannot permanently stop valid cryptographically proven settlement.
    function appeal(bytes32 handId,bytes32 evidence) external {
        Resolution storage r=resolutions[handId];
        if(r.proposedAt==0||r.finalized||r.appealed||
           block.timestamp>=r.executableAfter||evidence==bytes32(0))
            revert InvalidState();
        PokerConfidentialDeal420.Hand memory h=deals.getHand(handId);
        bool member=false;
        for(uint8 i=0;i<9;i++)if((deals.handSeatMask(handId)&(uint16(1)<<i))!=0 &&
           deals.ledger().seatOf(h.tableId,i).player==msg.sender)member=true;
        if(!member)revert Unauthorized();
        r.appealed=true;r.appealEvidence=evidence;
        r.executableAfter=uint64(uint256(r.executableAfter)+REVIEW_WINDOW);
        emit ResolutionAppealed(handId,evidence,r.executableAfter);
    }
    /// @notice Canonical engine finalizes only an UNCHANGED fully proved outcome.
    /// An appeal is publicly recorded and grants more time for presenting evidence.
    function finalizeVerifiedOutcome(bytes32 handId,bytes32 actualResultHash) external {
        _requireResolver(handId);
        Resolution storage r=resolutions[handId];
        if(!clocks[handId].disputed||r.proposedAt==0||r.finalized||
           r.outcomeHash!=actualResultHash)revert InvalidState();
        if(block.timestamp<r.executableAfter)revert Premature();
        r.finalized=true;
        clocks[handId].disputed=false;
        emit ResolutionFinalized(handId,actualResultHash);
    }
    function isFrozen(bytes32 handId) external view returns(bool){return clocks[handId].disputed;}
}

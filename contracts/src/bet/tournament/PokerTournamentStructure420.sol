// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Native tournament stack/blind/clock mechanics for a future qualified hand host.
/// @dev Internal functions do not authenticate first-hand, table or outcome observations.
library PokerTournamentStructure420 {
    bytes32 internal constant HAND_DOMAIN=keccak256("420.BET.POKER.TOURNAMENT.BLIND.SNAPSHOT.V1");
    uint256 internal constant MAX_LEVELS=256;
    struct Level { uint128 smallBlind; uint128 bigBlind; uint32 duration; }
    enum State { NONE, RUNNING, PAUSED, RECOVERY_REQUIRED, FINISHED }
    struct Clock {
        bytes32 context; bytes32 scheduleHash; uint32 recoveryGrace; uint16 maxTables;
        State state; uint64 startedAt; uint64 pausedAt; uint64 pausedTotal;
        uint64 firstPause; uint64 observedAt; uint64 revision;
    }
    struct Position { uint16 level; uint128 smallBlind; uint128 bigBlind; uint256 elapsed; uint256 remaining; bool finalLevel; }
    struct Hand { bytes32 context; bytes32 table; bytes32 digest; uint16 level; uint128 smallBlind; uint128 bigBlind; bool closed; }
    struct Hands { bytes32 context; uint32 activeCount; mapping(bytes32=>Hand) byId; mapping(bytes32=>bytes32) activeForTable; }
    error InvalidStructure(); error InvalidClock(); error InvalidHand();

    function validate(uint128 startingStack,Level[] memory levels) internal pure returns(uint64 total) {
        if(startingStack==0)revert InvalidStructure();return validateLevels(levels);
    }
    function validateLevels(Level[] memory levels) internal pure returns(uint64 total) {
        if(levels.length==0||levels.length>MAX_LEVELS)revert InvalidStructure();
        uint256 sum=0;uint256 previous=0;
        for(uint256 i;i<levels.length;i++){
            Level memory l=levels[i];
            // Preserve the qualified NLHE foundation's exact 2:1, no-ante convention.
            if(l.smallBlind==0||uint256(l.smallBlind)*2!=l.bigBlind||l.bigBlind<previous||l.duration==0)revert InvalidStructure();
            previous=l.bigBlind;sum+=l.duration;
        }
        if(sum>type(uint64).max)revert InvalidStructure();return uint64(sum);
    }
    function at(Level[] memory levels,uint256 effectiveSeconds) internal pure returns(Position memory p) {
        if(levels.length==0||levels.length>MAX_LEVELS)revert InvalidStructure();
        uint256 boundary=0;
        for(uint256 i;i<levels.length;i++){
            Level memory l=levels[i];boundary+=l.duration;
            if(effectiveSeconds<boundary||i+1==levels.length){
                p=Position(uint16(i+1),l.smallBlind,l.bigBlind,effectiveSeconds,effectiveSeconds<boundary?boundary-effectiveSeconds:0,i+1==levels.length);return p;
            }
        }
        revert InvalidStructure();
    }
    function _time(Clock storage c,uint256 now_) private view {
        if(now_==0||now_>type(uint64).max||now_<c.observedAt)revert InvalidClock();
    }
    function start(Clock storage c,bytes32 context,uint16 maxTables,uint32 recovery,Level[] memory levels,uint256 now_) internal {
        _time(c,now_);if(c.state!=State.NONE||context==0||maxTables==0||recovery==0)revert InvalidClock();
        validateLevels(levels);c.context=context;c.scheduleHash=keccak256(abi.encode(levels));c.maxTables=maxTables;c.recoveryGrace=recovery;
        c.state=State.RUNNING;c.startedAt=uint64(now_);c.observedAt=uint64(now_);c.revision=1;
    }
    function observe(Clock storage c,uint256 now_,uint32 recovery) internal {
        _time(c,now_);if(c.state==State.NONE||recovery==0||recovery!=c.recoveryGrace)revert InvalidClock();
        c.observedAt=uint64(now_);
        if(c.state==State.PAUSED&&now_>=uint256(c.firstPause)+recovery)c.state=State.RECOVERY_REQUIRED;
    }
    function pause(Clock storage c,uint256 now_,uint32 recovery) internal {
        observe(c,now_,recovery);if(c.state!=State.RUNNING)revert InvalidClock();
        if(c.firstPause==0)c.firstPause=uint64(now_);
        c.pausedAt=uint64(now_);c.state=now_>=uint256(c.firstPause)+recovery?State.RECOVERY_REQUIRED:State.PAUSED;++c.revision;
    }
    function resume(Clock storage c,uint256 now_,uint32 recovery) internal {
        observe(c,now_,recovery);if(c.state!=State.PAUSED)revert InvalidClock();
        c.pausedTotal+=uint64(now_-c.pausedAt);c.pausedAt=0;c.state=State.RUNNING;++c.revision;
    }
    function elapsed(Clock storage c,uint256 now_) internal view returns(uint256) {
        _time(c,now_);if(c.state==State.NONE)revert InvalidClock();
        uint256 end=c.pausedAt==0?now_:c.pausedAt;
        if(end<c.startedAt||end-c.startedAt<c.pausedTotal)revert InvalidClock();
        return end-c.startedAt-c.pausedTotal;
    }
    function finish(Clock storage c,Hands storage hands,uint256 now_,uint32 recovery) internal {
        observe(c,now_,recovery);if(c.state!=State.RUNNING||hands.activeCount!=0||(hands.context!=0&&hands.context!=c.context))revert InvalidClock();
        c.pausedAt=uint64(now_);c.state=State.FINISHED;++c.revision;
    }
    function lock(Hands storage hands,Clock storage c,Level[] memory levels,bytes32 context,bytes32 table,bytes32 hand,uint256 now_)
        internal returns(Hand memory h)
    {
        if(c.state!=State.RUNNING||context!=c.context||context==0||table==0||hand==0||hands.byId[hand].digest!=0||hands.activeForTable[table]!=0||
            hands.activeCount>=c.maxTables||(hands.context!=0&&hands.context!=context)||keccak256(abi.encode(levels))!=c.scheduleHash)revert InvalidHand();
        Position memory p=at(levels,elapsed(c,now_));
        c.observedAt=uint64(now_);
        bytes32 digest=keccak256(abi.encode(HAND_DOMAIN,block.chainid,address(this),context,c.scheduleHash,table,hand,c.startedAt,p.level,p.smallBlind,p.bigBlind));
        h=Hand(context,table,digest,p.level,p.smallBlind,p.bigBlind,false);hands.byId[hand]=h;hands.activeForTable[table]=hand;hands.context=context;++hands.activeCount;
    }
    function close(Hands storage hands,bytes32 context,bytes32 table,bytes32 hand) internal {
        Hand storage h=hands.byId[hand];
        if(h.digest==0||h.closed||h.context!=context||h.table!=table||hands.activeForTable[table]!=hand)revert InvalidHand();
        h.closed=true;delete hands.activeForTable[table];--hands.activeCount;
    }
    /// @notice Chip arithmetic only; neither the mask nor this return value proves genuine seating.
    function post(Hand memory h,uint16 mask,uint8 button,uint256[9] memory stacks)
        internal pure returns(uint8 sb,uint8 bb,uint256[9] memory remaining,uint256[9] memory committed,uint256 pot)
    {
        if(h.digest==0||h.closed||h.smallBlind==0||uint256(h.smallBlind)*2!=h.bigBlind||button>=9||mask==0||(mask>>9)!=0||(mask&(uint16(1)<<button))==0)revert InvalidHand();
        uint256 count=0;
        for(uint8 i;i<9;i++)if((mask&(uint16(1)<<i))!=0){if(stacks[i]==0)revert InvalidHand();++count;}
        if(count<2)revert InvalidHand();
        sb=count==2?button:_next(mask,button);bb=_next(mask,sb);remaining=stacks;
        committed[sb]=stacks[sb]<h.smallBlind?stacks[sb]:h.smallBlind;
        committed[bb]=stacks[bb]<h.bigBlind?stacks[bb]:h.bigBlind;
        remaining[sb]-=committed[sb];remaining[bb]-=committed[bb];pot=committed[sb]+committed[bb];
    }
    function _next(uint16 mask,uint8 from) private pure returns(uint8) {
        for(uint8 step=1;step<=9;step++){uint8 seat=uint8((uint256(from)+step)%9);if((mask&(uint16(1)<<seat))!=0)return seat;}
        revert InvalidHand();
    }
}

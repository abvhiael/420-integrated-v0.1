// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../../randomness/RandomnessDraw420.sol";

/// @notice Bounded native assignment/movement mechanics; callers must authenticate hands and entropy.
/// @dev Supplied layout/zero-stack/hand-boundary facts are not poker outcome proofs.
library PokerTournamentTableBalance420 {
    uint32 internal constant MAX_TABLES=64;
    bytes32 internal constant DOMAIN=keccak256("420.BET.POKER.TOURNAMENT.SEATING.V1");
    enum Result { BALANCED, MOVED, NEEDS_BREAK, WAIT_HAND, WAIT_SEAT }
    enum Purchase { NEW_PLAYER, RE_ENTRY, REBUY }
    struct Player {
        bytes32 person;address payer;uint64 receipt;uint64 nonce;uint128 chips;uint32 generation;
        uint32 table;uint8 seat;uint64 placementEpoch;uint64 blindHistory;uint8 blindObligations;bool seated;
    }
    struct Table {uint16 mask;uint8 button;uint8 nextBB;bool busy;bytes32 hand;uint64 epoch;}
    struct Layout {
        bytes32 context;uint8 capacity;uint32 maxTables;uint32 maxPlayers;uint128 startingStack;
        uint32 expected;uint32 assigned;uint32 players;uint32 lastTable;uint64 revision;bool complete;
        uint32[] open;mapping(uint32=>bool) active;mapping(uint32=>Table) tables;
        mapping(uint32=>mapping(uint8=>bytes32)) seats;mapping(bytes32=>Player) people;
        mapping(uint64=>bool) consumedReceipt;mapping(bytes32=>bool) usedHand;
    }
    struct Move {bytes32 person;uint32 from;uint8 fromSeat;uint32 to;uint8 toSeat;}
    error Invalid();error Busy();error Stale();
    function validate(uint8 capacity,uint32 maxTables,uint32 maxPlayers,bool multi) internal pure {
        if(capacity<2||capacity>9||maxTables==0||maxTables>MAX_TABLES||maxPlayers<2||maxPlayers>uint256(capacity)*maxTables||
            (multi&&capacity==2)||(!multi&&maxTables!=1))revert Invalid();
    }
    function initialize(Layout storage s,bytes32 context,uint8 capacity,uint32 maxTables,uint32 maxPlayers,uint128 stack,uint32 count) internal {
        validate(capacity,maxTables,maxPlayers,maxTables>1);
        if(s.context!=0||context==0||stack==0||count<2||count>maxPlayers)revert Invalid();
        s.context=context;s.capacity=capacity;s.maxTables=maxTables;s.maxPlayers=maxPlayers;s.startingStack=stack;s.expected=count;s.revision=1;
        uint32 n=uint32((uint256(count)+capacity-1)/capacity);
        for(uint32 id=1;id<=n;id++){s.open.push(id);s.active[id]=true;}s.lastTable=n;
    }
    function initial(Layout storage s,Player memory p,uint32 index) internal {
        if(s.complete||s.context==0||index!=s.assigned||index>=s.expected||p.person==0||p.payer==address(0)||p.receipt==0||p.nonce==0||
            p.chips!=s.startingStack||s.people[p.person].person!=0||s.consumedReceipt[p.receipt])revert Invalid();
        uint32 n=uint32(s.open.length);uint32 table=index%n+1;uint8 seat=uint8(index/n);
        p.generation=1;p.blindHistory=0;p.blindObligations=0;p.placementEpoch=1;
        _place(s,p,table,seat);s.consumedReceipt[p.receipt]=true;++s.assigned;++s.players;
    }
    function seal(Layout storage s,bytes32 seed) internal {
        if(s.complete||s.assigned!=s.expected||seed==0)revert Invalid();
        for(uint256 i=0;i<s.open.length;i++){
            uint32 id=s.open[i];Table storage t=s.tables[id];
            t.button=_occupied(t.mask,RandomnessDraw420.boundedUint(seed,keccak256(abi.encode(DOMAIN,s.context,"BUTTON")),id,_count(t.mask)));
            t.nextBB=_bigBlind(t.mask,t.button);t.epoch=1;
        }
        s.complete=true;++s.revision;
    }
    function _place(Layout storage s,Player memory p,uint32 id,uint8 seat) private {
        if(!s.active[id]||seat>=s.capacity||s.seats[id][seat]!=0||s.tables[id].busy)revert Invalid();
        p.table=id;p.seat=seat;p.seated=true;s.people[p.person]=p;s.seats[id][seat]=p.person;s.tables[id].mask|=uint16(1)<<seat;
    }
    function _count(uint16 mask) internal pure returns(uint8 n){for(uint8 i=0;i<9;i++)if((mask&(uint16(1)<<i))!=0)++n;}
    function _next(uint16 mask,uint8 seat) private pure returns(uint8){for(uint8 i=1;i<=9;i++){uint8 j=uint8((uint256(seat)+i)%9);if((mask&(uint16(1)<<j))!=0)return j;}revert Invalid();}
    function _prev(uint16 mask,uint8 seat) private pure returns(uint8){for(uint8 i=1;i<=9;i++){uint8 j=uint8((uint256(seat)+9-i)%9);if((mask&(uint16(1)<<j))!=0)return j;}revert Invalid();}
    function _occupied(uint16 mask,uint256 index) private pure returns(uint8){for(uint8 i=0;i<9;i++)if((mask&(uint16(1)<<i))!=0){if(index==0)return i;--index;}revert Invalid();}
    function _bigBlind(uint16 mask,uint8 button) private pure returns(uint8){return _count(mask)==2?_next(mask,button):_next(mask,_next(mask,button));}
    function _buttonForBB(uint16 mask,uint8 bb) private pure returns(uint8){return _count(mask)==2?_next(mask,bb):_prev(mask,_prev(mask,bb));}
    function _revision(Layout storage s,uint64 expected) private view {if(!s.complete||s.revision!=expected)revert Stale();}
    /// @dev Future host must authenticate the canonical hand and seat-key snapshot before invoking.
    function lock(Layout storage s,bytes32 context,uint32 id,bytes32 hand,uint64 expected) internal {
        _revision(s,expected);Table storage t=s.tables[id];
        if(context!=s.context||!s.active[id]||t.busy||hand==0||s.usedHand[hand]||_count(t.mask)<2)revert Invalid();
        t.busy=true;t.hand=hand;s.usedHand[hand]=true;++t.epoch;++s.revision;
    }
    /// @dev Future host must verify and atomically apply canonical hand settlement before closing.
    function unlock(Layout storage s,bytes32 context,uint32 id,bytes32 hand,uint64 expected) internal {
        _revision(s,expected);Table storage t=s.tables[id];
        if(context!=s.context||!t.busy||t.hand!=hand)revert Invalid();
        t.busy=false;t.hand=0;++t.epoch;++s.revision;
    }
    /// @dev Only settled zero-stack players may leave a layout. This is not evidence of elimination.
    function removeZero(Layout storage s,bytes32 person,uint64 expected) internal {
        _revision(s,expected);Player storage p=s.people[person];Table storage t=s.tables[p.table];
        if(!p.seated||p.chips!=0||t.busy)revert Invalid();uint8 old=p.seat;
        delete s.seats[p.table][old];t.mask&=~(uint16(1)<<old);p.seated=false;++p.placementEpoch;--s.players;
        if(t.mask!=0){t.nextBB=_next(t.mask,old);t.button=_buttonForBB(t.mask,t.nextBB);}++t.epoch;++s.revision;
    }
    function bounds(Layout storage s) internal view returns(uint8 minimum,uint8 maximum,uint32 shortTable,uint32 fullTable){
        minimum=type(uint8).max;
        for(uint256 i=0;i<s.open.length;i++){uint32 id=s.open[i];uint8 count=_count(s.tables[id].mask);
            if(count<minimum||(count==minimum&&(shortTable==0||id<shortTable))){minimum=count;shortTable=id;}
            if(count>maximum||(count==maximum&&(fullTable==0||id<fullTable))){maximum=count;fullTable=id;}
        }
    }
    function worstSeat(uint16 mask,uint8 button,uint8 capacity) internal pure returns(bool found,uint8 seat){
        if(mask==0||button>=capacity||(mask&(uint16(1)<<button))==0)return(false,0);
        uint256 best=type(uint256).max;
        for(uint8 i=0;i<capacity;i++)if((mask&(uint16(1)<<i))==0){
            uint16 nextMask=mask|(uint16(1)<<i);uint8 n=_count(nextMask);uint8 sb=n==2?button:_next(nextMask,button);
            if(i==sb)continue;uint8 bb=_next(nextMask,sb);uint256 distance=0;uint8 cursor=bb;
            while(cursor!=i){cursor=_next(nextMask,cursor);++distance;}
            if(distance<best){found=true;best=distance;seat=i;}
        }
    }
    function balanceOne(Layout storage s,uint64 expected) internal returns(Result result,Move memory m){
        _revision(s,expected);if(s.open.length<=1)return(Result.BALANCED,m);
        if(s.players<=uint256(s.capacity)*(s.open.length-1))return(Result.NEEDS_BREAK,m);
        (uint8 low,uint8 high,uint32 target,uint32 source)=bounds(s);if(high<=low+1)return(Result.BALANCED,m);
        Table storage from=s.tables[source];Table storage to=s.tables[target];
        if(from.busy||to.busy)return(Result.WAIT_HAND,m);
        (bool found,uint8 seat)=worstSeat(to.mask,to.button,s.capacity);if(!found)return(Result.WAIT_SEAT,m);
        bytes32 person=s.seats[source][from.nextBB];if(person==0)revert Invalid();
        m=_move(s,person,target,seat);return(Result.MOVED,m);
    }
    function _move(Layout storage s,bytes32 person,uint32 target,uint8 seat) private returns(Move memory m){
        Player storage p=s.people[person];uint32 source=p.table;uint8 old=p.seat;Table storage from=s.tables[source];Table storage to=s.tables[target];
        if(!p.seated||source==target||from.busy||to.busy||!s.active[target]||seat>=s.capacity||s.seats[target][seat]!=0)revert Invalid();
        m=Move(person,source,old,target,seat);delete s.seats[source][old];from.mask&=~(uint16(1)<<old);
        if(from.mask!=0){from.nextBB=_next(from.mask,old);from.button=_buttonForBB(from.mask,from.nextBB);}
        bool empty=to.mask==0;s.seats[target][seat]=person;to.mask|=uint16(1)<<seat;
        if(empty)to.button=seat;to.nextBB=_count(to.mask)<2?seat:_bigBlind(to.mask,to.button);
        p.table=target;p.seat=seat;++p.placementEpoch;++from.epoch;++to.epoch;++s.revision;
        // Chips, purchase identity/generation and all existing blind history/obligations are untouched.
    }
    function breakHighest(Layout storage s,uint64 expected,bytes32 seed) internal returns(Result result,Move[] memory moves){
        _revision(s,expected);if(seed==0||s.open.length<=1||s.players>uint256(s.capacity)*(s.open.length-1))revert Invalid();
        uint32 source=s.open[s.open.length-1];if(s.tables[source].busy)return(Result.WAIT_HAND,new Move[](0));
        uint8 n=_count(s.tables[source].mask);uint256 survivors=s.open.length-1;
        uint16[] memory masks=new uint16[](survivors);uint8[] memory counts=new uint8[](survivors);uint256 available=0;
        for(uint256 i=0;i<survivors;i++){Table storage t=s.tables[s.open[i]];masks[i]=t.mask;counts[i]=_count(t.mask);if(!t.busy)available+=s.capacity-counts[i];}
        if(available<n)return(Result.WAIT_HAND,new Move[](0));
        uint256[] memory order=new uint256[](n);bytes32[] memory people=new bytes32[](n);
        for(uint8 i=0;i<n;i++){order[i]=i;people[i]=s.seats[source][_occupied(s.tables[source].mask,i)];}
        bytes32 domain=keccak256(abi.encode(DOMAIN,s.context,"BREAK",expected,source));order=RandomnessDraw420.shuffle(seed,domain,0,order);
        moves=new Move[](n);
        for(uint256 step=0;step<n;step++){
            uint8 least=type(uint8).max;uint256 options=0;
            for(uint256 i=0;i<survivors;i++)if(!s.tables[s.open[i]].busy&&counts[i]<s.capacity){if(counts[i]<least){least=counts[i];options=1;}else if(counts[i]==least)++options;}
            uint256 choice=RandomnessDraw420.boundedUint(seed,domain,100+step*2,options);uint256 selected=0;
            for(uint256 i=0;i<survivors;i++)if(!s.tables[s.open[i]].busy&&counts[i]==least){if(choice==0){selected=i;break;}--choice;}
            uint16 empty=uint16((uint256(1)<<s.capacity)-1)&~masks[selected];
            uint8 seat=_occupied(empty,RandomnessDraw420.boundedUint(seed,domain,101+step*2,_count(empty)));
            bytes32 person=people[order[step]];Player storage p=s.people[person];moves[step]=Move(person,source,p.seat,s.open[selected],seat);
            masks[selected]|=uint16(1)<<seat;++counts[selected];
        }
        for(uint256 i=0;i<moves.length;i++)_move(s,moves[i].person,moves[i].to,moves[i].toSeat);
        s.active[source]=false;s.open.pop();++s.revision;return(Result.MOVED,moves);
    }
    /// @dev Internal future-host entry placement. Payment/zero-stack/window/outcome facts must be verified upstream.
    function admit(Layout storage s,Player memory p,Purchase kind,bytes32 seed,uint64 expected) internal returns(uint32 table,uint8 seat){
        _revision(s,expected);Player storage old=s.people[p.person];
        if(seed==0||p.person==0||p.payer==address(0)||p.receipt==0||p.nonce==0||p.chips!=s.startingStack||s.consumedReceipt[p.receipt]||s.players>=s.maxPlayers||old.seated)revert Invalid();
        if(old.person!=0){if(old.chips!=0||p.nonce<=old.nonce||kind==Purchase.NEW_PLAYER)revert Invalid();p.generation=old.generation+(kind==Purchase.RE_ENTRY?1:0);p.blindHistory=old.blindHistory;p.blindObligations=old.blindObligations;}
        else {if(kind!=Purchase.NEW_PLAYER)revert Invalid();p.generation=1;p.blindHistory=0;p.blindObligations=0;}
        uint8 minimum=type(uint8).max;uint256 options=0;
        for(uint256 i=0;i<s.open.length;i++){uint32 id=s.open[i];uint8 count=_count(s.tables[id].mask);if(!s.tables[id].busy&&count<s.capacity){if(count<minimum){minimum=count;options=1;}else if(count==minimum)++options;}}
        if(options==0){if(s.open.length>=s.maxTables)revert Busy();table=++s.lastTable;s.open.push(table);s.active[table]=true;}
        else {uint256 choice=RandomnessDraw420.boundedUint(seed,keccak256(abi.encode(DOMAIN,s.context,"ADMIT",expected,p.person,p.nonce)),0,options);for(uint256 i=0;i<s.open.length;i++){uint32 id=s.open[i];if(!s.tables[id].busy&&_count(s.tables[id].mask)==minimum){if(choice==0){table=id;break;}--choice;}}}
        uint16 empty=uint16((uint256(1)<<s.capacity)-1)&~s.tables[table].mask;
        seat=_occupied(empty,RandomnessDraw420.boundedUint(seed,keccak256(abi.encode(DOMAIN,s.context,"ADMIT_SEAT",expected,p.person,p.nonce)),1,_count(empty)));
        p.placementEpoch=old.placementEpoch+1;bool vacant=s.tables[table].mask==0;_place(s,p,table,seat);
        Table storage t=s.tables[table];if(vacant)t.button=seat;t.nextBB=_count(t.mask)<2?seat:_bigBlind(t.mask,t.button);++t.epoch;
        s.consumedReceipt[p.receipt]=true;++s.players;++s.revision;
    }
}

// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./PokerTournamentPolicy420.sol";

/// @notice Native standings mechanics. Only a genuine canonical hand host may supply observations.
/// @dev Unit snapshots alone prove neither a poker hand nor elimination. No public winner setter exists.
library PokerTournamentStandings420 {
    enum Status { NONE, ACTIVE, REBUY_PENDING, ELIMINATED, CHAMPION }
    struct Person {
        Status status;uint32 generation;uint16 extraPurchases;uint64 receipt;uint64 rebuyUntil;
        uint32 eliminatedWave;uint32 eliminatedTable;uint8 tier;uint128 handStart;bytes32 hand;
    }
    struct Hand {bytes32[9] people;uint16 mask;bool consumed;}
    struct Book {
        bytes32 context;uint32 wave;uint32 live;uint32 pending;uint32 tierCursor;bool waveOpen;bool finished;
        bytes32 champion;bytes32 resultRoot;uint32 finalCursor;bytes32[] people;
        mapping(bytes32=>Person) byPerson;mapping(bytes32=>Hand) hands;
        mapping(bytes32=>uint32) rank;mapping(bytes32=>uint32) rankEnd;
    }
    error Invalid();error Pending();
    function initialize(Book storage s,bytes32 context)internal{if(context==0||s.context!=0)revert Invalid();s.context=context;}
    function enter(Book storage s,bytes32 person,uint64 receipt)internal {
        if(s.context==0||s.waveOpen||s.finished||person==0||receipt==0||s.byPerson[person].status!=Status.NONE||s.people.length>=576)revert Invalid();
        Person storage p=s.byPerson[person];p.status=Status.ACTIVE;p.generation=1;p.receipt=receipt;s.people.push(person);++s.live;
    }
    function open(Book storage s)internal {
        if(s.context==0||s.waveOpen||s.finished||s.pending!=0||s.live<2)revert Invalid();
        ++s.wave;s.waveOpen=true;s.tierCursor=0;
    }
    function observe(Book storage s,bytes32 hand,uint32 table,bytes32[9] memory people,uint16 mask,uint256[9] memory before_,uint256[9] memory after_,PokerTournamentPolicy420.Config memory c,uint64 started,uint16 level,uint64 now_)internal {
        if(!s.waveOpen||hand==0||table==0||s.hands[hand].consumed||mask==0||(mask>>9)!=0)revert Invalid();
        uint256 totalBefore=0;uint256 totalAfter=0;uint8 count=0;
        for(uint8 i;i<9;i++){
            if((mask&(uint16(1)<<i))==0){if(before_[i]!=0||after_[i]!=0||people[i]!=0)revert Invalid();continue;}
            bytes32 person=people[i];Person storage p=s.byPerson[person];
            if(person==0||p.status!=Status.ACTIVE||before_[i]==0||before_[i]>type(uint128).max||after_[i]>type(uint128).max)revert Invalid();
            for(uint8 j;j<i;j++)if(people[j]==person)revert Invalid();
            totalBefore+=before_[i];totalAfter+=after_[i];++count;
        }
        if(count<2||totalBefore!=totalAfter)revert Invalid();
        s.hands[hand]=Hand(people,mask,true);
        for(uint8 i;i<9;i++)if((mask&(uint16(1)<<i))!=0&&after_[i]==0){
            Person storage p=s.byPerson[people[i]];p.eliminatedWave=s.wave;p.eliminatedTable=table;p.handStart=uint128(before_[i]);p.hand=hand;p.tier=0;
            if(c.purchaseKind==PokerTournamentPolicy420.PurchaseKind.REBUY&&p.extraPurchases<c.extraCap&&PokerTournamentPolicy420.windowOpen(started,c.extraDuration,c.extraLevel,level,now_)){
                uint256 hard=uint256(started)+c.extraDuration;uint256 choice=uint256(now_)+c.rebuyChoice;p.rebuyUntil=uint64(choice<hard?choice:hard);
                if(p.rebuyUntil>now_){p.status=Status.REBUY_PENDING;++s.pending;continue;}
            }
            p.status=Status.ELIMINATED;--s.live;
        }
    }
    function expireRebuy(Book storage s,bytes32 person,uint64 now_)internal {
        Person storage p=s.byPerson[person];if(p.status!=Status.REBUY_PENDING||now_<p.rebuyUntil)revert Invalid();
        p.status=Status.ELIMINATED;p.rebuyUntil=0;--s.pending;--s.live;
    }
    function extraAllowed(Book storage s,bytes32 person,PokerTournamentPolicy420.Config memory c,uint64 started,uint16 level,uint64 now_)internal view returns(bool){
        Person storage p=s.byPerson[person];if(s.finished||p.extraPurchases>=c.extraCap||!PokerTournamentPolicy420.windowOpen(started,c.extraDuration,c.extraLevel,level,now_))return false;
        if(c.purchaseKind==PokerTournamentPolicy420.PurchaseKind.REBUY)return p.status==Status.REBUY_PENDING&&now_<p.rebuyUntil;
        return c.purchaseKind==PokerTournamentPolicy420.PurchaseKind.RE_ENTRY&&p.status==Status.ELIMINATED&&!s.waveOpen;
    }
    function restore(Book storage s,bytes32 person,uint64 receipt,PokerTournamentPolicy420.Config memory c,uint64 started,uint16 level,uint64 now_)internal {
        if(receipt==0||receipt<=s.byPerson[person].receipt||!extraAllowed(s,person,c,started,level,now_))revert Invalid();
        Person storage p=s.byPerson[person];
        if(p.status==Status.REBUY_PENDING)--s.pending;else {++s.live;++p.generation;}
        p.status=Status.ACTIVE;p.receipt=receipt;++p.extraPurchases;p.rebuyUntil=0;p.eliminatedWave=0;p.eliminatedTable=0;p.handStart=0;p.hand=0;p.tier=0;
    }
    /// @notice Canonical roster-order chunks make tier assignment independent of settlement transaction order.
    function tiers(Book storage s,uint32 limit)internal returns(bool done){
        if(!s.waveOpen||s.pending!=0||limit==0||limit>32)revert Pending();
        for(uint32 n;n<limit&&s.tierCursor<s.people.length;n++){
            Person storage p=s.byPerson[s.people[s.tierCursor++]];if(p.status!=Status.ELIMINATED||p.eliminatedWave!=s.wave)continue;
            Hand storage h=s.hands[p.hand];uint128[9] memory distinct=[uint128(0),0,0,0,0,0,0,0,0];uint8 values=0;
            for(uint8 i;i<9;i++)if((h.mask&(uint16(1)<<i))!=0){
                Person storage other=s.byPerson[h.people[i]];if(other.status!=Status.ELIMINATED||other.hand!=p.hand||other.handStart<=p.handStart)continue;
                bool seen=false;for(uint8 j;j<values;j++)if(distinct[j]==other.handStart)seen=true;
                if(!seen)distinct[values++]=other.handStart;
            }
            p.tier=values;
        }
        return s.tierCursor==s.people.length;
    }
    function close(Book storage s)internal {
        if(!s.waveOpen||s.pending!=0||s.tierCursor!=s.people.length||s.live==0)revert Pending();
        s.waveOpen=false;
        if(s.live==1){
            for(uint256 i;i<s.people.length;i++)if(s.byPerson[s.people[i]].status==Status.ACTIVE){s.champion=s.people[i];s.byPerson[s.people[i]].status=Status.CHAMPION;break;}
            if(s.champion==0)revert Invalid();s.finished=true;s.resultRoot=keccak256(abi.encode(s.context,s.wave,s.champion,uint32(s.people.length)));
        }
    }
    function _better(Person storage a,Person storage b)private view returns(bool){return a.status==Status.CHAMPION||(b.status!=Status.CHAMPION&&(a.eliminatedWave>b.eliminatedWave||(a.eliminatedWave==b.eliminatedWave&&a.tier<b.tier)));}
    function rankOf(Book storage s,bytes32 person)internal view returns(uint32 first,uint32 last){
        Person storage p=s.byPerson[person];if(!s.finished||(p.status!=Status.ELIMINATED&&p.status!=Status.CHAMPION))revert Invalid();
        first=1;uint32 tied=0;
        for(uint256 i;i<s.people.length;i++){
            Person storage other=s.byPerson[s.people[i]];
            if(s.people[i]!=person&&_better(other,p))++first;
            if((p.status==Status.CHAMPION&&s.people[i]==person)||(p.status==Status.ELIMINATED&&other.status==Status.ELIMINATED&&p.eliminatedWave==other.eliminatedWave&&p.tier==other.tier))++tied;
        }
        last=first+tied-1;
    }
    function finalize(Book storage s,uint32 limit)internal returns(bool done){
        if(!s.finished||limit==0||limit>16||s.finalCursor>=s.people.length)revert Invalid();
        for(uint32 n;n<limit&&s.finalCursor<s.people.length;n++){
            bytes32 person=s.people[s.finalCursor++];(uint32 first,uint32 last)=rankOf(s,person);s.rank[person]=first;s.rankEnd[person]=last;
            s.resultRoot=keccak256(abi.encode(s.resultRoot,person,s.byPerson[person].generation,s.byPerson[person].receipt,first,last));
        }
        return s.finalCursor==s.people.length;
    }
}

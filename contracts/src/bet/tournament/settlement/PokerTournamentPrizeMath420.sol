// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
/// @notice Exact integer prizes: rank rounding first; tied places share their combined prize.
library PokerTournamentPrizeMath420 {
    struct Row {bytes32 person;address payee;uint64 receipt;uint32 first;uint32 last;bytes32 priority;uint256 amount;bool claimed;}
    struct Rank {bytes32 person;uint32 first;uint32 last;bytes32 priority;}
    struct Totals {uint256[] prefix;uint256 remainder;}
    error InvalidPrizes();
    function snapshot(Row[] storage rows)internal view returns(Rank[] memory ranks){ranks=new Rank[](rows.length);for(uint256 i;i<rows.length;i++){Row storage r=rows[i];ranks[i]=Rank(r.person,r.first,r.last,r.priority);}}
    function base(uint256 pot,uint16 weight)internal pure returns(uint256){if(weight>10000)revert InvalidPrizes();return(pot/10000)*weight+((pot%10000)*weight)/10000;}
    function dust(uint256 pot,uint16[] memory weights)internal pure returns(uint256 remaining){uint256 total;uint256 sum;for(uint256 i;i<weights.length;i++){sum+=weights[i];total+=base(pot,weights[i]);}if(sum!=10000)revert InvalidPrizes();return pot-total;}
    function group(uint256 pot,uint16[] memory weights,uint32 first,uint32 last,uint256 remainder)internal pure returns(uint256 total){
        if(first==0||last<first)revert InvalidPrizes();for(uint256 rank=first;rank<=last&&rank<=weights.length;rank++)total+=base(pot,weights[rank-1])+(rank<=remainder?1:0);
    }
    function tied(uint256 total,uint32 count,uint32 priority)internal pure returns(uint256){if(count==0||priority>=count)revert InvalidPrizes();return total/count+(priority<total%count?1:0);}
    function totals(uint256 pot,uint16[] memory weights)internal pure returns(Totals memory amounts){
        uint256 length=weights.length;if(length==0||length>576)revert InvalidPrizes();amounts.prefix=new uint256[](length+1);uint256 sum;
        for(uint256 i;i<length;i++){sum+=weights[i];amounts.prefix[i+1]=amounts.prefix[i]+base(pot,weights[i]);}if(sum!=10000)revert InvalidPrizes();amounts.remainder=pot-amounts.prefix[length];
    }
    function assign(Rank[] memory rows,uint32 index,Totals memory amounts)internal pure returns(uint256 amount){
        Rank memory r=rows[index];uint32 first=r.first;uint32 last=r.last;bytes32 targetPriority=r.priority;bytes32 person=r.person;uint256 length=rows.length;uint32 count;uint32 priority;
        // Rank[] is a compiler-allocated memory array of struct pointers. Read only
        // its validated length and the fixed person/rank/priority fields. Bounded
        // comparisons avoid repeatedly copying full prize structs in a 576-way tie.
        assembly ("memory-safe") {
            let end := add(add(rows,32),mul(length,32))
            for { let cursor := add(rows,32) } lt(cursor,end) { cursor := add(cursor,32) } {
                let other := mload(cursor)
                if and(eq(mload(add(other,32)),first),eq(mload(add(other,64)),last)) {
                    count := add(count,1)
                    let candidate := mload(add(other,96))
                    if or(lt(candidate,targetPriority),and(eq(candidate,targetPriority),lt(mload(other),person))) { priority := add(priority,1) }
                }
            }
        }
        uint256[] memory prefix=amounts.prefix;if(first==0||last<first||count!=last-first+1||prefix.length<2)revert InvalidPrizes();uint256 paid=prefix.length-1;uint256 a=uint256(first)-1;uint256 hi=last<paid?last:paid;uint256 lo=a<paid?a:paid;uint256 rem=amounts.remainder;uint256 prize=prefix[hi]-prefix[lo]+(hi<rem?hi:rem)-(lo<rem?lo:rem);amount=tied(prize,count,priority);
    }
}

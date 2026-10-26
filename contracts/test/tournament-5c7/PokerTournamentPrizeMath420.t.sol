// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../../src/bet/tournament/settlement/PokerTournamentPrizeEscrow420.sol";
contract PrizeMathHarness420 {
 function share(uint256 pot,uint16[] memory w,uint32 first,uint32 last,uint32 ordinal)external pure returns(uint256){return PokerTournamentPrizeMath420.tied(PokerTournamentPrizeMath420.group(pot,w,first,last,PokerTournamentPrizeMath420.dust(pot,w)),last-first+1,ordinal);}
}
contract TournamentPrizeMath420Test {
 PrizeMathHarness420 private m;function setUp()public{m=new PrizeMathHarness420();}
 function weights()private pure returns(uint16[] memory w){w=new uint16[](3);w[0]=5000;w[1]=3000;w[2]=2000;}
 function testExactRankAndTiedOddUnits()public view{uint16[] memory w=weights();require(m.share(807,w,1,1,0)==404&&m.share(807,w,2,2,0)==242&&m.share(807,w,3,4,0)==81&&m.share(807,w,3,4,1)==80);}
 function testMaximumUint256PotHasNoMultiplyOverflow()public view{uint16[] memory w=new uint16[](1);w[0]=10000;require(m.share(type(uint256).max,w,1,1,0)==type(uint256).max);}
 function testMaximumUint256WeightedPrizeConservation()public view{uint16[] memory w=weights();uint256 pot=type(uint256).max;require(m.share(pot,w,1,1,0)+m.share(pot,w,2,2,0)+m.share(pot,w,3,3,0)==pot);PokerTournamentPrizeMath420.Totals memory prefix=PokerTournamentPrizeMath420.totals(pot,w);require(prefix.prefix[3]+prefix.remainder==pot);}
 function testMixedRankGroupsAndPriorityCollisionUseExactMemoryFields()public pure{uint16[] memory w=new uint16[](3);w[0]=5000;w[1]=3000;w[2]=2000;PokerTournamentPrizeMath420.Rank[] memory rows=new PokerTournamentPrizeMath420.Rank[](4);for(uint32 i;i<4;i++)rows[i]=PokerTournamentPrizeMath420.Rank(bytes32(uint256(4-i)),i<2?i+1:3,i<2?i+1:4,bytes32(uint256(77)));PokerTournamentPrizeMath420.Totals memory prefix=PokerTournamentPrizeMath420.totals(807,w);require(PokerTournamentPrizeMath420.assign(rows,0,prefix)==404&&PokerTournamentPrizeMath420.assign(rows,1,prefix)==242&&PokerTournamentPrizeMath420.assign(rows,2,prefix)==80&&PokerTournamentPrizeMath420.assign(rows,3,prefix)==81);}
 function testFull576PlayerTieConservesEveryUnit()public view{uint16[] memory w=weights();uint256 total;for(uint32 i;i<576;i++)total+=m.share(100003,w,1,576,i);require(total==100003);}
 function testFuzzTieAndRankAllocationConserves(uint128 pot,uint16 raw)public view{uint16[] memory w=weights();uint32 n=uint32(raw%574)+3;uint256 total=m.share(pot,w,1,1,0)+m.share(pot,w,2,2,0);for(uint32 i;i<n-2;i++)total+=m.share(pot,w,3,n,i);require(total==pot);PokerTournamentPrizeMath420.Totals memory prefix=PokerTournamentPrizeMath420.totals(pot,w);require(prefix.prefix[1]+(prefix.remainder>0?1:0)==m.share(pot,w,1,1,0)&&prefix.prefix[2]+(prefix.remainder<2?prefix.remainder:2)==m.share(pot,w,1,1,0)+m.share(pot,w,2,2,0)&&prefix.prefix[3]+prefix.remainder==pot);}
}

/// @dev Native, noncustodial unit snapshots; this harness cannot authenticate a hand or release money.
contract NativePrizeBookHarness420 {
 PokerTournamentPrizeMath420.Row[] private rows;
 function acceptsFunds()external pure returns(bool){return false;}
 function load(uint32 n)external{require(rows.length==0&&n<=576);for(uint32 i;i<n;i++)rows.push(PokerTournamentPrizeMath420.Row(bytes32(uint256(i)+1),address(0),uint64(i+1),1,n,bytes32(uint256(n)-i),0,false));}
 function allocate(uint32 start,uint32 n)external returns(uint256 total){uint16[] memory w=new uint16[](576);w[0]=9425;for(uint256 j=1;j<576;j++)w[j]=1;PokerTournamentPrizeMath420.Totals memory prefix=PokerTournamentPrizeMath420.totals(100003,w);PokerTournamentPrizeMath420.Rank[] memory snapshot=PokerTournamentPrizeMath420.snapshot(rows);for(uint32 i=start;i<start+n&&i<rows.length;i++){uint256 amount=PokerTournamentPrizeMath420.assign(snapshot,i,prefix);rows[i].amount=amount;total+=amount;}}
}
contract TournamentPrizeCapacity420Test {
 event PrizeAllocationChunkGas(uint32 players,uint32 paidPlaces,uint32 chunk,uint256 measuredGas,uint256 conservativeColdBound);
 function testFull576PlayerTieUsesBoundedEightRowChunks()public{NativePrizeBookHarness420 h=new NativePrizeBookHarness420();h.load(576);uint256 total;for(uint32 start;start<576;start+=8){uint256 before_=gasleft();total+=h.allocate(start,8);uint256 used=before_-gasleft();uint256 bound=used+576*6*2100+500000;require(bound<15000000);emit PrizeAllocationChunkGas(576,576,8,used,bound);}require(total==100003&&!h.acceptsFunds());}
}

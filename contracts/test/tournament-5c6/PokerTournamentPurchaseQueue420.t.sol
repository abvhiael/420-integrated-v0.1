// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../../src/bet/tournament/purchases/PokerTournamentPurchaseQueue420.sol";
contract C6QueueHarness420 {
    using PokerTournamentPurchaseQueue420 for PokerTournamentPurchaseQueue420.Queue;
    PokerTournamentPurchaseQueue420.Queue private q;
    function add(uint64 id,uint32 cap)external{q.append(id,cap);}
    function remove(uint64 id)external{q.remove(id);}
    function state()external view returns(uint64,uint64,uint32){return(q.head,q.tail,q.length);}
    function node(uint64 id)external view returns(uint64,uint64,bool){PokerTournamentPurchaseQueue420.Node memory n=q.nodes[id];return(n.previous,n.next,n.present);}
}
contract TournamentPurchaseQueue420Test {
    C6QueueHarness420 private q;
    function setUp()public{q=new C6QueueHarness420();}
    function testCapacity576AndConstantTimeMiddleRemoval()public{for(uint64 i=1;i<=576;i++)q.add(i,576);(bool ok,)=address(q).call(abi.encodeCall(q.add,(uint64(577),uint32(576))));require(!ok);q.remove(288);(uint64 a,uint64 b,bool present)=q.node(288);require(a==0&&b==0&&!present);(,b,)=q.node(287);require(b==289);(a,,)=q.node(289);require(a==287);q.add(577,576);(a,b,)=q.state();require(a==1&&b==577);}
    function testHeadTailAndEmptyUnlink()public{q.add(1,3);q.add(2,3);q.add(3,3);q.remove(1);q.remove(3);(uint64 h,uint64 t,uint32 n)=q.state();require(h==2&&t==2&&n==1);q.remove(2);(h,t,n)=q.state();require(h==0&&t==0&&n==0);q.add(4,3);(h,t,n)=q.state();require(h==4&&t==4&&n==1);}
    function testRejectsDuplicateOutOfOrderZeroAndInvalidCapacity()public{(bool ok,)=address(q).call(abi.encodeCall(q.add,(uint64(0),uint32(1))));require(!ok);(ok,)=address(q).call(abi.encodeCall(q.add,(uint64(1),uint32(577))));require(!ok);q.add(2,2);(ok,)=address(q).call(abi.encodeCall(q.add,(uint64(2),uint32(2))));require(!ok);(ok,)=address(q).call(abi.encodeCall(q.add,(uint64(1),uint32(2))));require(!ok);(ok,)=address(q).call(abi.encodeCall(q.remove,(uint64(9))));require(!ok);}
    function testFuzzQueueConservesLiveLinks(uint8 count,uint64 seed)public{uint64 n=uint64(count)+1;for(uint64 i=1;i<=n;i++)q.add(i,576);uint64 removed=seed%n+1;q.remove(removed);uint64 current;uint64 tail;uint32 length;(current,tail,length)=q.state();require(length==n-1);uint64 previous;uint32 visited;while(current!=0){(uint64 p,uint64 next,bool live)=q.node(current);require(live&&p==previous&&current!=removed);previous=current;current=next;visited++;require(visited<=n);}require(visited==length&&previous==tail);}
}

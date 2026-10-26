// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../tournament-5c2/PokerTournamentEntryEscrow420.t.sol";
import "../../src/bet/tournament/settlement/PokerTournamentPrizePolicies420.sol";
contract TournamentPrizePolicies420Test is EntryFixture420 {
 PokerTournamentPrizePolicies420 private p;bytes32 private constant PLAN=keccak256("prize rules");
 function setUp()public override{super.setUp();p=new PokerTournamentPrizePolicies420(address(policies));grant(address(this),p.REGISTER(),p.scope(PLAN));grant(address(this),p.APPROVE(),p.scope(PLAN));grant(address(this),p.PUBLISH(),p.scope(PLAN));}
 function terms()private pure returns(uint16[] memory n,uint16[][] memory w){n=new uint16[](2);n[0]=2;n[1]=576;w=new uint16[][](2);w[0]=new uint16[](1);w[0][0]=10000;w[1]=new uint16[](3);w[1][0]=5000;w[1][1]=3000;w[1][2]=2000;}
 function testPublishedUniquePlayerBandsAndTwoEntrantWinnerTakeAll()public{(uint16[] memory n,uint16[][] memory w)=terms();p.register(PLAN,OP,n,w);p.approve(PLAN);p.publish(PLAN);uint16[] memory a=p.select(PLAN,2);require(a.length==1&&a[0]==10000);a=p.select(PLAN,576);require(a.length==3&&a[2]==2000&&!p.acceptsFunds());}
 function testRejectsUnpublishedUnapprovedAndUnauthorizedRules()public{(uint16[] memory n,uint16[][] memory w)=terms();_fail(outsider,address(p),abi.encodeCall(p.register,(PLAN,OP,n,w)));p.register(PLAN,OP,n,w);_reject(address(p),abi.encodeCall(p.select,(PLAN,uint32(4))));_reject(address(p),abi.encodeCall(p.publish,(PLAN)));}
 function testRulesCannotBeOverwrittenOrReapproved()public{(uint16[] memory n,uint16[][] memory w)=terms();p.register(PLAN,OP,n,w);bytes32 digest=p.get(PLAN).digest;_reject(address(p),abi.encodeCall(p.register,(PLAN,OP,n,w)));p.approve(PLAN);p.publish(PLAN);_reject(address(p),abi.encodeCall(p.approve,(PLAN)));require(p.get(PLAN).digest==digest);}
 function testRejectsNonWinnerTakeAllTwoEntrantBand()public{(uint16[] memory n,uint16[][] memory w)=terms();w[0]=new uint16[](2);w[0][0]=5000;w[0][1]=5000;_reject(address(p),abi.encodeCall(p.register,(PLAN,OP,n,w)));}
 function testRejectsAscendingPrizesAndUnallocatedMoney()public{(uint16[] memory n,uint16[][] memory w)=terms();w[1][0]=2000;w[1][2]=5000;_reject(address(p),abi.encodeCall(p.register,(PLAN,OP,n,w)));w[1][0]=5000;w[1][2]=1999;_reject(address(p),abi.encodeCall(p.register,(PLAN,OP,n,w)));}
 function testRejectsPayoutPlacesBeyondSmallestFieldInBand()public{(uint16[] memory n,uint16[][] memory w)=terms();w[1]=new uint16[](4);for(uint8 i;i<4;i++)w[1][i]=2500;_reject(address(p),abi.encodeCall(p.register,(PLAN,OP,n,w)));}
 function testRejectsOverlappingOrUnsupportedCapacity()public{(uint16[] memory n,uint16[][] memory w)=terms();n[1]=2;_reject(address(p),abi.encodeCall(p.register,(PLAN,OP,n,w)));n[1]=577;_reject(address(p),abi.encodeCall(p.register,(PLAN,OP,n,w)));}
}

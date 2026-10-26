// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../../src/bet/tournament/PokerTournamentStandings420.sol";

/// @dev Arithmetic/lifecycle harness only. None of these snapshots authenticate a poker outcome.
contract TournamentStandingsMathHarness420 {
    using PokerTournamentStandings420 for PokerTournamentStandings420.Book;
    PokerTournamentStandings420.Book private b;PokerTournamentPolicy420.Config private c;
    constructor(uint8 kind){b.initialize(keccak256("standings mathematical context"));c.purchaseKind=PokerTournamentPolicy420.PurchaseKind(kind);c.extraCap=2;c.extraDuration=1000;c.rebuyChoice=60;}
    function enter(uint256 id,uint64 receipt)external{b.enter(bytes32(id),receipt);}
    function open()external{b.open();}
    function observe(bytes32 hand,uint32 table,uint256[9] calldata ids,uint256[9] calldata before_,uint256[9] calldata after_,uint64 now_)external{
        bytes32[9] memory people;uint16 mask;for(uint8 i;i<9;i++)if(ids[i]!=0){people[i]=bytes32(ids[i]);mask|=uint16(1)<<i;}
        b.observe(hand,table,people,mask,before_,after_,c,100,1,now_);
    }
    function close()external{while(!b.tiers(32)){}b.close();}
    function expire(uint256 id,uint64 now_)external{b.expireRebuy(bytes32(id),now_);}
    function restore(uint256 id,uint64 receipt,uint64 now_)external{b.restore(bytes32(id),receipt,c,100,1,now_);}
    function allowed(uint256 id,uint64 now_)external view returns(bool){return b.extraAllowed(bytes32(id),c,100,1,now_);}
    function finalize(uint32 n)external returns(bool){return b.finalize(n);}
    function rank(uint256 id)external view returns(uint32,uint32){return b.rankOf(bytes32(id));}
    function person(uint256 id)external view returns(PokerTournamentStandings420.Person memory){return b.byPerson[bytes32(id)];}
    function status()external view returns(uint32,uint32,bool,bytes32,bytes32){return(b.live,b.pending,b.finished,b.champion,b.resultRoot);}
}
contract TournamentStandingsNative420Test {
    TournamentStandingsMathHarness420 private h;
    function setUp()public{h=new TournamentStandingsMathHarness420(0);}
    function reject(bytes memory data)private{(bool ok,)=address(h).call(data);require(!ok,"unexpected native acceptance");}
    function enter(uint32 n)private{for(uint32 i=1;i<=n;i++)h.enter(i,uint64(i));}
    function duel(uint256 a,uint256 b,uint256 x,uint256 y,uint256 ax,uint256 by,uint64 now_)private{uint256[9] memory ids;uint256[9] memory before_;uint256[9] memory after_;ids[0]=a;ids[1]=b;before_[0]=x;before_[1]=y;after_[0]=ax;after_[1]=by;h.observe(keccak256(abi.encode(a,b,now_)),1,ids,before_,after_,now_);}
    function testLegitimateSingleWinnerAndDistinctRanks()public{enter(2);h.open();duel(1,2,100,100,200,0,200);h.close();(uint32 a,uint32 b)=h.rank(1);require(a==1&&b==1);(a,b)=h.rank(2);require(a==2&&b==2);require(h.finalize(1)==false&&h.finalize(1));}
    function testNoRankBeforeAllHandsAndPendingChoicesResolve()public{enter(2);h.open();reject(abi.encodeCall(h.rank,(uint256(1))));}
    function testSameHandEqualStartingStacksTie()public{enter(3);h.open();uint256[9] memory ids=[uint256(1),2,3,0,0,0,0,0,0];uint256[9] memory before_=[uint256(100),100,300,0,0,0,0,0,0];uint256[9] memory after_=[uint256(0),0,500,0,0,0,0,0,0];h.observe(keccak256("same hand"),1,ids,before_,after_,200);h.close();(uint32 a,uint32 b)=h.rank(1);require(a==2&&b==3);(a,b)=h.rank(2);require(a==2&&b==3);}
    function testSameHandLargerStartingStackFinishesHigher()public{enter(3);h.open();uint256[9] memory ids=[uint256(1),2,3,0,0,0,0,0,0];uint256[9] memory before_=[uint256(100),200,300,0,0,0,0,0,0];uint256[9] memory after_=[uint256(0),0,600,0,0,0,0,0,0];h.observe(keccak256("same hand"),1,ids,before_,after_,200);h.close();(uint32 a,)=h.rank(2);require(a==2);(a,)=h.rank(1);require(a==3);}
    function mixed(bool reverse)private {
        uint256[9] memory a=[uint256(1),2,3,4,0,0,0,0,0];uint256[9] memory ab=[uint256(100),200,300,400,0,0,0,0,0];uint256[9] memory aa=[uint256(0),0,0,1000,0,0,0,0,0];
        uint256[9] memory b=[uint256(5),6,7,0,0,0,0,0,0];uint256[9] memory bb=[uint256(100),500,200,0,0,0,0,0,0];uint256[9] memory ba=[uint256(0),0,800,0,0,0,0,0,0];
        if(reverse){h.observe(keccak256("table B"),2,b,bb,ba,200);h.observe(keccak256("table A"),1,a,ab,aa,200);}else{h.observe(keccak256("table A"),1,a,ab,aa,200);h.observe(keccak256("table B"),2,b,bb,ba,200);}
    }
    function mixedFinish(bool reverse)private returns(bytes32){enter(7);h.open();mixed(reverse);h.close();h.open();duel(4,7,1000,800,1800,0,300);h.close();while(!h.finalize(2)){}(,,,,bytes32 root)=h.status();return root;}
    function testMixedTablesTieCorrespondingLocalTiers()public{mixedFinish(false);(uint32 a,uint32 b)=h.rank(3);require(a==3&&b==4);(a,b)=h.rank(6);require(a==3&&b==4);(a,b)=h.rank(2);require(a==5&&b==6);(a,b)=h.rank(5);require(a==5&&b==6);(a,b)=h.rank(1);require(a==7&&b==7);}
    function testSettlementTransactionOrderDoesNotChangeStandingsRoot()public{bytes32 forward=mixedFinish(false);h=new TournamentStandingsMathHarness420(0);require(forward==mixedFinish(true));}
    function testDuplicatePersonAndReceiptlessEntryRejected()public{h.enter(1,1);reject(abi.encodeCall(h.enter,(uint256(1),uint64(2))));reject(abi.encodeCall(h.enter,(uint256(2),uint64(0))));}
    function testCompletedEventCannotReopen()public{enter(2);h.open();duel(1,2,100,100,200,0,200);h.close();reject(abi.encodeCall(h.open,()));reject(abi.encodeCall(h.enter,(uint256(3),uint64(3))));}
    function testNonconservingOutcomeRejected()public{enter(2);h.open();reject(abi.encodeWithSignature("observe(bytes32,uint32,uint256[9],uint256[9],uint256[9],uint64)",keccak256("bad"),uint32(1),[uint256(1),2,0,0,0,0,0,0,0],[uint256(100),100,0,0,0,0,0,0,0],[uint256(201),0,0,0,0,0,0,0,0],uint64(200)));}
    function testNoZeroStackWinnerByAllZeroVector()public{enter(2);h.open();uint256[9] memory ids=[uint256(1),2,0,0,0,0,0,0,0];uint256[9] memory before_=[uint256(100),100,0,0,0,0,0,0,0];uint256[9] memory after_;reject(abi.encodeCall(h.observe,(keccak256("zero"),uint32(1),ids,before_,after_,uint64(200))));}
    function testRebuyDecisionKeepsTournamentOpen()public{h=new TournamentStandingsMathHarness420(2);enter(2);h.open();duel(1,2,100,100,200,0,200);(uint32 live,uint32 pending,bool finished,,)=h.status();require(live==2&&pending==1&&!finished);reject(abi.encodeCall(h.close,()));require(h.allowed(2,259));h.restore(2,3,259);require(h.person(2).generation==1&&h.person(2).status==PokerTournamentStandings420.Status.ACTIVE);h.close();}
    function testRebuyExpiryAtExactDeadlineEliminates()public{h=new TournamentStandingsMathHarness420(2);enter(2);h.open();duel(1,2,100,100,200,0,200);require(!h.allowed(2,260));reject(abi.encodeCall(h.restore,(uint256(2),uint64(3),uint64(260))));h.expire(2,260);h.close();(uint32 a,)=h.rank(2);require(a==2);}
    function testRebuyCannotExpireEarly()public{h=new TournamentStandingsMathHarness420(2);enter(2);h.open();duel(1,2,100,100,200,0,200);reject(abi.encodeCall(h.expire,(uint256(2),uint64(259))));}
    function testReentryCreatesFreshGenerationAndOneFinalFinish()public{h=new TournamentStandingsMathHarness420(1);enter(3);h.open();duel(1,2,100,100,200,0,200);h.close();h.restore(2,4,201);require(h.person(2).generation==2);h.open();duel(1,2,200,100,300,0,300);h.close();h.open();duel(1,3,300,100,400,0,400);h.close();(uint32 a,uint32 b)=h.rank(2);require(a==3&&b==3);}
    function testFreezeoutRejectsAnyExtraPurchase()public{enter(3);h.open();duel(1,2,100,100,200,0,200);h.close();require(!h.allowed(2,201));reject(abi.encodeCall(h.restore,(uint256(2),uint64(4),uint64(201))));}
    function testReceiptReplayCannotRestoreStack()public{h=new TournamentStandingsMathHarness420(2);enter(2);h.open();duel(1,2,100,100,200,0,200);reject(abi.encodeCall(h.restore,(uint256(2),uint64(2),uint64(201))));}
    function testActiveStackCannotRebuy()public{h=new TournamentStandingsMathHarness420(2);enter(2);require(!h.allowed(1,200));reject(abi.encodeCall(h.restore,(uint256(1),uint64(3),uint64(200))));}
    function testHardPurchaseCutoffWinsOverFreshRebuyTimer()public{h=new TournamentStandingsMathHarness420(2);enter(2);h.open();duel(1,2,100,100,200,0,1100);(uint32 live,uint32 pending,,,)=h.status();require(live==1&&pending==0&&!h.allowed(2,1100));h.close();}
    function testRebuyCapSurvivesEveryRestoration()public{
        h=new TournamentStandingsMathHarness420(2);enter(2);h.open();duel(1,2,100,100,200,0,200);h.restore(2,3,201);h.close();h.open();duel(1,2,100,100,200,0,300);h.restore(2,4,301);h.close();h.open();duel(1,2,100,100,200,0,400);require(!h.allowed(2,401)&&h.person(2).extraPurchases==2);h.close();
    }
    function testLaterEliminationOutranksEarlierLargeStack()public{enter(3);h.open();duel(1,2,1000,2000,3000,0,200);h.close();h.open();duel(1,3,3000,1,3001,0,300);h.close();(uint32 a,)=h.rank(3);require(a==2);(a,)=h.rank(2);require(a==3);}
    function testCanonicalHandObservationCannotReplay()public{enter(3);h.open();duel(1,2,100,100,200,0,200);uint256[9] memory ids=[uint256(1),2,0,0,0,0,0,0,0];uint256[9] memory before_=[uint256(100),100,0,0,0,0,0,0,0];uint256[9] memory after_=[uint256(200),0,0,0,0,0,0,0,0];reject(abi.encodeCall(h.observe,(keccak256(abi.encode(uint256(1),uint256(2),uint64(200))),uint32(1),ids,before_,after_,uint64(200))));}
    event FinalizationChunkGas(uint32 players,uint32 chunk,uint256 gasUsed);
    function testFull576PlayerStandingsAndBoundedFinalization()public{
        enter(576);h.open();
        for(uint32 table;table<64;table++){
            uint256[9] memory ids;uint256[9] memory before_;uint256[9] memory after_;for(uint8 i;i<9;i++){ids[i]=uint256(table)*9+i+1;before_[i]=1000;}after_[0]=9000;
            h.observe(keccak256(abi.encode("first wave",table)),table+1,ids,before_,after_,200);
        }
        h.close();h.open();for(uint32 table;table<8;table++){
            uint256[9] memory ids;uint256[9] memory before_;uint256[9] memory after_;for(uint8 i;i<8;i++){ids[i]=(uint256(table)*8+i)*9+1;before_[i]=9000;}after_[0]=72000;
            h.observe(keccak256(abi.encode("second wave",table)),table+1,ids,before_,after_,300);
        }
        h.close();h.open();uint256[9] memory lastIds;uint256[9] memory lastBefore;uint256[9] memory lastAfter;
        for(uint8 i;i<8;i++){lastIds[i]=uint256(i)*72+1;lastBefore[i]=72000;}lastAfter[0]=576000;h.observe(keccak256("final mathematical wave"),1,lastIds,lastBefore,lastAfter,400);h.close();
        // Eight-player transactions keep the worst-case cold-storage ranking scan
        // below the published 15M budget; the contract still permits smaller chunks.
        bool done;uint32 chunks;while(!done){uint256 gasBefore=gasleft();done=h.finalize(8);uint256 used=gasBefore-gasleft();require(used<15000000);emit FinalizationChunkGas(576,8,used);chunks++;}require(chunks==72);
        (uint32 a,uint32 b)=h.rank(1);require(a==1&&b==1);(a,b)=h.rank(2);require(a==65&&b==576);(a,b)=h.rank(10);require(a==9&&b==64);(a,b)=h.rank(73);require(a==2&&b==8);
    }
    function testFinalizationMustUseBoundedNonzeroChunks()public{enter(2);h.open();duel(1,2,100,100,200,0,200);h.close();reject(abi.encodeCall(h.finalize,(uint32(0))));reject(abi.encodeCall(h.finalize,(uint32(17))));}
    function testFuzzEqualStackEliminationsAlwaysTie(uint64 value)public{uint256 n=uint256(value)+1;enter(3);h.open();uint256[9] memory ids=[uint256(1),2,3,0,0,0,0,0,0];uint256[9] memory before_=[n,n,n,0,0,0,0,0,0];uint256[9] memory after_=[uint256(0),0,n*3,0,0,0,0,0,0];h.observe(keccak256("fuzz tie"),1,ids,before_,after_,200);h.close();(uint32 a,uint32 b)=h.rank(1);require(a==2&&b==3);}
}

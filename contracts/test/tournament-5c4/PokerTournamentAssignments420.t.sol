// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../../src/bet/tournament/PokerTournamentAssignments420.sol";
import "../../src/randomness/RandomnessRegistry.sol";
import "../tournament-5c2/PokerTournamentEntryEscrow420.t.sol";

contract TournamentAssignmentsFunded420Test is EntryFixture420 {
    PokerTournamentStructureBook420 private book;
    SeatingRouter420 private rng;
    RandomnessProfileRegistry420 private profiles;
    RandomnessRouteRegistry420 private routes;
    PokerTournamentSeatingEntropy420 private entropy;
    PokerTournamentAssignments420 private seating;
    EntryActor420 private p0;EntryActor420 private p1;
    bytes32 private constant PROFILE=keccak256("seating profile");bytes32 private constant ROUTE=keccak256("seating route");
    bytes32 private constant STRUCTURE=keccak256("structure");bytes32 private constant S0=keccak256("secret zero");bytes32 private constant S1=keccak256("secret one");
    bytes32 private purpose;bytes32 private providerGrant;
    event SeatingEvidence(address router,bytes32 routerHash,address verifier,bytes32 verifierHash,bytes32 requestId,bytes32 rosterRoot,bytes32 word,bytes proof,bytes32 root,bytes32 proofHash,bytes32 assignments);
    function setUp()public override {
        super.setUp();book=new PokerTournamentStructureBook420(address(policies),address(escrow));
        profiles=new RandomnessProfileRegistry420(address(this));routes=new RandomnessRouteRegistry420(address(this));RandomnessRegistry registry=new RandomnessRegistry(address(this));
        rng=new SeatingRouter420(address(profiles),address(routes),address(registry));registry.bindRouter(address(rng));
        p0=new EntryActor420();p1=new EntryActor420();
        _identity(p0,keccak256("provider0"),keccak256("provider0 credential"),keccak256("provider person0"));
        _identity(p1,keccak256("provider1"),keccak256("provider1 credential"),keccak256("provider person1"));
        address[2] memory actors=[address(p0),address(p1)];bytes32[2] memory subjects=[keccak256("provider0"),keccak256("provider1")];bytes32[2] memory credentials=[keccak256("provider0 credential"),keccak256("provider1 credential")];
        entropy=new PokerTournamentSeatingEntropy420(address(escrow),address(rng),actors,subjects,credentials);seating=new PokerTournamentAssignments420(address(book),address(rng),address(entropy));
        routes.setRoute(ROUTE,address(seating),address(entropy),entropy.METHOD(),bytes32(0),keccak256("two independent providers deployment obligation"),true);
        profiles.setProfile(PROFILE,ROUTE,0,300,300,2,0,keccak256("no fallback"),true);
        grant(address(this),book.CREATE(),book.scope(STRUCTURE,0));grant(address(this),book.APPROVE(),book.scope(STRUCTURE,0));grant(address(this),book.PUBLISH(),book.scope(STRUCTURE,0));
        grant(address(this),book.BIND_POLICY(),book.scope(POLICY,1));grant(address(this),book.BIND_EVENT(),book.scope(EVENT,2));grant(address(this),seating.BIND(),seating.scope(EVENT));
        PokerTournamentStructure420.Level[] memory levels=new PokerTournamentStructure420.Level[](1);levels[0]=PokerTournamentStructure420.Level(5,10,60);
        book.register(STRUCTURE,OP,1000,levels);book.approve(STRUCTURE);book.publish(STRUCTURE);
        PokerTournamentPolicy420.Config memory c=config();c.multiTable=true;c.maxTables=64;c.maxPlayers=576;c.blindSchedule=book.structureOf(STRUCTURE).digest;c.seatingPolicy=seating.policyDigest(PROFILE,300);
        _publish(c);book.bindPolicy(POLICY,STRUCTURE);book.bindEvent(EVENT);seating.bind(EVENT,PROFILE,300);purpose=seating.eventOf(EVENT).purpose;
        providerGrant=grant(address(p0),entropy.PROVIDE(),entropy.scope(address(seating),purpose));grant(address(p1),entropy.PROVIDE(),entropy.scope(address(seating),purpose));
    }
    function commits()private {
        p0.invoke(address(entropy),abi.encodeCall(entropy.commit,(address(seating),purpose,entropy.commitment(address(seating),purpose,0,S0))));
        p1.invoke(address(entropy),abi.encodeCall(entropy.commit,(address(seating),purpose,entropy.commitment(address(seating),purpose,1,S1))));
    }
    function funded()private {vm.warp(200);_buy(alice,A,AC,1);_buy(bob,B,BC,1);vm.warp(400);}
    function requested()private {commits();funded();seating.loadRoster(EVENT,128);}
    function reveals()private {
        p0.invoke(address(entropy),abi.encodeCall(entropy.reveal,(address(seating),purpose,S0)));
        p1.invoke(address(entropy),abi.encodeCall(entropy.reveal,(address(seating),purpose,S1)));
    }
    function complete()private {requested();reveals();seating.resolve(EVENT);seating.shuffle(EVENT,128);seating.assign(EVENT,128);}
    function testLegitimateFundedRosterGenuineProofAndAssignments()public {
        complete();PokerTournamentAssignments420.Event memory e=seating.eventOf(EVENT);
        require(e.stage==PokerTournamentAssignments420.Stage.READY&&seating.assignmentLive(EVENT)&&seating.rosterCount(EVENT)==2&&seating.tableCount(EVENT)==1);
        bytes32 a=escrow.entryOf(EVENT,1).person;bytes32 b=escrow.entryOf(EVENT,2).person;
        PokerTournamentTableBalance420.Player memory x=seating.player(EVENT,a);PokerTournamentTableBalance420.Player memory y=seating.player(EVENT,b);
        require(x.seated&&y.seated&&x.seat!=y.seat&&x.chips==1000&&y.chips==1000&&x.payer==address(alice)&&x.receipt==1);
        require(book.reservedPlayers(EVENT)==0,"optional reservation must not gate paid roster");
        require(escrow.heldPrizes()==200&&escrow.heldFees()==6&&!seating.liveHandIntegrationEnabled());_invariant();
        (bytes32 word,bytes memory proof)=entropy.proofFor(address(seating),purpose);
        emit SeatingEvidence(address(rng),address(rng).codehash,address(entropy),address(entropy).codehash,e.requestId,e.rosterRoot,word,proof,e.seed,e.proofHash,e.assignmentRoot);
        require(e.proofHash==keccak256(proof));
    }
    function testWrongSecretCannotReveal()public {requested();_fail(p0,address(entropy),abi.encodeCall(entropy.reveal,(address(seating),purpose,S1)));}
    function testWrongProviderCannotCommit()public {_fail(alice,address(entropy),abi.encodeCall(entropy.commit,(address(seating),purpose,S0)));}
    function testCommitOnceNoReplacement()public {commits();_fail(p0,address(entropy),abi.encodeCall(entropy.commit,(address(seating),purpose,S1)));}
    function testRevealBeforeRequestRejected()public {commits();_fail(p0,address(entropy),abi.encodeCall(entropy.reveal,(address(seating),purpose,S0)));}
    function testMissingCommitFailsClosedWithoutRequest()public {funded();_reject(address(seating),abi.encodeCall(seating.loadRoster,(EVENT,uint32(128))));require(rng.requesterNonce(address(seating))==0);}
    function testLateCommitAtRosterLockRejected()public {funded();_fail(p0,address(entropy),abi.encodeCall(entropy.commit,(address(seating),purpose,S0)));}
    function testProofBeforeBothRevealsRejected()public {requested();p0.invoke(address(entropy),abi.encodeCall(entropy.reveal,(address(seating),purpose,S0)));_reject(address(seating),abi.encodeCall(seating.resolve,(EVENT)));}
    function testMalformedProofRejectedByActualRouter()public {requested();reveals();_reject(address(seating),abi.encodeCall(seating.fulfill,(EVENT,S0,hex"00")));}
    function testFabricatedWordRejectedByActualRouter()public {requested();reveals();_reject(address(seating),abi.encodeCall(seating.fulfill,(EVENT,S0,abi.encode(S0,S1))));}
    function testSwappedProofSecretsRejectedByActualRouter()public {requested();reveals();(bytes32 word,)=entropy.proofFor(address(seating),purpose);_reject(address(seating),abi.encodeCall(seating.fulfill,(EVENT,word,abi.encode(S1,S0))));}
    function testDirectCallerCannotBypassRouteOperator()public {requested();reveals();(bytes32 word,bytes memory proof)=entropy.proofFor(address(seating),purpose);_reject(address(rng),abi.encodeCall(rng.fulfillRandomness,(seating.eventOf(EVENT).requestId,word,proof)));}
    function testWrongContextVerifierReturnsFalse()public {requested();reveals();(bytes32 word,bytes memory proof)=entropy.proofFor(address(seating),purpose);require(!entropy.verifyRandomness(seating.eventOf(EVENT).requestId,RandomnessIds420.DOMAIN_BET,keccak256("other purpose"),word,proof));}
    function testRevokedAuthorityAfterRevealFailsClosed()public {requested();reveals();caps.revokeGrant(providerGrant);_reject(address(seating),abi.encodeCall(seating.resolve,(EVENT)));}
    function testRevokedIdentityAfterRevealFailsClosed()public {requested();reveals();identity.revokeCredential(keccak256("provider0 credential"));_reject(address(seating),abi.encodeCall(seating.resolve,(EVENT)));}
    function testOneProviderWithholdingNoFallbackOrRedraw()public {
        requested();p0.invoke(address(entropy),abi.encodeCall(entropy.reveal,(address(seating),purpose,S0)));bytes32 id=seating.eventOf(EVENT).requestId;
        _reject(address(rng),abi.encodeCall(rng.activateFallback,(id)));vm.warp(701);seating.expire(EVENT);require(rng.status(id)==IRandomnessRouter420.Status.VOIDED);
        _reject(address(seating),abi.encodeCall(seating.loadRoster,(EVENT,uint32(128))));require(rng.requesterNonce(address(seating))==1);
        vm.warp(1000);escrow.tick(EVENT);escrow.refundCancelled(EVENT,1);escrow.refundCancelled(EVENT,2);require(escrow.totalCredits()==206);_invariant();
    }
    function testExactEntropyDeadlineAllowedButLaterRevealRejected()public {requested();vm.warp(700);p0.invoke(address(entropy),abi.encodeCall(entropy.reveal,(address(seating),purpose,S0)));vm.warp(701);_fail(p1,address(entropy),abi.encodeCall(entropy.reveal,(address(seating),purpose,S1)));}
    function testReplayedResolutionRejected()public {complete();_reject(address(seating),abi.encodeCall(seating.resolve,(EVENT)));}
    function testFulfilledDrawCannotBeGriefExpiredDuringChunkProcessing()public {
        requested();reveals();seating.resolve(EVENT);vm.warp(701);_reject(address(seating),abi.encodeCall(seating.expire,(EVENT)));
        seating.shuffle(EVENT,1);_reject(address(seating),abi.encodeCall(seating.expire,(EVENT)));seating.assign(EVENT,1);
        _reject(address(seating),abi.encodeCall(seating.expire,(EVENT)));seating.assign(EVENT,1);require(seating.assignmentLive(EVENT));
    }
    function testNoCallerSelectedSeedOrMovementAuthority()public {complete();(bool ok,)=address(seating).call(abi.encodeWithSignature("setSeed(bytes32,bytes32)",EVENT,S0));require(!ok);(ok,)=address(seating).call(abi.encodeWithSignature("move(bytes32,bytes32,uint32,uint8)",EVENT,A,uint32(1),uint8(1)));require(!ok);}
    function testPrematureRosterAndZeroChunkRejected()public {commits();_reject(address(seating),abi.encodeCall(seating.loadRoster,(EVENT,uint32(128))));funded();_reject(address(seating),abi.encodeCall(seating.loadRoster,(EVENT,uint32(0))));_reject(address(seating),abi.encodeCall(seating.loadRoster,(EVENT,uint32(129))));}
    function testChunkedRosterIncludesAllPaidPlayers()public {commits();funded();seating.loadRoster(EVENT,1);require(seating.eventOf(EVENT).stage==PokerTournamentAssignments420.Stage.LOADING&&seating.rosterCount(EVENT)==1);outsider.invoke(address(seating),abi.encodeCall(seating.loadRoster,(EVENT,uint32(1))));require(seating.rosterCount(EVENT)==2);}
    function testRefundedReceiptSkippedCanonicalReplacementRetained()public {commits();vm.warp(200);_buy(alice,A,AC,1);alice.invoke(address(escrow),abi.encodeCall(escrow.unregister,(EVENT,uint64(1),uint64(1))));_buy(alice,A,AC,2);_buy(bob,B,BC,1);vm.warp(400);seating.loadRoster(EVENT,128);reveals();seating.resolve(EVENT);seating.shuffle(EVENT,1);seating.assign(EVENT,1);seating.assign(EVENT,1);require(seating.player(EVENT,escrow.entryOf(EVENT,2).person).receipt==2&&seating.rosterCount(EVENT)==2);_invariant();}
    function testExpiredAssignmentViewFailsWithoutKeeper()public {complete();vm.warp(1000);require(!seating.assignmentLive(EVENT));_reject(address(seating),abi.encodeCall(seating.assign,(EVENT,uint32(1))));require(seating.player(EVENT,escrow.entryOf(EVENT,1).person).chips==1000);}
    function testProfileMutationBeforeRequestFailsClosed()public {commits();funded();profiles.setProfile(PROFILE,ROUTE,0,300,300,2,0,keccak256("changed"),true);_reject(address(seating),abi.encodeCall(seating.loadRoster,(EVENT,uint32(128))));}
    function testRouteMutationAfterRequestPreservesPinnedVerifier()public {requested();routes.setRoute(ROUTE,address(outsider),address(outsider),keccak256("changed"),0,0,true);reveals();seating.resolve(EVENT);seating.shuffle(EVENT,128);seating.assign(EVENT,128);require(seating.assignmentLive(EVENT));}
    function testRebindAndOperatorRedrawForbidden()public {_reject(address(seating),abi.encodeCall(seating.bind,(EVENT,PROFILE,uint32(300))));complete();_reject(address(seating),abi.encodeCall(seating.shuffle,(EVENT,uint32(1))));require(rng.requesterNonce(address(seating))==1);}
    function testAnyoneMayRelayGenuineProof()public {requested();reveals();(bytes32 word,bytes memory proof)=entropy.proofFor(address(seating),purpose);outsider.invoke(address(seating),abi.encodeCall(seating.fulfill,(EVENT,word,proof)));require(rng.status(seating.eventOf(EVENT).requestId)==IRandomnessRouter420.Status.FULFILLED);}
    function testChunkedAndUnchunkedPermutationMatchesIndependentDraw()public {requested();reveals();seating.resolve(EVENT);(bytes32 seed,)=rng.result(seating.eventOf(EVENT).requestId);PokerTournamentAssignments420.Event memory e=seating.eventOf(EVENT);uint256 j=RandomnessDraw420.boundedUint(seed,keccak256(abi.encode(seating.DOMAIN(),e.purpose,e.rosterRoot,e.requestId)),1,2);seating.shuffle(EVENT,1);seating.assign(EVENT,1);seating.assign(EVENT,1);bytes32 expected=escrow.entryOf(EVENT,j==0?2:1).person;require(seating.occupant(EVENT,1,0)==expected);}
    function testProviderCannotParticipateInPaidRoster()public {
        commits();vm.warp(200);_buy(alice,A,AC,1);_buy(bob,B,BC,1);_fund(p0,1000);grant(address(p0),escrow.ENTER(),escrow.scope(EVENT));_buy(p0,keccak256("provider0"),keccak256("provider0 credential"),1);vm.warp(400);
        _reject(address(seating),abi.encodeCall(seating.loadRoster,(EVENT,uint32(128))));require(rng.requesterNonce(address(seating))==0);_invariant();
    }
    event ChunkGas(bytes32 phase,uint32 chunk,uint256 gasUsed);
    function testFullFunded576Player64TableChunkedQualification()public {
        commits();vm.warp(200);_buy(alice,A,AC,1);_buy(bob,B,BC,1);
        for(uint256 i=2;i<576;i++){
            EntryActor420 actor=new EntryActor420();bytes32 subject=keccak256(abi.encode("scaled subject",i));bytes32 credential=keccak256(abi.encode("scaled credential",i));
            _identity(actor,subject,credential,keccak256(abi.encode("scaled verified person",i)));_fund(actor,103);grant(address(actor),escrow.ENTER(),escrow.scope(EVENT));_buy(actor,subject,credential,1);
        }
        vm.warp(400);uint256 gasBefore;
        while(seating.eventOf(EVENT).stage==PokerTournamentAssignments420.Stage.BOUND||seating.eventOf(EVENT).stage==PokerTournamentAssignments420.Stage.LOADING){gasBefore=gasleft();seating.loadRoster(EVENT,32);uint256 used=gasBefore-gasleft();require(used<15000000);emit ChunkGas("ROSTER",32,used);}
        reveals();seating.resolve(EVENT);
        while(seating.eventOf(EVENT).stage==PokerTournamentAssignments420.Stage.REQUESTED||seating.eventOf(EVENT).stage==PokerTournamentAssignments420.Stage.SHUFFLING){gasBefore=gasleft();seating.shuffle(EVENT,32);uint256 used=gasBefore-gasleft();require(used<15000000);emit ChunkGas("SHUFFLE",32,used);}
        while(seating.eventOf(EVENT).stage==PokerTournamentAssignments420.Stage.ASSIGNING){gasBefore=gasleft();seating.assign(EVENT,32);uint256 used=gasBefore-gasleft();require(used<15000000);emit ChunkGas("ASSIGN",32,used);}
        require(seating.assignmentLive(EVENT)&&seating.tableCount(EVENT)==64&&escrow.heldPrizes()==57600&&escrow.heldFees()==1728&&escrow.totalLiability()==59328);
        for(uint32 i=1;i<=64;i++){require(seating.tableOf(EVENT,i).mask==511);for(uint8 j=0;j<9;j++){bytes32 person=seating.occupant(EVENT,i,j);PokerTournamentTableBalance420.Player memory p=seating.player(EVENT,person);require(person!=0&&p.table==i&&p.seat==j&&p.chips==1000&&p.seated);}}
        _invariant();
    }
}

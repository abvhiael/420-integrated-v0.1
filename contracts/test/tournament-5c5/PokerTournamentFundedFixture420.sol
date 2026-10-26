// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../tournament-5c2/PokerTournamentEntryEscrow420.t.sol";
import "../../src/bet/tournament/PokerTournamentHost420.sol";
import "../../src/bet/tournament/PokerTournamentRoundEntropy420.sol";
import "../../src/randomness/RandomnessRegistry.sol";
import "../../src/bet/PokerGnarkElGamalAdapters420.sol";
import "../../src/bet/PokerNativeOutcome420.sol";
import "../../src/bet/PokerLiveCardReveals420.sol";
import "../../src/bet/tournament/generated/C5VerifierData.sol";
import "../../src/bet/tournament/generated/C5InitialDeck52Verifier.sol";
import "../../src/bet/tournament/generated/C5Reencrypt52Verifier.sol";
import "../../src/bet/tournament/generated/C5DeliveryVerifier.sol";
import "../../src/bet/tournament/generated/C5RecipientPoPVerifier.sol";
import "../../src/bet/tournament/generated/C5AggregateVerifier.sol";
import "../../src/bet/tournament/generated/C5PartialVerifier.sol";
import "../../src/bet/tournament/generated/C5UnmaskVerifier.sol";
interface IC5Vm420 {function addr(uint256)external returns(address);function sign(uint256,bytes32)external returns(uint8,bytes32,bytes32);function readFileBinary(string calldata)external returns(bytes memory);}
abstract contract TournamentFundedFixture420 is EntryFixture420 {
    IC5Vm420 internal constant cvm=IC5Vm420(address(uint160(uint256(keccak256("hevm cheat code")))));
    uint256 internal constant WS8_FR=21888242871839275222246405745257275088548364400416034343698204186575808495617;
    address internal constant WS8_RISK=address(0xB00D);
    PokerTournamentRuntimeEscrow420 internal runtimeEscrow;PokerTournamentHost420 internal host;PokerTournamentStructureBook420 internal book;
    PokerConfidentialDeal420 internal deal;PokerTournamentAssignments420 internal assignments;
    PokerTournamentSeatingEntropy420 internal initialEntropy;PokerTournamentRoundEntropy420 internal roundEntropy;
    SeatingRouter420 internal rng;RandomnessProfileRegistry420 internal profiles;RandomnessRouteRegistry420 internal routes;
    EntryActor420 internal carol;EntryActor420 internal dan;EntryActor420 internal provider0;EntryActor420 internal provider1;
    EntryActor420 internal eve;EntryActor420 internal frank;
    EntryActor420 internal auditor0;EntryActor420 internal auditor1;
    bytes32 internal constant C=keccak256("carol");bytes32 internal constant D=keccak256("dan");bytes32 internal constant CC=keccak256("carol credential");bytes32 internal constant DC=keccak256("dan credential");
    bytes32 internal constant E=keccak256("eve");bytes32 internal constant F=keccak256("frank");bytes32 internal constant EC=keccak256("eve credential");bytes32 internal constant FC=keccak256("frank credential");
    bytes32 internal constant PS0=keccak256("dealer zero");bytes32 internal constant PS1=keccak256("dealer one");bytes32 internal constant PC0=keccak256("dealer zero credential");bytes32 internal constant PC1=keccak256("dealer one credential");
    bytes32 internal constant INITIAL_PROFILE=keccak256("C5 initial profile");bytes32 internal constant ROUND_PROFILE=keccak256("C5 round profile");bytes32 internal constant STRUCTURE=keccak256("C5 timed structure");
    bytes32 internal constant SECRET0=keccak256("C5 fixture random secret0");bytes32 internal constant SECRET1=keccak256("C5 fixture random secret1");
    bytes32 internal handA;bytes32 internal handB;bytes32 internal finalHand;
    mapping(address=>uint256)internal signingKey;
    PokerVerifierVersions420 internal ws8Versions;
    PokerInitialEncryptedDeck420 internal ws8Initial;
    PokerPrivateShuffleGate420 internal ws8Shuffle;
    PokerShuffleCiphertextAvailability420 internal ws8Availability;
    PokerShuffleProviderIndependence420 internal ws8Independence;
    PokerActionKeys420 internal ws8Signing;
    PokerActionDisputeClock420 internal ws8Disputes;
    PokerTournamentNLHE420 internal ws8Engine;
    PokerProviderAccountability420 internal ws8Bonds;
    PokerRecipientKeys420 internal ws8Recipients;
    PokerDeckDisclosure420 internal ws8Delivery;
    PokerDeliveryProofBook420 internal ws8Book;
    PokerLiveCardReveals420 internal ws8Live;
    PokerCanonicalRake420 internal ws8Rake;
    PokerNativeOutcome420 internal ws8Outcome;
    address[7] internal ws8Backends;
    bytes32[7] internal ws8Keys;
    string[7] internal ws8Names=["InitialDeck52","Reencrypt52","Delivery","RecipientPoP","Aggregate","Partial","Unmask"];


    function kind()internal pure virtual returns(PokerTournamentPolicy420.PurchaseKind){return PokerTournamentPolicy420.PurchaseKind.FREEZEOUT;}
    function folder()internal pure virtual returns(string memory){return "freezeout";}
    function tableLimit()internal pure virtual returns(uint16){return 2;}
    function seatCapacity()internal pure virtual returns(uint8){return 3;}
    function fieldSize()internal pure virtual returns(uint8){return 4;}
    function setUp()public virtual override {
        super.setUp();runtimeEscrow=new PokerTournamentRuntimeEscrow420(address(policies),address(identity),ISSUER,TYPE,address(dev));escrow=PokerTournamentEntryEscrow420(address(runtimeEscrow));
        book=new PokerTournamentStructureBook420(address(policies),address(runtimeEscrow));BetEmergencyState420 emergency=new BetEmergencyState420(address(auth));host=new PokerTournamentHost420(address(runtimeEscrow),address(book),address(emergency));
        grant(address(this),runtimeEscrow.BIND_HOST(),auth.scopeGlobal());runtimeEscrow.bindHost(address(host));grant(address(this),host.CONFIGURE(),host.scope(0));grant(address(this),host.CONFIGURE(),host.scope(EVENT));grant(address(this),host.PAUSE(),host.scope(EVENT));
        carol=new EntryActor420();dan=new EntryActor420();provider0=new EntryActor420();provider1=new EntryActor420();auditor0=new EntryActor420();auditor1=new EntryActor420();
        _identity(carol,C,CC,keccak256("person C"));_identity(dan,D,DC,keccak256("person D"));_identity(provider0,PS0,PC0,keccak256("independent dealer person0"));_identity(provider1,PS1,PC1,keccak256("independent dealer person1"));
        _fund(alice,10000);_fund(bob,10000);_fund(carol,10000);_fund(dan,10000);_fund(provider0,10000);_fund(provider1,10000);
        grant(address(this),escrow.CREATE(),escrow.scope(EVENT));grant(address(alice),escrow.ENTER(),escrow.scope(EVENT));grant(address(bob),escrow.ENTER(),escrow.scope(EVENT));grant(address(carol),escrow.ENTER(),escrow.scope(EVENT));grant(address(dan),escrow.ENTER(),escrow.scope(EVENT));
        grant(address(alice),runtimeEscrow.EXTRA(),escrow.scope(EVENT));grant(address(bob),runtimeEscrow.EXTRA(),escrow.scope(EVENT));grant(address(carol),runtimeEscrow.EXTRA(),escrow.scope(EVENT));grant(address(dan),runtimeEscrow.EXTRA(),escrow.scope(EVENT));
        signingKey[address(alice)]=0x420001;signingKey[address(bob)]=0x420002;signingKey[address(carol)]=0x420003;signingKey[address(dan)]=0x420004;
        if(fieldSize()>4){eve=new EntryActor420();frank=new EntryActor420();_identity(eve,E,EC,keccak256("person E"));_identity(frank,F,FC,keccak256("person F"));_fund(eve,10000);_fund(frank,10000);signingKey[address(eve)]=0x420005;signingKey[address(frank)]=0x420006;grant(address(eve),escrow.ENTER(),escrow.scope(EVENT));grant(address(frank),escrow.ENTER(),escrow.scope(EVENT));}
        deal=new PokerConfidentialDeal420(address(host),address(host),address(provider0),address(provider1));
        _deployCryptography();host.bindEngine(address(ws8Engine));
        profiles=new RandomnessProfileRegistry420(address(this));routes=new RandomnessRouteRegistry420(address(this));RandomnessRegistry registry=new RandomnessRegistry(address(this));rng=new SeatingRouter420(address(profiles),address(routes),address(registry));registry.bindRouter(address(rng));
        initialEntropy=new PokerTournamentSeatingEntropy420(address(runtimeEscrow),address(rng),[address(provider0),address(provider1)],[PS0,PS1],[PC0,PC1]);
        assignments=new PokerTournamentAssignments420(address(book),address(rng),address(initialEntropy));roundEntropy=new PokerTournamentRoundEntropy420(address(host),address(initialEntropy),address(rng));host.bindEntropy(address(roundEntropy));
        routes.setRoute(INITIAL_PROFILE,address(assignments),address(initialEntropy),initialEntropy.METHOD(),0,0,true);profiles.setProfile(INITIAL_PROFILE,INITIAL_PROFILE,0,300,300,2,0,0,true);
        routes.setRoute(ROUND_PROFILE,address(roundEntropy),address(roundEntropy),roundEntropy.METHOD(),0,0,true);profiles.setProfile(ROUND_PROFILE,ROUND_PROFILE,0,300,300,2,0,0,true);
        _createPolicy();_configureTables();_attest(provider0,auditor0,keccak256("C5 dealer independence0"));_attest(provider1,auditor1,keccak256("C5 dealer independence1"));
        provider0.invoke(address(asset),abi.encodeCall(asset.approve,(address(ws8Bonds),type(uint256).max)));provider1.invoke(address(asset),abi.encodeCall(asset.approve,(address(ws8Bonds),type(uint256).max)));
        provider0.invoke(address(ws8Bonds),abi.encodeCall(ws8Bonds.fundAsset,(address(asset),uint256(10000))));provider1.invoke(address(ws8Bonds),abi.encodeCall(ws8Bonds.fundAsset,(address(asset),uint256(10000))));
    }
    function _deployCryptography()private {
        ws8Versions=new PokerVerifierVersions420(address(this));
        ws8Backends=[address(new C5InitialDeck52Verifier()),address(new C5Reencrypt52Verifier()),
            address(new C5DeliveryVerifier()),address(new C5RecipientPoPVerifier()),
            address(new C5AggregateVerifier()),address(new C5PartialVerifier()),address(new C5UnmaskVerifier())];
        for(uint8 i;i<7;i++) {
            ws8Keys[i]=keccak256(cvm.readFileBinary(string.concat("../clients/420bet-poker/zkshuffle/fixtures/tournament-5c5/keys/",ws8Names[i],".vk")));
            (bytes32 circuit,bytes32 schema)=C5VerifierData.identity(i);
            ws8Versions.register(_ws8Version(i),ws8Backends[i],ws8Keys[i],circuit,schema);
        }
        uint256[6] memory points=C5VerifierData.keys();
        bytes32 threshold=keccak256(abi.encode(points[4],points[5]));
        (bytes32 circuit,bytes32 schema)=C5VerifierData.identity(0);
        PokerGnarkInitial52Adapter420 initialAdapter=new PokerGnarkInitial52Adapter420(
            ws8Backends[0],address(ws8Versions),_ws8Version(0),circuit,ws8Keys[0],schema,threshold);
        bytes32 wrapperVersion=keccak256("WS8.INITIAL.ADAPTER.V1");
        ws8Versions.register(wrapperVersion,address(initialAdapter),ws8Keys[0],circuit,schema);
        ws8Initial=new PokerInitialEncryptedDeck420(address(deal),address(ws8Versions),address(initialAdapter),
            wrapperVersion,circuit,ws8Keys[0],schema,threshold);
        (circuit,schema)=C5VerifierData.identity(1);
        PokerGnarkShuffle52Adapter420 shuffleAdapter=new PokerGnarkShuffle52Adapter420(
            ws8Backends[1],address(ws8Versions),_ws8Version(1),circuit,ws8Keys[1],schema,threshold);
        uint256[] memory rounds=abi.decode(cvm.readFileBinary("../clients/420bet-poker/zkshuffle/fixtures/tournament-5c5/rounds.bin"),(uint256[]));
        ws8Availability=new PokerShuffleCiphertextAvailability420(rounds,keccak256(abi.encode(rounds)));
        ws8Independence=new PokerShuffleProviderIndependence420(address(this));
        ws8Shuffle=new PokerPrivateShuffleGate420(address(deal),address(ws8Initial),address(shuffleAdapter),
            address(ws8Independence),address(ws8Availability),circuit,threshold);
        ws8Signing=new PokerActionKeys420(address(deal));
        ws8Disputes=new PokerActionDisputeClock420(address(deal));
        ws8Engine=new PokerTournamentNLHE420(address(deal),address(ws8Shuffle),address(ws8Signing),address(ws8Disputes));
        ws8Bonds=new PokerProviderAccountability420(address(deal),address(ws8Engine),WS8_RISK);
        ws8Recipients=new PokerRecipientKeys420(address(host));
        ws8Delivery=new PokerDeckDisclosure420(address(deal),address(ws8Recipients));
        (circuit,schema)=C5VerifierData.identity(2);
        PokerGnarkEncryptedShareDeliveryAdapter420 deliveryA=new PokerGnarkEncryptedShareDeliveryAdapter420(
            ws8Backends[2],address(ws8Versions),_ws8Version(2),circuit,ws8Keys[2],schema,keccak256(abi.encode(points[0],points[1])));
        PokerGnarkEncryptedShareDeliveryAdapter420 deliveryB=new PokerGnarkEncryptedShareDeliveryAdapter420(
            ws8Backends[2],address(ws8Versions),_ws8Version(2),circuit,ws8Keys[2],schema,keccak256(abi.encode(points[2],points[3])));
        (circuit,schema)=C5VerifierData.identity(3);
        PokerGnarkRecipientKeyPoPAdapter420 pop=new PokerGnarkRecipientKeyPoPAdapter420(
            ws8Backends[3],address(ws8Versions),_ws8Version(3),ws8Keys[3],circuit,schema);
        (circuit,schema)=C5VerifierData.identity(4);
        PokerGnarkThresholdKeyAggregateAdapter420 aggregate=new PokerGnarkThresholdKeyAggregateAdapter420(
            ws8Backends[4],address(ws8Versions),_ws8Version(4),circuit,ws8Keys[4],schema,threshold);
        ws8Book=new PokerDeliveryProofBook420(address(deal),address(ws8Delivery),address(ws8Shuffle),
            address(ws8Engine),address(deliveryA),address(deliveryB),address(aggregate));
        (circuit,schema)=C5VerifierData.identity(5);
        PokerGnarkPartialShareAdapter420 partialA=new PokerGnarkPartialShareAdapter420(
            ws8Backends[5],address(ws8Versions),_ws8Version(5),circuit,ws8Keys[5],schema,keccak256(abi.encode(points[0],points[1])));
        PokerGnarkPartialShareAdapter420 partialB=new PokerGnarkPartialShareAdapter420(
            ws8Backends[5],address(ws8Versions),_ws8Version(5),circuit,ws8Keys[5],schema,keccak256(abi.encode(points[2],points[3])));
        (circuit,schema)=C5VerifierData.identity(6);
        PokerGnarkCardUnmaskAdapter420 unmask=new PokerGnarkCardUnmaskAdapter420(
            ws8Backends[6],address(ws8Versions),_ws8Version(6),circuit,ws8Keys[6],schema,threshold);
        ws8Live=new PokerLiveCardReveals420(address(ws8Engine),address(partialA),address(partialB),address(unmask));
        ws8Rake=new PokerCanonicalRake420(address(host));
        ws8Outcome=new PokerNativeOutcome420(address(ws8Engine),address(ws8Live),address(ws8Rake),address(new PokerHandRank420()));
        grant(address(this),ws8Recipients.ACTION_BIND_KEY_POP(),auth.scopeGlobal());
        ws8Recipients.bindProofVerifier(address(pop));

    }
    function _ws8Version(uint8 i)internal pure returns(bytes32){return keccak256(abi.encode("C5.GENUINE.VERIFIER.V1",i));}
    function _createPolicy()private {
        grant(address(this),book.CREATE(),book.scope(STRUCTURE,0));grant(address(this),book.APPROVE(),book.scope(STRUCTURE,0));grant(address(this),book.PUBLISH(),book.scope(STRUCTURE,0));grant(address(this),book.BIND_POLICY(),book.scope(POLICY,1));grant(address(this),book.BIND_EVENT(),book.scope(EVENT,2));
        PokerTournamentStructure420.Level[] memory levels=new PokerTournamentStructure420.Level[](3);levels[0]=PokerTournamentStructure420.Level(5,10,60);levels[1]=PokerTournamentStructure420.Level(10,20,60);levels[2]=PokerTournamentStructure420.Level(20,40,60);
        book.register(STRUCTURE,OP,1000,levels);book.approve(STRUCTURE);book.publish(STRUCTURE);
        PokerTournamentPolicy420.Config memory c=config();c.gameVersion=keccak256("C5 genuine tournament rules");c.multiTable=tableLimit()>1;c.seatsPerTable=seatCapacity();c.maxTables=tableLimit();c.minimum=fieldSize();c.startingTarget=fieldSize();c.maxPlayers=uint32(tableLimit())*seatCapacity();c.blindSchedule=book.structureOf(STRUCTURE).digest;c.seatingPolicy=assignments.policyDigest(INITIAL_PROFILE,300);c.purchaseKind=kind();
        if(kind()!=PokerTournamentPolicy420.PurchaseKind.FREEZEOUT){c.extraDuration=1000;c.extraCap=2;}
        _publish(c);book.bindPolicy(POLICY,STRUCTURE);book.bindEvent(EVENT);grant(address(this),assignments.BIND(),assignments.scope(EVENT));assignments.bind(EVENT,INITIAL_PROFILE,300);host.bindEvent(EVENT,address(assignments),ROUND_PROFILE,300,60);
        bytes32 purpose=assignments.eventOf(EVENT).purpose;grant(address(provider0),initialEntropy.PROVIDE(),initialEntropy.scope(address(assignments),purpose));grant(address(provider1),initialEntropy.PROVIDE(),initialEntropy.scope(address(assignments),purpose));
        provider0.invoke(address(initialEntropy),abi.encodeCall(initialEntropy.commit,(address(assignments),purpose,initialEntropy.commitment(address(assignments),purpose,0,SECRET0))));provider1.invoke(address(initialEntropy),abi.encodeCall(initialEntropy.commit,(address(assignments),purpose,initialEntropy.commitment(address(assignments),purpose,1,SECRET1))));
    }
    function _configureTables()private {
        EntryActor420[6] memory actors=[alice,bob,carol,dan,eve,frank];
        for(uint32 i=1;i<=tableLimit();i++){
            bytes32 key=host.tableId(EVENT,i);bytes32 scope_=auth.scopeForTable(key);
            grant(address(host),deal.ACTION_BEGIN(),scope_);grant(address(provider0),deal.ACTION_PROVIDER_COMMIT(),scope_);grant(address(provider1),deal.ACTION_PROVIDER_COMMIT(),scope_);
            grant(address(host),ws8Disputes.ACTION_BIND_RESOLVER(),scope_);grant(address(host),ws8Engine.ACTION_BIND_TURN_POLICY(),scope_);grant(address(host),ws8Engine.ACTION_BIND_PROVIDER_BOND(),scope_);grant(address(host),ws8Engine.ACTION_BIND_DELIVERY(),scope_);grant(address(host),ws8Engine.ACTION_BIND_REVEALS(),scope_);grant(address(host),ws8Engine.ACTION_BIND_OUTCOME(),scope_);grant(address(host),ws8Delivery.ACTION_BIND_PROOF_BOOK(),scope_);
            for(uint8 j;j<fieldSize();j++)grant(address(actors[j]),BetIds420.ACTION_POKER_ACTION,scope_);
            host.configureTable(EVENT,i,address(ws8Delivery),address(ws8Book),address(ws8Live),address(ws8Outcome),address(ws8Bonds));
        }
    }
    function _attest(EntryActor420 provider,EntryActor420 auditor,bytes32 group)private {
        bytes32 dossier=keccak256(abi.encode("C5 independently inspectable dossier",provider,group));uint64 expiry=1000000;
        provider.invoke(address(ws8Independence),abi.encodeCall(ws8Independence.claim,(group,dossier,expiry)));
        bytes32 audit=abi.decode(auditor.invoke(address(ws8Independence),abi.encodeCall(ws8Independence.recordAudit,(address(provider),group,keccak256("C5 audit report"),dossier,keccak256("C5 audit location")))),(bytes32));
        ws8Independence.attest(address(provider),group,dossier,expiry,audit);
    }
    function _fundedSeated()internal {
        vm.warp(200);_buy(alice,A,AC,1);_buy(bob,B,BC,1);_buy(carol,C,CC,1);_buy(dan,D,DC,1);if(fieldSize()>4){_buy(eve,E,EC,1);_buy(frank,F,FC,1);}vm.warp(400);assignments.loadRoster(EVENT,32);
        bytes32 purpose=assignments.eventOf(EVENT).purpose;provider0.invoke(address(initialEntropy),abi.encodeCall(initialEntropy.reveal,(address(assignments),purpose,SECRET0)));provider1.invoke(address(initialEntropy),abi.encodeCall(initialEntropy.reveal,(address(assignments),purpose,SECRET1)));assignments.resolve(EVENT);assignments.shuffle(EVENT,32);assignments.assign(EVENT,32);host.bootstrap(EVENT,32);
        require(escrow.heldPrizes()==uint256(fieldSize())*100&&escrow.heldFees()==uint256(fieldSize())*3&&host.chipConservation(EVENT),"real tournament custody and nonredeemable stacks");
    }
    function _openRound()internal {
        host.prepareRound(EVENT);bytes32 purpose=host.eventPurpose(EVENT);grant(address(provider0),roundEntropy.PROVIDE(),roundEntropy.scope(purpose));grant(address(provider1),roundEntropy.PROVIDE(),roundEntropy.scope(purpose));
        provider0.invoke(address(roundEntropy),abi.encodeCall(roundEntropy.commit,(purpose,roundEntropy.commitment(purpose,0,SECRET0))));provider1.invoke(address(roundEntropy),abi.encodeCall(roundEntropy.commit,(purpose,roundEntropy.commitment(purpose,1,SECRET1))));vm.warp(block.timestamp+1);host.openRound(EVENT);
    }
    function _begin(uint32 table)internal returns(bytes32 hand){
        hand=host.beginHand(EVENT,table);provider0.invoke(address(deal),abi.encodeCall(deal.commit,(hand,keccak256(abi.encode("C5 provider A deal",hand)))));provider1.invoke(address(deal),abi.encodeCall(deal.commit,(hand,keccak256(abi.encode("C5 provider B deal",hand)))));
        bytes32 key=host.tableId(EVENT,table);for(uint8 i;i<9;i++){PokerSeatLedger420.Seat memory seat=host.seatOf(key,i);if(seat.player!=address(0)){EntryActor420(payable(seat.player)).invoke(address(ws8Signing),abi.encodeCall(ws8Signing.bindSigner,(key,cvm.addr(signingKey[seat.player]))));}}
    }
    function _firstHands()internal{_fundedSeated();_openRound();handA=_begin(1);handB=_begin(2);}
    event C5StatementContext(bytes32 indexed label,bytes encoded);
    function _context(bytes32 hand)internal view returns(bytes memory){
        PokerConfidentialDeal420.Hand memory h=deal.getHand(hand);uint256[48] memory w;uint8[9] memory seats;uint8[18] memory owners;uint256[6] memory points=C5VerifierData.keys();
        w[0]=uint256(hand);w[1]=uint256(h.tableId);w[2]=uint256(h.configHash);w[3]=uint256(h.rulesetId);w[4]=uint256(h.versionId);w[5]=uint256(h.seatSnapshotHash);w[6]=h.epoch;w[7]=h.nonce;w[8]=uint256(h.transcriptCommitment);w[9]=block.chainid;
        w[10]=uint160(address(ws8Initial));w[11]=uint160(address(ws8Initial.verifier()));w[12]=uint256(ws8Initial.verifierVersion());w[13]=uint256(ws8Initial.circuitHash());w[14]=uint256(ws8Initial.verifyingKeyHash());w[15]=uint256(ws8Initial.publicSchemaHash());w[16]=uint256(ws8Initial.thresholdKeyCommitment());w[17]=uint160(address(ws8Shuffle));w[18]=uint256(ws8Shuffle.circuitId());w[19]=uint160(address(ws8Book));w[20]=uint160(address(ws8Recipients));w[21]=host.seatingEpoch(h.tableId);
        uint8 count;for(uint8 i;i<9;i++)if((deal.handSeatMask(hand)&(uint16(1)<<i))!=0){seats[count]=i;uint256 index=count<2?22+count*2:34+(count-2)*2;w[index]=uint160(host.seatOf(h.tableId,i).player);w[index+1]=host.seatOf(h.tableId,i).epoch;count++;}require(count>=2);
        w[26]=uint160(address(ws8Book.providerA()));w[27]=uint160(address(ws8Book.providerB()));for(uint8 i;i<6;i++)w[28+i]=points[i];uint8 button=host.button(h.tableId);uint8 start;for(uint8 i;i<count;i++)if(seats[i]==button)start=i;
        if(count>2)start=uint8((uint256(start)+1)%count);for(uint8 i;i<2*count;i++)owners[i]=seats[(start+i%count)%count];return abi.encode(w,seats,owners,count);
    }
}

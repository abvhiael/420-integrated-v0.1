// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./BetPokerConfidentialDeal54.t.sol";
import "../src/bet/PokerGnarkElGamalAdapters420.sol";
import "../src/bet/PokerNLHEBetting420.sol";
import "../src/bet/PokerNativeOutcome420.sol";
import "../src/bet/PokerLiveCardReveals420.sol";
import "../src/bet/generated/WS8VerifierData.sol";
import "../src/bet/generated/WS8InitialDeck52Verifier.sol";
import "../src/bet/generated/WS8Reencrypt52Verifier.sol";
import "../src/bet/generated/WS8DeliveryVerifier.sol";
import "../src/bet/generated/WS8RecipientPoPVerifier.sol";
import "../src/bet/generated/WS8AggregateVerifier.sol";
import "../src/bet/generated/WS8PartialVerifier.sol";
import "../src/bet/generated/WS8UnmaskVerifier.sol";

interface VmWS8Production54 {
    function addr(uint256) external returns(address);
    function sign(uint256,bytes32) external returns(uint8,bytes32,bytes32);
    function readFileBinary(string calldata) external returns(bytes memory);
}

/// @dev Exact-accounting token with an opt-in hostile callback. The same token
/// backs the legitimate hand and every attack; no runtime replacement is used.
contract WS8CallbackToken54 {
    mapping(address=>uint256) public balanceOf;
    mapping(address=>mapping(address=>uint256)) public allowance;
    address public callbackTarget;
    bytes public callbackData;
    bool public callbackAttempted;
    bool public callbackSucceeded;
    bytes4 public callbackError;
    function mint(address to,uint256 n) external {balanceOf[to]+=n;}
    function approve(address to,uint256 n) external returns(bool){allowance[msg.sender][to]=n;return true;}
    function prepareCallback(address target,bytes calldata data) external {callbackTarget=target;callbackData=data;}
    function _callback() private {
        if(callbackTarget==address(0))return;
        address target=callbackTarget;bytes memory payload=callbackData;callbackTarget=address(0);
        callbackAttempted=true;
        (bool ok,bytes memory result)=target.call(payload);callbackSucceeded=ok;
        if(result.length>=4){bytes4 reason;assembly {reason:=mload(add(result,32))}callbackError=reason;}
    }
    function transferFrom(address from,address to,uint256 n) external returns(bool){
        require(allowance[from][msg.sender]>=n&&balanceOf[from]>=n,"insufficient");
        allowance[from][msg.sender]-=n;balanceOf[from]-=n;balanceOf[to]+=n;_callback();return true;
    }
    function transfer(address to,uint256 n) external returns(bool){
        require(balanceOf[msg.sender]>=n,"insufficient");balanceOf[msg.sender]-=n;balanceOf[to]+=n;_callback();return true;
    }
}

/// @dev All poker and proof-admission components are production implementations.
/// The inherited capability, operator, emergency and token fixtures provide the
/// external environment; none can manufacture cryptographic acceptance.
abstract contract PokerWS8ProductionFixture54 is PokerConfidentialDeal54Test {
    VmWS8Production54 internal constant ws8vm=VmWS8Production54(address(uint160(uint256(keccak256("hevm cheat code")))));
    uint256 internal constant WS8_FR=21888242871839275222246405745257275088548364400416034343698204186575808495617;
    uint256 internal constant WS8_PLAYER_KEY=0x420001;
    uint256 internal constant WS8_OPPONENT_KEY=0x420002;
    address internal constant WS8_RISK=address(0xB00D);
    address internal constant WS8_RAKES=address(0xFEE420);
    PokerVerifierVersions420 internal ws8Versions;
    PokerInitialEncryptedDeck420 internal ws8Initial;
    PokerPrivateShuffleGate420 internal ws8Shuffle;
    PokerShuffleCiphertextAvailability420 internal ws8Availability;
    PokerShuffleProviderIndependence420 internal ws8Independence;
    PokerActionKeys420 internal ws8Signing;
    PokerActionDisputeClock420 internal ws8Disputes;
    PokerNLHEBetting420 internal ws8Engine;
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

    event WS8VerifierIdentity(uint8 indexed index,address verifier,bytes32 verifyingKeyHash,bytes32 runtimeCodeHash,bytes32 circuitHash,bytes32 schemaHash);

    constructor() {
        coin=PokerCoin53(address(new WS8CallbackToken54()));
        coin.mint(PLAYER,5000);coin.mint(PLAYER_B,2000);
        cheat54.prank(PLAYER);coin.approve(address(ledger),5000);
        cheat54.prank(PLAYER_B);coin.approve(address(ledger),2000);
        ws8Versions=new PokerVerifierVersions420(address(this));
        ws8Backends=[address(new WS8InitialDeck52Verifier()),address(new WS8Reencrypt52Verifier()),
            address(new WS8DeliveryVerifier()),address(new WS8RecipientPoPVerifier()),
            address(new WS8AggregateVerifier()),address(new WS8PartialVerifier()),address(new WS8UnmaskVerifier())];
        for(uint8 i;i<7;i++) {
            ws8Keys[i]=keccak256(ws8vm.readFileBinary(string.concat("../clients/420bet-poker/zkshuffle/fixtures/ws8/keys/",ws8Names[i],".vk")));
            (bytes32 circuit,bytes32 schema)=WS8VerifierData.identity(i);
            ws8Versions.register(_ws8Version(i),ws8Backends[i],ws8Keys[i],circuit,schema);
        }
        uint256[6] memory points=WS8VerifierData.keys();
        bytes32 threshold=keccak256(abi.encode(points[4],points[5]));
        (bytes32 circuit,bytes32 schema)=WS8VerifierData.identity(0);
        PokerGnarkInitial52Adapter420 initialAdapter=new PokerGnarkInitial52Adapter420(
            ws8Backends[0],address(ws8Versions),_ws8Version(0),circuit,ws8Keys[0],schema,threshold);
        bytes32 wrapperVersion=keccak256("WS8.INITIAL.ADAPTER.V1");
        ws8Versions.register(wrapperVersion,address(initialAdapter),ws8Keys[0],circuit,schema);
        ws8Initial=new PokerInitialEncryptedDeck420(address(deal),address(ws8Versions),address(initialAdapter),
            wrapperVersion,circuit,ws8Keys[0],schema,threshold);
        (circuit,schema)=WS8VerifierData.identity(1);
        PokerGnarkShuffle52Adapter420 shuffleAdapter=new PokerGnarkShuffle52Adapter420(
            ws8Backends[1],address(ws8Versions),_ws8Version(1),circuit,ws8Keys[1],schema,threshold);
        uint256[] memory rounds=abi.decode(ws8vm.readFileBinary("../clients/420bet-poker/zkshuffle/fixtures/ws8/rounds.bin"),(uint256[]));
        ws8Availability=new PokerShuffleCiphertextAvailability420(rounds,keccak256(abi.encode(rounds)));
        ws8Independence=new PokerShuffleProviderIndependence420(address(this));
        ws8Shuffle=new PokerPrivateShuffleGate420(address(deal),address(ws8Initial),address(shuffleAdapter),
            address(ws8Independence),address(ws8Availability),circuit,threshold);
        ws8Signing=new PokerActionKeys420(address(deal));
        ws8Disputes=new PokerActionDisputeClock420(address(deal));
        ws8Engine=new PokerNLHEBetting420(address(deal),address(ws8Shuffle),address(ws8Signing),address(ws8Disputes));
        ws8Bonds=new PokerProviderAccountability420(address(deal),address(ws8Engine),WS8_RISK);
        ws8Recipients=new PokerRecipientKeys420(address(ledger));
        ws8Delivery=new PokerDeckDisclosure420(address(deal),address(ws8Recipients));
        (circuit,schema)=WS8VerifierData.identity(2);
        PokerGnarkEncryptedShareDeliveryAdapter420 deliveryA=new PokerGnarkEncryptedShareDeliveryAdapter420(
            ws8Backends[2],address(ws8Versions),_ws8Version(2),circuit,ws8Keys[2],schema,keccak256(abi.encode(points[0],points[1])));
        PokerGnarkEncryptedShareDeliveryAdapter420 deliveryB=new PokerGnarkEncryptedShareDeliveryAdapter420(
            ws8Backends[2],address(ws8Versions),_ws8Version(2),circuit,ws8Keys[2],schema,keccak256(abi.encode(points[2],points[3])));
        (circuit,schema)=WS8VerifierData.identity(3);
        PokerGnarkRecipientKeyPoPAdapter420 pop=new PokerGnarkRecipientKeyPoPAdapter420(
            ws8Backends[3],address(ws8Versions),_ws8Version(3),ws8Keys[3],circuit,schema);
        (circuit,schema)=WS8VerifierData.identity(4);
        PokerGnarkThresholdKeyAggregateAdapter420 aggregate=new PokerGnarkThresholdKeyAggregateAdapter420(
            ws8Backends[4],address(ws8Versions),_ws8Version(4),circuit,ws8Keys[4],schema,threshold);
        ws8Book=new PokerDeliveryProofBook420(address(deal),address(ws8Delivery),address(ws8Shuffle),
            address(ws8Engine),address(deliveryA),address(deliveryB),address(aggregate));
        (circuit,schema)=WS8VerifierData.identity(5);
        PokerGnarkPartialShareAdapter420 partialA=new PokerGnarkPartialShareAdapter420(
            ws8Backends[5],address(ws8Versions),_ws8Version(5),circuit,ws8Keys[5],schema,keccak256(abi.encode(points[0],points[1])));
        PokerGnarkPartialShareAdapter420 partialB=new PokerGnarkPartialShareAdapter420(
            ws8Backends[5],address(ws8Versions),_ws8Version(5),circuit,ws8Keys[5],schema,keccak256(abi.encode(points[2],points[3])));
        (circuit,schema)=WS8VerifierData.identity(6);
        PokerGnarkCardUnmaskAdapter420 unmask=new PokerGnarkCardUnmaskAdapter420(
            ws8Backends[6],address(ws8Versions),_ws8Version(6),circuit,ws8Keys[6],schema,threshold);
        ws8Live=new PokerLiveCardReveals420(address(ws8Engine),address(partialA),address(partialB),address(unmask));
        ws8Rake=new PokerCanonicalRake420(address(registry));
        ws8Outcome=new PokerNativeOutcome420(address(ws8Engine),address(ws8Live),address(ws8Rake),address(new PokerHandRank420()));
        cap.grant(ADMIN,ws8Recipients.ACTION_BIND_KEY_POP(),auth.scopeGlobal(),true);
        cheat54.prank(ADMIN);ws8Recipients.bindProofVerifier(address(pop));
    }

    function _ws8Version(uint8 i) internal pure returns(bytes32) {return keccak256(abi.encode("WS8.GENUINE.VERIFIER.V1",i));}

    function _ws8FundedHand() internal returns(bytes32 id) {
        require(block.chainid==31337,"WS8 chain context");
        cheat54.warp(1_700_000_000);
        PokerTableRegistry420.Configuration memory config=_config();
        config.asset=address(coin);
        config.rakePolicyHash=ws8Rake.policyHash(PokerCanonicalRake420.Policy(500,20,true,true));
        cheat54.prank(ADMIN);registry.register(config,ADMIN);
        cheat54.prank(ADMIN);registry.approve(TABLE);
        cheat54.prank(ADMIN);registry.open(TABLE);
        _buy();cheat54.prank(PLAYER_B);ledger.buyIn(TABLE,1,400);
        bytes32 scope=auth.scopeForTable(TABLE);
        cap.grant(ADMIN,ledger.ACTION_BIND_SETTLEMENT(),scope,true);
        cap.grant(ADMIN,ws8Disputes.ACTION_BIND_RESOLVER(),scope,true);
        cap.grant(ADMIN,ws8Engine.ACTION_BIND_PROVIDER_BOND(),scope,true);
        cap.grant(ADMIN,ws8Engine.ACTION_BIND_DELIVERY(),scope,true);
        cap.grant(ADMIN,ws8Engine.ACTION_BIND_REVEALS(),scope,true);
        cap.grant(ADMIN,ws8Engine.ACTION_BIND_OUTCOME(),scope,true);
        cap.grant(ADMIN,ws8Delivery.ACTION_BIND_PROOF_BOOK(),scope,true);
        cheat54.prank(ADMIN);ledger.bindSettlement(TABLE,address(ws8Engine),WS8_RAKES);
        cheat54.prank(ADMIN);ws8Disputes.bindResolver(TABLE,address(ws8Engine));
        cap.grant(ADMIN,ws8Engine.ACTION_BIND_TURN_POLICY(),scope,true);
        cheat54.prank(ADMIN);ws8Engine.bindTurnPolicy(TABLE,60);
        cheat54.prank(ADMIN);ws8Engine.bindProviderBond(TABLE,address(ws8Bonds));
        cheat54.prank(ADMIN);ws8Delivery.bindProofBook(TABLE,address(ws8Book));
        cheat54.prank(ADMIN);ws8Engine.bindDelivery(TABLE,address(ws8Delivery));
        cheat54.prank(ADMIN);ws8Engine.bindReveals(TABLE,address(ws8Live));
        cheat54.prank(ADMIN);ws8Engine.bindOutcome(TABLE,address(ws8Outcome));
        coin.mint(PROVIDER_A,800);coin.mint(PROVIDER_B,800);
        cheat54.prank(PROVIDER_A);coin.approve(address(ws8Bonds),800);
        cheat54.prank(PROVIDER_B);coin.approve(address(ws8Bonds),800);
        cheat54.prank(PROVIDER_A);ws8Bonds.fundAsset(address(coin),800);
        cheat54.prank(PROVIDER_B);ws8Bonds.fundAsset(address(coin),800);
        bytes32 snapshot=deal.snapshotFor(TABLE,3);
        cheat54.prank(ADMIN);id=deal.begin(TABLE,1,uint64(block.timestamp+3600),keccak256("WS8.PREVIOUS.STATE.V1"),snapshot,3);
        cheat54.prank(PROVIDER_A);deal.commit(id,keccak256("WS8.INDEPENDENT.PROVIDER.A.V1"));
        cheat54.prank(PROVIDER_B);deal.commit(id,keccak256("WS8.INDEPENDENT.PROVIDER.B.V1"));
        address signerA=ws8vm.addr(WS8_PLAYER_KEY);address signerB=ws8vm.addr(WS8_OPPONENT_KEY);
        cheat54.prank(PLAYER);ws8Signing.bindSigner(TABLE,signerA);
        cheat54.prank(PLAYER_B);ws8Signing.bindSigner(TABLE,signerB);
        cheat54.prank(PLAYER);ws8Engine.reserve(id);
        require(ledger.settlementCoordinator(TABLE)==address(ws8Engine),"canonical escrow authority");
        require(ws8Bonds.nativeEngine()==address(ws8Engine)&&ws8Bonds.isCollateralized(id),"canonical bond authority");
        require(ledger.reservedInHand(TABLE)==800&&ledger.lockedTotal(TABLE)==800,"funded player escrow");
        require(coin.balanceOf(address(ledger))==800&&coin.balanceOf(address(ws8Bonds))==1600,"segregated actual custody");
        require(ws8Engine.fundedSnapshot(id)==ledger.lockedSnapshot(TABLE),"engine snapshot");
    }
    function _ws8Context(bytes32 handId) internal view returns(uint256[34] memory w){
        PokerConfidentialDeal420.Hand memory h=deal.getHand(handId);
        uint256[6] memory points=WS8VerifierData.keys();
        w[0]=uint256(handId);w[1]=uint256(TABLE);w[2]=uint256(h.configHash);
        w[3]=uint256(h.rulesetId);w[4]=uint256(h.versionId);w[5]=uint256(h.seatSnapshotHash);
        w[6]=h.epoch;w[7]=h.nonce;w[8]=uint256(h.transcriptCommitment);w[9]=block.chainid;
        w[10]=uint160(address(ws8Initial));w[11]=uint160(address(ws8Initial.verifier()));
        w[12]=uint256(ws8Initial.verifierVersion());w[13]=uint256(ws8Initial.circuitHash());
        w[14]=uint256(ws8Initial.verifyingKeyHash());w[15]=uint256(ws8Initial.publicSchemaHash());
        w[16]=uint256(ws8Initial.thresholdKeyCommitment());w[17]=uint160(address(ws8Shuffle));
        w[18]=uint256(ws8Shuffle.circuitId());w[19]=uint160(address(ws8Book));
        w[20]=uint160(address(ws8Recipients));w[21]=ledger.seatingEpoch(TABLE);
        w[22]=uint160(PLAYER);w[23]=ledger.seatOf(TABLE,0).epoch;
        w[24]=uint160(PLAYER_B);w[25]=ledger.seatOf(TABLE,1).epoch;
        w[26]=uint160(address(ws8Book.providerA()));w[27]=uint160(address(ws8Book.providerB()));
        for(uint8 k;k<6;k++)w[28+k]=points[k];
    }

}

#!/usr/bin/env python3
"""Generate genuine full on-chain WS3 proof-book / recipient / receipt acceptance.

All Groth16 proofs are emitted by the SAME real gnark circuits and
test-only verifying keys. The final deck root is inherited from the accepted
Workstream 2 two-stage Groth16 result, never user-supplied by a mock dealer.
"""
import json,pathlib,re,sys
if len(sys.argv)!=9:
    raise SystemExit("usage: script.py delivery-verifier delivery-fixtures pop-verifier pop-fixtures aggregate-verifier aggregate-fixture ws2-final-deck-fixture output.t.sol")
dv,df,pv,pf,av,af,w2,out=map(pathlib.Path,sys.argv[1:])
shares=json.loads(df.read_text())
recipients=json.loads(pf.read_text())
aggregate=json.loads(af.read_text())
root=int(json.loads(w2.read_text())["stageBRootOut"])
FR=21888242871839275222246405745257275088548364400416034343698204186575808495617
def checked(public,n):
    values=[int(v) for v in public]
    if len(values)!=n or any(v<0 or v>=FR for v in values):
        raise SystemExit("invalid/cross-field genuine public values")
    return values
def proofwords(data):
    value=data["proof"]
    if not value.startswith("0x") or len(value)!=514:
        raise SystemExit("malformed genuine gnark Solidity proof")
    return [int(value[2+i*64:2+(i+1)*64],16) for i in range(8)]
if len(shares)!=8 or len(recipients)!=2:raise SystemExit("must qualify 8 shares and 2 recipient PoP proofs")
for i,item in enumerate(shares):
    x=checked(item["public"],18)
    if x[:5]!=[420,root,i//2,(i//2)%2,i%2]:
        raise SystemExit("share position, seat, provider or final deck root inconsistent")
    if x[5]==0:raise SystemExit("missing bound delivery context")
for i,item in enumerate(recipients):
    x=checked(item["public"],3)
    if item["seat"]!=i or x[0]==0:raise SystemExit("invalid current seat/epoch PoP")
for i,item in enumerate(shares):
    x=checked(item["public"],18)
    owner=checked(recipients[(i//2)%2]["public"],3)
    if x[12]!=owner[1] or x[13]!=owner[2]:
        raise SystemExit("delivery proof recipient key mismatches actual key possession")
ax=checked(shares[0]["public"],18)[10:12]
bx=checked(shares[1]["public"],18)[10:12]
a=checked(aggregate["public"],7)
if a[0]==0 or a[1:3]!=ax or a[3:5]!=bx:
    raise SystemExit("provider aggregate proof uses unrelated parties")
if any(checked(s["public"],18)[10:12]!=(ax if idx%2==0 else bx)
       for idx,s in enumerate(shares)):
    raise SystemExit("provider share key mismatch")
def install(src,name):
    text=src.read_text()
    contracts=re.findall(r"^\s*contract\s+([A-Za-z_][A-Za-z0-9_]*)\b",text,re.M)
    if len(contracts)!=1:raise SystemExit("unexpected generated verifier Solidity ABI")
    text=re.sub(r"\bcontract\s+"+contracts[0]+r"\b","contract "+name,text,count=1)
    dest=pathlib.Path("src/bet/generated/"+name+".sol")
    dest.parent.mkdir(parents=True,exist_ok=True)
    dest.write_text(text)
install(dv,"WS3FullDeliveryVerifier")
install(pv,"WS3FullRecipientPoPVerifier")
install(av,"WS3FullAggregateVerifier")
def words(v):return ",".join("uint256("+str(i)+")" for i in v)
src=r'''// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../../src/bet/generated/WS3FullDeliveryVerifier.sol";
import "../../src/bet/generated/WS3FullRecipientPoPVerifier.sol";
import "../../src/bet/generated/WS3FullAggregateVerifier.sol";
import "../../src/bet/PokerRecipientKeys420.sol";
import "../../src/bet/PokerDeliveryProofBook420.sol";
import "../../src/bet/PokerDeckDisclosure420.sol";
import "../../src/bet/PokerGnarkRecipientKeyPoPAdapter420.sol";
import "../../src/bet/PokerGnarkThresholdKeyAggregateAdapter420.sol";

interface VmWS3Integration {
    function chainId(uint256) external;
    function prank(address) external;
    function expectRevert(bytes4) external;
    function expectRevert() external;
    function etch(address,bytes calldata) external;
}
contract WS3AlwaysAuthorized {
    function scopeGlobal() external pure returns(bytes32){return bytes32(uint256(1));}
    function scopeForTable(bytes32 table) external pure returns(bytes32){return table;}
    function isAuthorized(address,bytes32,bytes32,uint256) external pure returns(bool){return true;}
}
contract WS3Ledger {
    WS3AlwaysAuthorized public immutable auth;
    constructor(address auth_){auth=WS3AlwaysAuthorized(auth_);}
    function authorization() external view returns(BetAuthorization420){return BetAuthorization420(address(auth));}
    function playerSeatPlusOne(bytes32,address player) external pure returns(uint8){
        if(player==address(0xA001))return 1;
        if(player==address(0xA002))return 2;
        return 0;
    }
    function seatOf(bytes32,uint8 index) external pure returns(PokerSeatLedger420.Seat memory s){
        if(index>1)return s;
        s.player=index==0?address(0xA001):address(0xA002);
        s.chips=400;s.epoch=7;s.sittingOut=false;
    }
    function seatingEpoch(bytes32) external pure returns(uint64){return 7;}
    function activeHand(bytes32) external pure returns(bytes32){return bytes32(uint256(420));}
}
contract WS3Deal {
    WS3Ledger public immutable realLedger;
    WS3AlwaysAuthorized public immutable auth;
    address public constant providerA=address(0xAA54);
    address public constant providerB=address(0xBB54);
    constructor(address ledger_,address auth_){realLedger=WS3Ledger(ledger_);auth=WS3AlwaysAuthorized(auth_);}
    function ledger() external view returns(PokerSeatLedger420){return PokerSeatLedger420(address(realLedger));}
    function authorization() external view returns(BetAuthorization420){return BetAuthorization420(address(auth));}
    function ACTION_PROVIDER_COMMIT() external pure returns(bytes32){return keccak256("PROVIDER_COMMIT");}
    function handSeatMask(bytes32) external pure returns(uint16){return 3;}
    function snapshotFor(bytes32,uint16) external pure returns(bytes32){return keccak256("test-snapshot");}
    function getHand(bytes32) external pure returns(PokerConfidentialDeal420.Hand memory h){
        h.tableId=keccak256("test-table");
        h.configHash=keccak256("test-config");
        h.rulesetId=keccak256("test-rules");
        h.versionId=keccak256("test-version");
        h.seatSnapshotHash=keccak256("test-snapshot");
        h.transcriptCommitment=keccak256("test-transcript");
        h.epoch=7;h.nonce=2;
        h.state=PokerConfidentialDeal420.State.COMMITTED;
    }
}
contract WS3AcceptedShuffle {
    address public immutable upstreamDeal;
    bytes32 public immutable threshold;
    bytes32 public immutable finalRoot;
    constructor(address deals_,bytes32 key_,bytes32 root_){
        upstreamDeal=deals_;threshold=key_;finalRoot=root_;
    }
    function deals() external view returns(PokerConfidentialDeal420){return PokerConfidentialDeal420(upstreamDeal);}
    function thresholdKeyCommitment() external view returns(bytes32){return threshold;}
    function recordOf(bytes32) external view returns(PokerPrivateShuffleGate420.Record memory r){
        r.stage=2;r.finalDeckRoot=finalRoot;
    }
}
contract WS3FrozenAssignment {
    PokerConfidentialDeal420 public immutable deals;
    PokerPrivateShuffleGate420 public immutable shuffle;
    bool public ready;
    constructor(address d,address s){deals=PokerConfidentialDeal420(d);shuffle=PokerPrivateShuffleGate420(s);}
    function prepare() external {ready=true;}
    function holeSeatForPosition(bytes32,uint8 position) external view returns(uint8){
        require(ready && position<4,"unprepared card assignment");
        return position%2;
    }
    function isHandInitialized(bytes32) external pure returns(bool){return false;}
}
contract WS3FullActualDeliveryBookTest {
    VmWS3Integration constant vm=VmWS3Integration(address(uint160(uint256(keccak256("hevm cheat code")))));
    bytes32 constant HAND=bytes32(uint256(420));
    bytes32 constant TABLE=keccak256("test-table");
    bytes32 constant ROOT=bytes32(uint256(__ROOT__));
    address constant PLAYER0=address(0xA001);
    address constant PLAYER1=address(0xA002);
    address constant PROVIDER0=address(0xAA54);
    address constant PROVIDER1=address(0xBB54);
    WS3Ledger ledger;
    WS3Deal deals;
    WS3FrozenAssignment assignment;
    PokerRecipientKeys420 keys;
    PokerDeckDisclosure420 disclosure;
    PokerDeliveryProofBook420 book;
    PokerGnarkEncryptedShareDeliveryAdapter420 provider0;
    PokerGnarkEncryptedShareDeliveryAdapter420 provider1;
    PokerGnarkRecipientKeyPoPAdapter420 pop;
    PokerGnarkThresholdKeyAggregateAdapter420 aggregate;
    function _key(uint8 seat) private pure returns(uint256[8] memory p,uint256[3] memory x){
        if(seat==0){p=[__POP0_PROOF__];x=[__POP0_PUBLIC__];return(p,x);}
        p=[__POP1_PROOF__];x=[__POP1_PUBLIC__];
    }
    function _aggregate() private pure returns(uint256[8] memory p,uint256[7] memory x){
        p=[__AGG_PROOF__];x=[__AGG_PUBLIC__];
    }
    function _share(uint8 i) private pure returns(uint256[8] memory p,uint256[18] memory x){
__ALL_EIGHT_CASES__
        revert("unknown WS3 proof index");
    }
    function _installRegistry() internal returns(PokerVerifierVersions420 versions) {
        versions=new PokerVerifierVersions420(address(this));
        WS3FullDeliveryVerifier verifier=new WS3FullDeliveryVerifier();
        WS3FullRecipientPoPVerifier keyVerifier=new WS3FullRecipientPoPVerifier();
        WS3FullAggregateVerifier aggregateVerifier=new WS3FullAggregateVerifier();
        versions.register(keccak256("WS3 delivery version"),address(verifier),
            keccak256("delivery pinned VK"),keccak256("delivery circuit"),keccak256("delivery 18-fields"));
        versions.register(keccak256("WS3 PoP version"),address(keyVerifier),
            keccak256("PoP pinned VK"),keccak256("PoP circuit"),keccak256("PoP 3-fields"));
        versions.register(keccak256("WS3 aggregate version"),address(aggregateVerifier),
            keccak256("aggregate pinned VK"),keccak256("aggregate circuit"),keccak256("aggregate 7-fields"));
        PokerGnarkEncryptedShareDeliveryAdapter420 a=new PokerGnarkEncryptedShareDeliveryAdapter420(
            address(verifier),address(versions),keccak256("WS3 delivery version"),
            keccak256("delivery circuit"),keccak256("delivery pinned VK"),
            keccak256("delivery 18-fields"),keccak256(abi.encode(__AX__,__AY__)));
        PokerGnarkEncryptedShareDeliveryAdapter420 b=new PokerGnarkEncryptedShareDeliveryAdapter420(
            address(verifier),address(versions),keccak256("WS3 delivery version"),
            keccak256("delivery circuit"),keccak256("delivery pinned VK"),
            keccak256("delivery 18-fields"),keccak256(abi.encode(__BX__,__BY__)));
        vm.etch(address(0x2001),address(a).code);
        vm.etch(address(0x2002),address(b).code);
        provider0=PokerGnarkEncryptedShareDeliveryAdapter420(address(0x2001));
        provider1=PokerGnarkEncryptedShareDeliveryAdapter420(address(0x2002));
        pop=new PokerGnarkRecipientKeyPoPAdapter420(
            address(keyVerifier),address(versions),keccak256("WS3 PoP version"),
            keccak256("PoP pinned VK"),keccak256("PoP circuit"),keccak256("PoP 3-fields"));
        aggregate=new PokerGnarkThresholdKeyAggregateAdapter420(
            address(aggregateVerifier),address(versions),keccak256("WS3 aggregate version"),
            keccak256("aggregate circuit"),keccak256("aggregate pinned VK"),
            keccak256("aggregate 7-fields"),keccak256(abi.encode(__TX__,__TY__)));
    }
    function setUp() public {
        vm.chainId(31337);
        WS3AlwaysAuthorized auth=new WS3AlwaysAuthorized();
        ledger=new WS3Ledger(address(auth));
        deals=new WS3Deal(address(ledger),address(auth));
        WS3AcceptedShuffle originalShuffle=new WS3AcceptedShuffle(address(deals),
            keccak256(abi.encode(__TX__,__TY__)),ROOT);
        vm.etch(address(0x1003),address(originalShuffle).code);
        PokerRecipientKeys420 originalKeys=new PokerRecipientKeys420(address(ledger));
        vm.etch(address(0x1005),address(originalKeys).code);
        keys=PokerRecipientKeys420(address(0x1005));
        disclosure=new PokerDeckDisclosure420(address(deals),address(keys));
        assignment=new WS3FrozenAssignment(address(deals),address(0x1003));
        _installRegistry();
        PokerDeliveryProofBook420 originalBook=new PokerDeliveryProofBook420(
            address(deals),address(disclosure),address(0x1003),address(assignment),
            address(provider0),address(provider1),address(aggregate));
        vm.etch(address(0x1006),address(originalBook).code);
        book=PokerDeliveryProofBook420(address(0x1006));
        keys.bindProofVerifier(address(pop));
        disclosure.bindProofBook(TABLE,address(book));
        require(book.keys()==keys&&book.deals()==PokerConfidentialDeal420(address(deals)),
            "incomplete exact contract integration");
    }
    function _proveKeysAndThreshold() private {
        for(uint8 i=0;i<2;i++){
            (uint256[8] memory p,uint256[3] memory x)=_key(i);
            address player=i==0?PLAYER0:PLAYER1;
            require(keys.scopeForKey(TABLE,player,7)==x[0],"current seat and epoch PoP scope mismatch");
            vm.prank(player);
            keys.bindVerifiedKey(TABLE,x[1],x[2],abi.encode(p,x));
        }
        (uint256[8] memory p,uint256[7] memory x)=_aggregate();
        uint256[6] memory publicKeys;
        for(uint256 i=0;i<6;i++)publicKeys[i]=x[i+1];
        require(book.aggregateScope(publicKeys)==x[0],"provider aggregate context mismatched");
        book.proveAggregateKey(publicKeys,abi.encode(p,x));
    }
    function _prove(uint8 i) private {
        (uint256[8] memory p,uint256[18] memory x)=_share(i);
        uint8 position=uint8(x[2]);
        uint8 seat=uint8(x[3]);
        uint8 provider=uint8(x[4]);
        uint256[12] memory points;
        for(uint256 j=0;j<12;j++)points[j]=x[j+6];
        (,,bytes32 fingerprint)=keys.encryptionKeyOf(TABLE,seat);
        require(book.context(HAND,position,seat,provider,ROOT,fingerprint,7,points)==x[5],
            "context mismatch: key, hand, assignment, ciphertext or provider");
        vm.prank(provider==0?PROVIDER0:PROVIDER1);
        book.proveEncryptedShare(HAND,position,provider,points,abi.encode(p,x));
        uint256[4] memory stored=book.encryptedShareOf(HAND,position,provider);
        for(uint8 j=0;j<4;j++)require(stored[j]==points[8+j],"wrong verified encrypted share bytes");
    }
    function testGenuineEightShareProofBookAndSeatedOwnerOnlyReceipt() public {
        _proveKeysAndThreshold();
        vm.prank(PROVIDER0);
        disclosure.publish(HAND,keccak256("canonical deck commitment"),keccak256("encrypted manifest"));
        require(!disclosure.allAcknowledged(HAND),"dealer receipt alone authorized game");
        (uint256[8] memory p,uint256[18] memory x)=_share(0);
        uint256[12] memory points;
        for(uint256 j=0;j<12;j++)points[j]=x[j+6];
        vm.expectRevert();
        vm.prank(PROVIDER0);
        book.proveEncryptedShare(HAND,0,0,points,abi.encode(p,x));
        assignment.prepare();
        for(uint8 i=0;i<7;i++)_prove(i);
        vm.expectRevert(PokerDeliveryProofBook420.InvalidState.selector);
        book.envelopeHashFor(HAND,0);
        _prove(7);
        bytes32 a=book.envelopeHashFor(HAND,0);
        bytes32 b=book.envelopeHashFor(HAND,1);
        require(a!=bytes32(0)&&b!=bytes32(0)&&a!=b,"must have two separate physical-card envelopes");
        (,,bytes32 f0)=keys.encryptionKeyOf(TABLE,0);
        (,,bytes32 f1)=keys.encryptionKeyOf(TABLE,1);
        vm.prank(PROVIDER0);disclosure.bindEnvelope(HAND,0,a,f0);
        vm.prank(PROVIDER1);disclosure.bindEnvelope(HAND,1,b,f1);
        require(book.allVerified(HAND),"all eight verifiable shares not connected to envelopes");
        require(!disclosure.allAcknowledged(HAND),"dealer envelopes without player receipts cannot start");
        bytes32 r0=disclosure.receiptDigest(HAND,0);
        bytes32 r1=disclosure.receiptDigest(HAND,1);
        vm.expectRevert(PokerDeckDisclosure420.NotRecipient.selector);
        vm.prank(PROVIDER0);
        disclosure.acknowledge(HAND,0,r0);
        vm.expectRevert(PokerDeckDisclosure420.InvalidValue.selector);
        vm.prank(PLAYER0);
        disclosure.acknowledge(HAND,0,r1);
        vm.prank(PLAYER0);disclosure.acknowledge(HAND,0,r0);
        require(!disclosure.allAcknowledged(HAND),"missing other recipient receipt");
        vm.prank(PLAYER1);disclosure.acknowledge(HAND,1,r1);
        require(disclosure.allAcknowledged(HAND),"two individually authenticated player receipts required");
    }
    function testRecipientAndProviderSubstitutionAndProofReplayRejected() public {
        _proveKeysAndThreshold();
        assignment.prepare();
        (uint256[8] memory p,uint256[18] memory x)=_share(0);
        uint256[12] memory points;
        for(uint256 i=0;i<12;i++)points[i]=x[i+6];
        vm.expectRevert(PokerDeliveryProofBook420.InvalidProof.selector);
        vm.prank(PROVIDER1);
        book.proveEncryptedShare(HAND,0,0,points,abi.encode(p,x));
        points[6]++;
        vm.expectRevert(PokerDeliveryProofBook420.InvalidProof.selector);
        vm.prank(PROVIDER0);
        book.proveEncryptedShare(HAND,0,0,points,abi.encode(p,x));
        points[6]--;
        vm.expectRevert(PokerDeliveryProofBook420.InvalidProof.selector);
        vm.prank(PROVIDER0);
        book.proveEncryptedShare(HAND,4,0,points,abi.encode(p,x));
        vm.prank(PROVIDER0);
        book.proveEncryptedShare(HAND,0,0,points,abi.encode(p,x));
        vm.expectRevert(PokerDeliveryProofBook420.Duplicate.selector);
        vm.prank(PROVIDER0);
        book.proveEncryptedShare(HAND,0,0,points,abi.encode(p,x));
        require(!disclosure.allAcknowledged(HAND),"one authorized ciphertext cannot start a hand");
    }
}
'''
src=src.replace("__ROOT__",str(root))
for k,v in {"__AX__":ax[0],"__AY__":ax[1],"__BX__":bx[0],"__BY__":bx[1],"__TX__":a[5],"__TY__":a[6]}.items():
    src=src.replace(k,str(v))
for i,item in enumerate(recipients):
    src=src.replace("__POP"+str(i)+"_PROOF__",words(proofwords(item)))
    src=src.replace("__POP"+str(i)+"_PUBLIC__",words(checked(item["public"],3)))
src=src.replace("__AGG_PROOF__",words(proofwords(aggregate)))
src=src.replace("__AGG_PUBLIC__",words(a))
cases=[]
for i,item in enumerate(shares):
    cases.append("        if(i=="+str(i)+"){p=["+words(proofwords(item))+"];x=["+
                 words(checked(item["public"],18))+"];return(p,x);}")
src=src.replace("__ALL_EIGHT_CASES__","\n".join(cases))
out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(src)
print("Generated real complete on-chain WS3: two key possession, aggregate, eight encrypted shares, exact proof book, seat freeze, recipient envelopes and owner-only acknowledgements:",out)

#!/usr/bin/env python3
"""Qualify eight real Groth16 encrypted shares against the actual Solidity adapter.
Uses the same generated verifier/VK for both providers and two separate recipients.
Exact final ciphertext root MUST equal the qualified Workstream 2 final deck.
"""
import json, pathlib, re, sys
if len(sys.argv)!=5:
    raise SystemExit("usage: script.py verifier.sol eight-shares.json ws2-availability.json output.t.sol")
verifier,fixture,ws2,out = map(pathlib.Path,sys.argv[1:])
data=json.loads(fixture.read_text())
prior=json.loads(ws2.read_text())
FR=21888242871839275222246405745257275088548364400416034343698204186575808495617
if len(data)!=8:raise SystemExit("expected eight genuine proofs")
root=int(prior["stageBRootOut"])
pubs=[]
proofs=[]
for index,d in enumerate(data):
    pub=[int(v) for v in d["public"]]
    if len(pub)!=18 or any(v<0 or v>=FR for v in pub):
        raise SystemExit("invalid public field")
    if (pub[0],pub[1],pub[2],pub[3],pub[4])!=(420,root,index//2,(index//2)%2,index%2):
        # generator loops position,provider; for 0..7: p=i//2, seat=p%2
        raise SystemExit("invalid physical-position, recipient, provider or authenticated root")
    if d["position"]!=pub[2] or d["seat"]!=pub[3] or d["provider"]!=pub[4]:
        raise SystemExit("fixture metadata disagrees with proof")
    proof=d["proof"]
    if not proof.startswith("0x") or len(proof)!=514:raise SystemExit("invalid gnark solidity bytes")
    proofs.append([int(proof[2+j*64:2+(j+1)*64],16) for j in range(8)])
    pubs.append(pub)
if pubs[0][10:12]==pubs[1][10:12]:
    raise SystemExit("two providers share same decryption scalar public key")
for pos in range(4):
    for provider in range(2):
        p=pubs[2*pos+provider]
        if p[12:14]!=pubs[2*pos+(1-provider)][12:14]:
            raise SystemExit("provider B encrypted to different recipient")
        if p[6:10]!=pubs[2*pos+(1-provider)][6:10]:
            raise SystemExit("swapped provider plaintext deck card ciphertext")
if pubs[0][12:14]==pubs[2][12:14]:
    raise SystemExit("two seats reuse a recipient decryption key")
text=verifier.read_text()
contracts=re.findall(r"^\s*contract\s+(\w+)\b",text,re.M)
if len(contracts)!=1:raise SystemExit("unexpected generated verifier contract")
name="QualifiedWS3EightDeliveryGroth16"
text=re.sub(r"\bcontract\s+"+re.escape(contracts[0])+r"\b","contract "+name,text,count=1)
dst=pathlib.Path("src/bet/generated/QualifiedWS3EightDeliveryGroth16.sol")
dst.parent.mkdir(parents=True,exist_ok=True)
dst.write_text(text)
def words(values):
    return ",".join("uint256("+str(x)+")" for x in values)
header=r'''// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../../src/bet/generated/QualifiedWS3EightDeliveryGroth16.sol";
import "../../src/bet/PokerGnarkEncryptedShareDeliveryAdapter420.sol";
import "../../src/bet/PokerVerifierVersions420.sol";
contract WS3EightActualGroth16Test {
  function _registry() internal returns(
    PokerVerifierVersions420 versions, PokerGnarkEncryptedShareDeliveryAdapter420 a,
    PokerGnarkEncryptedShareDeliveryAdapter420 b) {
    QualifiedWS3EightDeliveryGroth16 generated=new QualifiedWS3EightDeliveryGroth16();
    versions=new PokerVerifierVersions420(address(this));
    bytes32 version=keccak256("WS3 actual eight shares");
    bytes32 vk=keccak256("WS3 actual verifying key");
    bytes32 circuit=keccak256("WS3 actual 52-card membership proof");
    bytes32 schema=keccak256("WS3 actual 18-field schema");
    versions.register(version,address(generated),vk,circuit,schema);
    a=new PokerGnarkEncryptedShareDeliveryAdapter420(address(generated),
        address(versions),version,circuit,vk,schema,
        keccak256(abi.encode(__A_X__,__A_Y__)));
    b=new PokerGnarkEncryptedShareDeliveryAdapter420(address(generated),
        address(versions),version,circuit,vk,schema,
        keccak256(abi.encode(__B_X__,__B_Y__)));
  }
  function _check(PokerGnarkEncryptedShareDeliveryAdapter420 a,
    PokerGnarkEncryptedShareDeliveryAdapter420 b,
    uint256[8] memory proof,uint256[18] memory input) internal view {
    uint256[12] memory points;
    for(uint256 i=0;i<12;i++)points[i]=input[i+6];
    PokerGnarkEncryptedShareDeliveryAdapter420 adapter=input[4]==0?a:b;
    bytes memory packed=abi.encode(proof,input);
    bytes32 root=bytes32(input[1]);
    require(input[1]==__ROOT__,"not the authenticated final deck root");
    require(adapter.verifyDelivery(bytes32(input[0]),root,uint8(input[2]),
        uint8(input[3]),uint8(input[4]),input[5],points,packed),
        "genuine provider/recipient proof rejected on chain");
    require(!adapter.verifyDelivery(bytes32(input[0]),root,uint8(input[2]),
        uint8(input[3]),uint8(input[4]),input[5]+1,points,packed),
        "context replay");
    require(!adapter.verifyDelivery(bytes32(input[0]),root,uint8(input[2]),
        uint8(input[3]),uint8(1-input[4]),input[5],points,packed),
        "wrong provider");
    require(!adapter.verifyDelivery(bytes32(input[0]),root,uint8(input[2]),
        uint8(1-input[3]),uint8(input[4]),input[5],points,packed),
        "swapped seat");
    require(!adapter.verifyDelivery(bytes32(input[0]),root,uint8(input[2]+1),
        uint8(input[3]),uint8(input[4]),input[5],points,packed),
        "wrong physical card");
    require(!adapter.verifyDelivery(bytes32(input[0]),bytes32(input[1]+1),uint8(input[2]),
        uint8(input[3]),uint8(input[4]),input[5],points,packed),
        "different final deck");
    points[6]++; // wrong recipient decryption key
    require(!adapter.verifyDelivery(bytes32(input[0]),root,uint8(input[2]),
        uint8(input[3]),uint8(input[4]),input[5],points,packed),
        "wrong recipient accepted");
  }
  function testEightGenuineProviderSharesForTwoRecipientHoleCards() public {
    (,PokerGnarkEncryptedShareDeliveryAdapter420 a,
      PokerGnarkEncryptedShareDeliveryAdapter420 b)=_registry();
__PROOFS__
  }
}
'''
code=header.replace("__ROOT__",str(root))
for k,v in {"__A_X__":pubs[0][10],"__A_Y__":pubs[0][11],
            "__B_X__":pubs[1][10],"__B_Y__":pubs[1][11]}.items():
    code=code.replace(k,str(v))
instances=[]
for i,(p,inputs) in enumerate(zip(proofs,pubs)):
    instances.append("    {uint256[8] memory p=["+words(p)+"];uint256[18] memory x=["+words(inputs)+"];_check(a,b,p,x);}")
code=code.replace("__PROOFS__","\n".join(instances))
out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(code)
print("Generated eight genuine, full-deck-root-matched, provider- and seat-bound Solidity proof tests",out)

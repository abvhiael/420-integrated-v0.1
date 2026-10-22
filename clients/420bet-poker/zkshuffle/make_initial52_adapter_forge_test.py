#!/usr/bin/env python3
"""Generate actual Groth16 verifier+on-chain adapter proof tests from a 52-card fixture."""
import json, pathlib, re, sys
if len(sys.argv)!=4: raise SystemExit("usage: script.py generated-verifier.sol fixture.json output.t.sol")
verifier,fixture,out=map(pathlib.Path,sys.argv[1:])
names=re.findall(r'^\s*contract\s+(\w+)',verifier.read_text(),re.M)
if len(names)!=1: raise SystemExit("expected one generated verifier")
data=json.loads(fixture.read_text())
raw=data['proof']
if len(raw)!=514 or not raw.startswith('0x'):raise SystemExit("invalid proof")
proof=[int(raw[2+64*i:2+64*(i+1)],16) for i in range(8)]
public=list(map(int,data['public']))
FR=21888242871839275222246405745257275088696311157297823662689037894645226208583
if len(public)!=5 or any(x<0 or x>=FR for x in public):raise SystemExit("wrong canonical 52-card inputs")
p=','.join('uint256(%d)'%x for x in proof)
inputs=','.join('uint256(%d)'%x for x in public)
src='''// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../src/bet/generated/%s";
import "../src/bet/PokerGnarkElGamalAdapters420.sol";
contract PokerInitial52RealAdapterQualification {
 function testRealProofThroughPinnedAdapter() public {
  %s verifier=new %s();
  PokerVerifierVersions420 registry=new PokerVerifierVersions420(address(this));
  bytes32 version=keccak256("initial-52-v2");
  bytes32 circuit=keccak256("gnark-initial-52-context");
  bytes32 vk=keccak256("test-only-vk");
  bytes32 schema=keccak256("root,statement,hand,pkx,pky");
  uint256[8] memory proof=[%s];
  uint256[5] memory inputs=[%s];
  bytes32 key=keccak256(abi.encode(inputs[3],inputs[4]));
  registry.register(version,address(verifier),vk,circuit,schema);
  PokerGnarkInitial52Adapter420 adapter=new PokerGnarkInitial52Adapter420(address(verifier),address(registry),version,circuit,vk,schema,key);
  bytes memory packed=abi.encode(proof,inputs);
  bytes32 context=bytes32(inputs[1]);
  bytes32 hand=bytes32(inputs[2]);
  bytes32 root=bytes32(inputs[0]);
  require(adapter.verifyInitialDeck(context,hand,root,key,packed),"genuine 52-card adapter proof rejected");
  require(!adapter.verifyInitialDeck(bytes32(uint256(inputs[1]+1)),hand,root,key,packed),"cross-context replay accepted");
  require(!adapter.verifyInitialDeck(context,bytes32(uint256(inputs[2]+1)),root,key,packed),"cross-hand replay accepted");
  require(!adapter.verifyInitialDeck(context,hand,bytes32(uint256(inputs[0]+1)),key,packed),"changed deck root accepted");
  require(!adapter.verifyInitialDeck(context,hand,root,keccak256("wrong threshold key"),packed),"changed key accepted");
  proof[0]++;
  require(!adapter.verifyInitialDeck(context,hand,root,key,abi.encode(proof,inputs)),"corrupted cryptographic proof accepted");
 }
}
'''%(verifier.name,names[0],names[0],p,inputs)
out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(src)

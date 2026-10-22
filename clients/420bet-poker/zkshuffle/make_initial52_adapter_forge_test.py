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
FR=21888242871839275222246405745257275088548364400416034343698204186575808495617
if len(public)!=5 or any(x<0 or x>=FR for x in public):raise SystemExit("wrong canonical 52-card inputs")
p=','.join('uint256(%d)'%x for x in proof)
inputs=','.join('uint256(%d)'%x for x in public)
src='''// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../src/bet/generated/%s";
import "../src/bet/PokerGnarkElGamalAdapters420.sol";
import "../src/bet/PokerInitialEncryptedDeck420.sol";
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

src += ''' 
interface VmInitialReal54 {
 function etch(address,bytes calldata) external;
 function chainId(uint256) external;
 function expectRevert(bytes4) external;
}
contract CanonicalInitialHandReal54 {
 uint64 public epoch=7;
 bytes32 public tableId=keccak256("test-table");
 bytes32 public configHash=keccak256("test-config");
 bytes32 public rulesetId=keccak256("test-rules");
 bytes32 public versionId=keccak256("test-version");
 function setEpoch(uint64 nextEpoch) external {epoch=nextEpoch;}
 function setTableId(bytes32 nextValue) external {tableId=nextValue;}
 function setRulesetId(bytes32 nextValue) external {rulesetId=nextValue;}
 function setVersionId(bytes32 nextValue) external {versionId=nextValue;}
 function getHand(bytes32) external view returns(PokerConfidentialDeal420.Hand memory h) {
  h.tableId=tableId;
  h.configHash=configHash;
  h.rulesetId=rulesetId;
  h.versionId=versionId;
  h.seatSnapshotHash=keccak256("test-snapshot");
  h.epoch=epoch;
  h.nonce=2;
  h.transcriptCommitment=keccak256("test-transcript");
  h.state=PokerConfidentialDeal420.State.COMMITTED;
 }
}
contract PokerInitial52ActualContractQualification {
 VmInitialReal54 private constant vm=VmInitialReal54(address(uint160(uint256(keccak256("hevm cheat code")))));
 uint256 private constant FR=21888242871839275222246405745257275088548364400416034343698204186575808495617;
 function testActualContractGenuineProofAndContextReplay() public {
  %s realVerifier=new %s();
  PokerVerifierVersions420 registry=new PokerVerifierVersions420(address(this));
  bytes32 version=keccak256("initial-52-v2");
  bytes32 circuit=keccak256("gnark-initial-52-context");
  bytes32 vk=keccak256("test-only-vk");
  bytes32 schema=keccak256("root,statement,hand,pkx,pky");
  uint256[8] memory proof=[%s];
  uint256[5] memory inputs=[%s];
  bytes32 key=keccak256(abi.encode(inputs[3],inputs[4]));
  registry.register(version,address(realVerifier),vk,circuit,schema);
  PokerGnarkInitial52Adapter420 implementation=new PokerGnarkInitial52Adapter420(address(realVerifier),address(registry),version,circuit,vk,schema,key);
  address adapterAddress=address(0x1002);
  vm.etch(adapterAddress,address(implementation).code);
  bytes32 deckVersion=keccak256("initial-52-contract-v2");
  bytes32 deckCircuit=keccak256("initial-52-contract-circuit");
  bytes32 deckKey=keccak256("initial-52-contract-key");
  bytes32 deckSchema=keccak256("initial-52-contract-schema");
  registry.register(deckVersion,adapterAddress,deckKey,deckCircuit,deckSchema);
  CanonicalInitialHandReal54 deals=new CanonicalInitialHandReal54();
  PokerInitialEncryptedDeck420 installed=new PokerInitialEncryptedDeck420(address(deals),address(registry),adapterAddress,deckVersion,deckCircuit,deckKey,deckSchema,key);
  address deckAddress=address(0x1001);
  vm.etch(deckAddress,address(installed).code);
  PokerInitialEncryptedDeck420 deck=PokerInitialEncryptedDeck420(deckAddress);
  bytes32 hand=bytes32(uint256(420));
  bytes32 root=bytes32(inputs[0]);
  require(uint256(deck.statement(hand,root))%%FR==inputs[1],"context fixture does not match real contract");
  bytes memory packed=abi.encode(proof,inputs);
  vm.expectRevert(PokerInitialEncryptedDeck420.InvalidProof.selector);
  deck.submit(hand,bytes32(uint256(inputs[0]+1)),packed);
  deals.setEpoch(8);
  vm.expectRevert(PokerInitialEncryptedDeck420.InvalidProof.selector);
  deck.submit(hand,root,packed);
  deals.setEpoch(7);
  deals.setTableId(keccak256("wrong-table"));
  vm.expectRevert(PokerInitialEncryptedDeck420.InvalidProof.selector);
  deck.submit(hand,root,packed);
  deals.setTableId(keccak256("test-table"));
  deals.setRulesetId(keccak256("wrong-rules"));
  vm.expectRevert(PokerInitialEncryptedDeck420.InvalidProof.selector);
  deck.submit(hand,root,packed);
  deals.setRulesetId(keccak256("test-rules"));
  deals.setVersionId(keccak256("wrong-version"));
  vm.expectRevert(PokerInitialEncryptedDeck420.InvalidProof.selector);
  deck.submit(hand,root,packed);
  deals.setVersionId(keccak256("test-version"));
  vm.chainId(31338);
  vm.expectRevert(PokerInitialEncryptedDeck420.InvalidProof.selector);
  deck.submit(hand,root,packed);
  vm.chainId(31337);
  deck.submit(hand,root,packed);
  require(deck.rootOf(hand)==root,"genuine proof did not bind the on-chain deck");
  vm.expectRevert(PokerInitialEncryptedDeck420.Duplicate.selector);
  deck.submit(hand,root,packed);
 }
}
'''%(names[0],names[0],p,inputs)
out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(src)

// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../src/bridge/verifiers/PirateChainFinalityVerifier420.sol";
interface PirateProofVm {function readFile(string calldata) external view returns(string memory);function parseBytes(string calldata) external pure returns(bytes memory);}
contract PirateProofRouter {}
/// Controlled authority records around a genuine historical header. These are
/// adversarial boundary tests, NOT genuine native dPoW or owned-deposit evidence.
contract PirateChainFinalityVerifier420Test {
 PirateProofVm constant vm=PirateProofVm(address(uint160(uint256(keccak256("hevm cheat code")))));
 bytes32 constant ROUTE=bytes32(uint256(7));bytes32 constant KEY=bytes32(uint256(9));
 PirateProofRouter router;PirateChainFinalityVerifier420 verifier;
 function proof() internal returns(PirateChainFinalityVerifier420.Proof memory p) {
  router=new PirateProofRouter();
  p.header=vm.parseBytes(string.concat("0x",vm.readFile("contracts/test/fixtures/pirate/historical-header.hex")));
  p.transaction=hex"4200";p.memo=new bytes(512);
  PirateChainFinalityVerifier420.Record memory r;
  r.genesis=0x027e3758c3a65b12aa1046462b486d0a63bfa1beae327897f56c5cfb7daaae71;
  r.source=bytes32(bytes20(hex"b14db80bfc1a819b958e36d1e0127e94c395d445"));r.height=3_000_000;
  r.blockHash=0x000000000f4108bf11548d27b49d9823efac45f846331f1bf5c5140bdd008e74;
  r.headerSha256=sha256(p.header);r.rawTransactionSha256=sha256(p.transaction);r.transactionHash=bytes32(uint256(3));
  r.chainWork=7967024532;r.parentWork=1;r.saplingRoot=bytes32(uint256(4));r.ironwoodRoot=bytes32(uint256(5));
  r.notarizedHeight=r.height+1;r.notarizedHash=bytes32(uint256(6));r.notarizationTransaction=bytes32(uint256(8));
  r.notarySetHash=bytes32(uint256(10));r.anchorEvidenceDigest=bytes32(uint256(11));r.nativeExecutionDigest=bytes32(uint256(12));
  r.gatewayKeyId=KEY;r.noteCommitment=bytes32(uint256(13));r.nullifier=bytes32(uint256(14));r.noteRoot=r.saplingRoot;r.recipient=address(0xB0B);r.amount=100_000_000;r.validation=127;
  p.record=r;
 }
 function install(PirateChainFinalityVerifier420.Proof memory p,uint64 tip) internal {
  bytes32 leaf=sha256(abi.encode("420/ARRR/NATIVE-SHIELDED-STATE/V1",p.record));
  AuthenticatedCheckpoint420 c=new AuthenticatedCheckpoint420(address(this),keccak256("PIRATE/MAINNET"),address(1),tip,bytes32(uint256(33)),leaf);
  verifier=new PirateChainFinalityVerifier420(address(this),address(c),address(router));verifier.setGateway(KEY,ROUTE,p.record.pool,true);
 }
 function bind(PirateChainFinalityVerifier420.Proof memory p) internal view returns(PirateChainFinalityVerifier420.Proof memory){
  bytes memory prefix=abi.encodePacked(bytes8("420ARRR1"),verifier.depositDomain(ROUTE,KEY,p.record.pool),p.record.recipient,BridgeWire420.encodeLE(p.record.amount,8),BridgeWire420.encodeLE(p.record.outputIndex,4));
  for(uint256 i;i<prefix.length;++i)p.memo[i]=prefix[i];p.record.memoHash=sha256(p.memo);return p;
 }
 function ready() internal returns(PirateChainFinalityVerifier420.Proof memory p){
  p=proof();install(p,p.record.height+2);p=bind(p);
  // The checkpoint is immutable at its address; sign the changed root through
  // a fresh constructor and rebind destination domain after installing it.
  // Domain binds router/chain, never verifier/checkpoint address.
  install(p,p.record.height+2);
 }
 function reject(PirateChainFinalityVerifier420.Proof memory p) internal view {(bool ok,)=address(verifier).staticcall(abi.encodeCall(verifier.verifyFinalizedTransfer,(abi.encode(p))));require(!ok,"bad evidence accepted");}
 function testControlledAuthenticatedRecordPasses() public {PirateChainFinalityVerifier420.Proof memory p=ready();IPirateChainFinalityVerifier420.FinalizedTransfer memory x=verifier.verifyFinalizedTransfer(abi.encode(p));require(x.recipient==address(0xB0B)&&x.destinationRouter==address(router)&&x.gatewayKeyId==KEY&&x.routeId==ROUTE,"bindings");}
 function testUnauthenticatedRecordRejected() public {PirateChainFinalityVerifier420.Proof memory p=ready();p.record.amount++;reject(p);}
 function testRawRpcFlagsRejected() public {PirateChainFinalityVerifier420.Proof memory p=ready();p.record.validation=0;install(p,p.record.height+2);reject(p);}
 function testNoDpowFallback() public {PirateChainFinalityVerifier420.Proof memory p=ready();p.record.notarizedHeight=0;install(p,p.record.height+2);reject(p);}
 function testStrictNotarizationCoverage() public {PirateChainFinalityVerifier420.Proof memory p=ready();p.record.notarizedHeight=p.record.height;install(p,p.record.height+2);reject(p);}
 function testCrossChainAnchorRequired() public {PirateChainFinalityVerifier420.Proof memory p=ready();p.record.anchorEvidenceDigest=0;install(p,p.record.height+2);reject(p);}
 function testNotaryIdentitiesRequired() public {PirateChainFinalityVerifier420.Proof memory p=ready();p.record.notarySetHash=0;install(p,p.record.height+2);reject(p);}
 function testConfirmationsRequired() public {PirateChainFinalityVerifier420.Proof memory p=ready();install(p,p.record.height+1);reject(p);}
 function testWrongSourceRejected() public {PirateChainFinalityVerifier420.Proof memory p=ready();p.record.source=0;install(p,p.record.height+2);reject(p);}
 function testMainnetIdentityRequired() public {PirateChainFinalityVerifier420.Proof memory p=ready();p.record.genesis=0;install(p,p.record.height+2);reject(p);}
 function testRecoveryAnchorRequired() public {PirateChainFinalityVerifier420.Proof memory p=ready();p.record.height=4_200_000;p.record.notarizedHeight=p.record.height+1;install(p,p.record.height+2);reject(p);}
 function testNativeExecutionRequired() public {PirateChainFinalityVerifier420.Proof memory p=ready();p.record.nativeExecutionDigest=0;install(p,p.record.height+2);reject(p);}
 function testViewingCredentialBindingRequired() public {PirateChainFinalityVerifier420.Proof memory p=ready();verifier.setGateway(KEY,ROUTE,0,false);reject(p);}
 function testNoteWitnessRootRequired() public {PirateChainFinalityVerifier420.Proof memory p=ready();p.record.noteRoot=p.record.ironwoodRoot;install(p,p.record.height+2);reject(p);}
 function testNoncanonicalIndexRejected() public {PirateChainFinalityVerifier420.Proof memory p=ready();p.index=1;reject(p);}
 function testRawTransactionSubstitutionRejected() public {PirateChainFinalityVerifier420.Proof memory p=ready();p.transaction=hex"4201";reject(p);}
 function testWrongDomainRejected() public {PirateChainFinalityVerifier420.Proof memory p=ready();p.memo[8]^=0x01;p.record.memoHash=sha256(p.memo);install(p,p.record.height+2);reject(p);}
 function testMemoPaddingRejected() public {PirateChainFinalityVerifier420.Proof memory p=ready();p.memo[511]=0x01;p.record.memoHash=sha256(p.memo);install(p,p.record.height+2);reject(p);}
 function testMemoAmountRejected() public {PirateChainFinalityVerifier420.Proof memory p=ready();p.memo[60]^=0x01;p.record.memoHash=sha256(p.memo);install(p,p.record.height+2);reject(p);}
 function testOldAuthorityEpochRejected() public {PirateChainFinalityVerifier420.Proof memory p=ready();verifier.checkpoints().rotate(address(2));reject(p);}
 function testChainWorkMustIncrease() public {PirateChainFinalityVerifier420.Proof memory p=ready();p.record.parentWork=p.record.chainWork;install(p,p.record.height+2);reject(p);}
}

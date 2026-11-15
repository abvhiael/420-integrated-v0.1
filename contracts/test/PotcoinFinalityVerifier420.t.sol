// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../src/bridge/verifiers/PotcoinFinalityVerifier420.sol";
interface PotVm420 {function readFileBinary(string calldata) external view returns(bytes memory);function warp(uint256) external;function chainId(uint256) external;function etch(address,bytes calldata) external;}
contract PotConsensusHarness420 {
 function next(uint32 b,uint32 l,uint32 o) external pure returns(uint32){return PotcoinConsensus420.nextBits(b,l,o,true);}
 function weight(uint64 a,uint32 p,uint32 t) external pure returns(uint256){return PotcoinConsensus420.coinDayWeight(a,p,t);}
 function target(uint32 b) external pure returns(uint256){return PotcoinConsensus420.target(b,true);}
 function kind(uint64 h,bool p) external pure{PotcoinConsensus420.kind(h,p);}
 function parse(bytes memory b) external pure returns(bytes32){return PotcoinWire420.parse(b).id;}
}
contract PotcoinFinalityVerifier420Test {
 PotVm420 constant vm=PotVm420(address(uint160(uint256(keccak256("hevm cheat code")))));
 PotcoinFinalityVerifier420 verifier;AuthenticatedCheckpoint420 checkpoints;PotConsensusHarness420 math;
 bytes proof;bytes32 constant NETWORK=keccak256("POTCOIN/MAINNET");address constant ROUTER=address(0x420420);
 function setUp() public {vm.chainId(420);vm.warp(1777803100);vm.etch(ROUTER,hex"00");math=new PotConsensusHarness420();proof=vm.readFileBinary("contracts/test/fixtures/potcoin/controlled-proof.bin");_install(_decode());}
 function _decode() private view returns(PotcoinFinalityVerifier420.Proof memory){return abi.decode(proof,(PotcoinFinalityVerifier420.Proof));}
 function _install(PotcoinFinalityVerifier420.Proof memory p) private {
  bytes32 leaf=sha256(abi.encode("420/POT/NATIVE-REPLAY-STATE/V1",p.state));
  checkpoints=new AuthenticatedCheckpoint420(address(this),NETWORK,address(123),605,bytes32(uint256(99)),leaf);
  verifier=new PotcoinFinalityVerifier420(address(this),address(checkpoints),ROUTER,6);
  verifier.setGateway(sha256(hex"76a914424242424242424242424242424242424242424288ac"),keccak256("420/BRIDGE/ROUTE/POT/MAINNET"));
 }
 function _reject(PotcoinFinalityVerifier420.Proof memory p,bool authenticateMutation) private {
  if(authenticateMutation)_install(p);
  (bool ok,)=address(verifier).staticcall(abi.encodeCall(verifier.verifyFinalizedTransfer,(abi.encode(p))));require(!ok,"accepted invalid proof");
 }
 function testControlledNativeX13SignedDeposit() public view {
  uint256 start=gasleft();IPotcoinFinalityVerifier420.FinalizedTransfer memory r=verifier.verifyFinalizedTransfer(proof);
  require(start-gasleft()<30000000,"production gas");require(r.amountPotSatoshis==4200000000&&r.recipient==address(0xb0b)&&r.routeId==keccak256("420/BRIDGE/ROUTE/POT/MAINNET"),"transfer");
 }
 function testUnauthenticatedRpcClaimRejected() public {PotcoinFinalityVerifier420.Proof memory p=_decode();p.state.kernelModifier++;_reject(p,false);}
 function testSpentStakeRejected() public {PotcoinFinalityVerifier420.Proof memory p=_decode();p.state.originUnspent=false;_reject(p,true);}
 function testImmatureStakeRejected() public {PotcoinFinalityVerifier420.Proof memory p=_decode();p.state.originHeight=599;_reject(p,true);}
 function testOriginAmountSubstitutionRejected() public {PotcoinFinalityVerifier420.Proof memory p=_decode();p.state.originAmount--;_reject(p,true);}
 function testOriginTransactionSubstitutionRejected() public {PotcoinFinalityVerifier420.Proof memory p=_decode();p.originTransaction[10]^=0x01;_reject(p,false);}
 function testWrongGenesisRejected() public {PotcoinFinalityVerifier420.Proof memory p=_decode();p.state.genesis=bytes32(uint256(1));_reject(p,true);}
 function testWrongConsensusRevisionRejected() public {PotcoinFinalityVerifier420.Proof memory p=_decode();p.state.consensusSource=bytes32(uint256(1));_reject(p,true);}
 function testBootstrapRejected() public {PotcoinFinalityVerifier420.Proof memory p=_decode();p.state.height=500;_reject(p,true);}
 function testWrongChainTrustRejected() public {PotcoinFinalityVerifier420.Proof memory p=_decode();p.state.chainTrust++;_reject(p,true);}
 function testWrongDifficultyRejected() public {PotcoinFinalityVerifier420.Proof memory p=_decode();p.state.previousStakeBits=0x1d00ffff;_reject(p,true);}
 function testMedianTimeRejected() public {PotcoinFinalityVerifier420.Proof memory p=_decode();p.state.medianTimePast=1777803100;_reject(p,true);}
 function testFutureTimeRejected() public {vm.warp(1777803039);_reject(_decode(),false);}
 function testBadSignatureRejected() public {PotcoinFinalityVerifier420.Proof memory p=_decode();p.blockSignature[10]^=0x01;_reject(p,false);}
 function testBadCoinstakeMerkleRejected() public {PotcoinFinalityVerifier420.Proof memory p=_decode();p.coinstakeBranch[0]=bytes32(uint256(1));_reject(p,false);}
 function testBadDepositMerkleRejected() public {PotcoinFinalityVerifier420.Proof memory p=_decode();p.transactionBranch[0]=bytes32(uint256(1));_reject(p,false);}
 function testDuplicateOddBranchSubstitutionRejected() public {PotcoinFinalityVerifier420.Proof memory p=_decode();p.transactionCount=4;_reject(p,false);}
 function testWrongOutputRejected() public {PotcoinFinalityVerifier420.Proof memory p=_decode();p.outputIndex=1;_reject(p,false);}
 function testWrongRouteRejected() public {PotcoinFinalityVerifier420.Proof memory p=_decode();p.route=bytes32(uint256(1));_reject(p,false);}
 function testGatewayRevocationRejected() public {verifier.setGateway(sha256(hex"76a914424242424242424242424242424242424242424288ac"),bytes32(0));_reject(_decode(),false);}
 function testCheckpointRotationInvalidatesProof() public {checkpoints.rotate(address(456));_reject(_decode(),false);}
 function testWrongDestinationChainRejected() public {vm.chainId(421);_reject(_decode(),false);}
 function testMalformedEncodingRejected() public view {(bool ok,)=address(verifier).staticcall(abi.encodeCall(verifier.verifyFinalizedTransfer,(bytes("finalized:true"))));require(!ok,"RPC assertion accepted");}
 function testInsufficientDepthRejected() public {PotcoinFinalityVerifier420.Proof memory p=_decode();p.state.height=601;_reject(p,true);}
 function testRetargetNativeSpacing258() public view {require(math.next(0x1e00ffff,1258,1000)==0x1e00ffff,"spacing");require(math.next(0x1e00ffff,900,1000)==0x1e00ffff,"negative spacing");}
 function testHistoricalTransitions() public view {math.kind(20,true);math.kind(500,false);(bool ok,)=address(math).staticcall(abi.encodeCall(math.kind,(19,true)));require(!ok,"early stake");(ok,)=address(math).staticcall(abi.encodeCall(math.kind,(501,false)));require(!ok,"late work");}
 function testMalformedCompactRejected() public view {(bool ok,)=address(math).staticcall(abi.encodeCall(math.target,(uint32(0x1e80ffff))));require(!ok,"negative target");}
 function testGenuineGenesisTransactionHash() public view {bytes memory raw=vm.readFileBinary("contracts/test/fixtures/potcoin/genesis-transaction.bin");require(math.parse(raw)==0xd0e04154e24e55611591668c9f3f1733eacc48d66ea25fec4b83c44a8397d851,"genesis tx");}
 function testFuzzCoinAgeSaturates(uint64 seed,uint32 age) public view {uint64 amount=uint64(uint256(seed)%42000000000000000+1);uint32 elapsed=uint32(uint256(age)%(100 days));uint256 capped=elapsed>25 days?25 days:elapsed;require(math.weight(amount,1000,1900+elapsed)==uint256(amount)*capped/100000000/86400,"coin age");}
 function testFuzzCompactTargetRoundTrip(uint32 seed) public view {uint32 bits=0x1d000000|(seed%0x7fffff+1);uint256 t=PotcoinConsensus420.target(PotcoinConsensus420.compact(uint256(bits&0x7fffff)<<208),true);require(t>0&&t<=type(uint256).max>>24,"target");}
}

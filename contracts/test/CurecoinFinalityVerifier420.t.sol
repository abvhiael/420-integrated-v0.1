// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../src/bridge/verifiers/CurecoinFinalityVerifier420.sol";
import "../src/bridge/adapters/CurecoinBridgeAdapter420.sol";
contract CureRouterEndToEnd420 {function inbound(CurecoinBridgeAdapter420 a,bytes calldata p) external returns(IBridgeAdapter420.VerifiedTransfer memory){return a.verifyInbound(p);}}
interface CureVm420 {function readFileBinary(string calldata) external view returns(bytes memory);function warp(uint256) external;function chainId(uint256) external;function etch(address,bytes calldata) external;}
contract CureConsensusHarness420 {
 function hit(bytes32 h,uint256 t,uint256 w) external pure returns(bool){return CurecoinConsensus420.meetsKernelTarget(h,t,w);}
 function sig(bytes32 h,bytes memory s,bytes memory p) external view{CurecoinSignature420.verify(h,s,p);}
 function next(uint32 b,uint32 l,uint32 o) external pure returns(uint32){return CurecoinConsensus420.nextBits(b,l,o,true,300000,299999);}
 function weight(uint64 a,uint32 p,uint32 t) external pure returns(uint256){return CurecoinConsensus420.coinDayWeight(a,p,t,300000);}
 function target(uint32 b) external pure returns(uint256){return CurecoinConsensus420.target(b,true,300000);}
 function kind(uint64 h,bool p) external pure{CurecoinConsensus420.kind(h,p);}
 function parse(bytes memory b) external pure returns(bytes32){return CurecoinWire420.parse(b).id;}
}
contract CurecoinFinalityVerifier420Test {
 CureVm420 constant vm=CureVm420(address(uint160(uint256(keccak256("hevm cheat code")))));
 CurecoinFinalityVerifier420 verifier;AuthenticatedCheckpoint420 checkpoints;CureConsensusHarness420 math;
 bytes proof;bytes32 constant NETWORK=keccak256("CURECOIN/MAINNET");address constant ROUTER=address(0x420420);
 function setUp() public {vm.chainId(420);vm.warp(1777803100);vm.etch(ROUTER,hex"00");math=new CureConsensusHarness420();proof=vm.readFileBinary("contracts/test/fixtures/curecoin/controlled-proof.bin");_install(_decode());}
 function _decode() private view returns(CurecoinFinalityVerifier420.Proof memory){return abi.decode(proof,(CurecoinFinalityVerifier420.Proof));}
 function _install(CurecoinFinalityVerifier420.Proof memory p) private {
  bool controlled=CurecoinWire420.le(p.header,68,4)==1777803100;
  bytes32 leaf=sha256(abi.encode("420/CURE/NATIVE-REPLAY-STATE/V1",p.state));
  checkpoints=new AuthenticatedCheckpoint420(address(this),NETWORK,address(123),controlled?uint64(300005):uint64(500000),controlled?bytes32(uint256(99)):bytes32(0xe7ef734c9072344412d94493fcf13aa13d2b94f3344bba2c9cda100872d9505d),leaf);
  verifier=new CurecoinFinalityVerifier420(address(this),address(checkpoints),ROUTER,controlled?6:1);
  verifier.setGateway(sha256(hex"76a914424242424242424242424242424242424242424288ac"),keccak256("420/BRIDGE/ROUTE/CURE/MAINNET"));
 }
 function _reject(CurecoinFinalityVerifier420.Proof memory p,bool authenticateMutation) private {
  if(authenticateMutation)_install(p);
  (bool ok,)=address(verifier).staticcall(abi.encodeCall(verifier.verifyFinalizedTransfer,(abi.encode(p))));require(!ok,"accepted invalid proof");
 }
 function testControlledNativeSha256dSignedDeposit() public view {
  uint256 start=gasleft();ICurecoinFinalityVerifier420.FinalizedTransfer memory r=verifier.verifyFinalizedTransfer(proof);
  require(start-gasleft()<30000000,"production gas");require(r.amount==42000000&&r.recipient==address(0xb0b)&&r.routeId==keccak256("420/BRIDGE/ROUTE/CURE/MAINNET"),"transfer");
 }
 function testUnauthenticatedRpcClaimRejected() public {CurecoinFinalityVerifier420.Proof memory p=_decode();p.state.kernelModifier++;_reject(p,false);}
 function testSpentStakeRejected() public {CurecoinFinalityVerifier420.Proof memory p=_decode();p.state.originUnspent=false;_reject(p,true);}
 function testImmatureStakeRejected() public {CurecoinFinalityVerifier420.Proof memory p=_decode();p.state.originHeight=299999;_reject(p,true);}
 function testOriginAmountSubstitutionRejected() public {CurecoinFinalityVerifier420.Proof memory p=_decode();p.state.originAmount--;_reject(p,true);}
 function testOriginTransactionSubstitutionRejected() public {CurecoinFinalityVerifier420.Proof memory p=_decode();p.originTransaction[10]^=0x01;_reject(p,false);}
 function testWrongGenesisRejected() public {CurecoinFinalityVerifier420.Proof memory p=_decode();p.state.genesis=bytes32(uint256(1));_reject(p,true);}
 function testWrongConsensusRevisionRejected() public {CurecoinFinalityVerifier420.Proof memory p=_decode();p.state.consensusSource=bytes32(uint256(1));_reject(p,true);}
 function testBootstrapRejected() public {CurecoinFinalityVerifier420.Proof memory p=_decode();p.state.height=0;_reject(p,true);}
 function testWrongChainTrustRejected() public {CurecoinFinalityVerifier420.Proof memory p=_decode();p.state.chainTrust++;_reject(p,true);}
 function testWrongDifficultyRejected() public {CurecoinFinalityVerifier420.Proof memory p=_decode();p.state.previousStakeBits=0x1d00ffff;_reject(p,true);}
 function testMedianTimeRejected() public {CurecoinFinalityVerifier420.Proof memory p=_decode();p.state.medianTimePast=1777803100;_reject(p,true);}
 function testFutureTimeRejected() public {vm.warp(1777795899);_reject(_decode(),false);}
 function testBadSignatureRejected() public {CurecoinFinalityVerifier420.Proof memory p=_decode();p.blockSignature[10]^=0x01;_reject(p,false);}
 function testBadCoinstakeMerkleRejected() public {CurecoinFinalityVerifier420.Proof memory p=_decode();p.coinstakeBranch[0]=bytes32(uint256(1));_reject(p,false);}
 function testBadDepositMerkleRejected() public {CurecoinFinalityVerifier420.Proof memory p=_decode();p.transactionBranch[0]=bytes32(uint256(1));_reject(p,false);}
 function testDuplicateOddBranchSubstitutionRejected() public {CurecoinFinalityVerifier420.Proof memory p=_decode();p.transactionCount=4;_reject(p,false);}
 function testWrongOutputRejected() public {CurecoinFinalityVerifier420.Proof memory p=_decode();p.outputIndex=1;_reject(p,false);}
 function testWrongRouteRejected() public {CurecoinFinalityVerifier420.Proof memory p=_decode();p.route=bytes32(uint256(1));_reject(p,false);}
 function testGatewayRevocationRejected() public {verifier.setGateway(sha256(hex"76a914424242424242424242424242424242424242424288ac"),bytes32(0));_reject(_decode(),false);}
 function testCheckpointRotationInvalidatesProof() public {checkpoints.rotate(address(456));_reject(_decode(),false);}
 function testWrongDestinationChainRejected() public {vm.chainId(421);_reject(_decode(),false);}
 function testMalformedEncodingRejected() public view {(bool ok,)=address(verifier).staticcall(abi.encodeCall(verifier.verifyFinalizedTransfer,(bytes("finalized:true"))));require(!ok,"RPC assertion accepted");}
 function testInsufficientDepthRejected() public {CurecoinFinalityVerifier420.Proof memory p=_decode();p.state.height=300001;_reject(p,true);}
 function testRetargetNativeSpacing240() public view {require(math.next(0x1e00ffff,1240,1000)==0x1e00ffff,"spacing");require(math.next(0x1e00ffff,900,1000)<0x1e00ffff,"native negative spacing");}
 function testHistoricalTransitions() public view {math.kind(20,true);math.kind(257322,false);(bool ok,)=address(math).staticcall(abi.encodeCall(math.kind,(257323,false)));require(!ok,"late work");}
 function testMalformedCompactRejected() public view {(bool ok,)=address(math).staticcall(abi.encodeCall(math.target,(uint32(0x1e80ffff))));require(!ok,"negative target");}
 function testGenuineGenesisTransactionHash() public view {bytes memory raw=vm.readFileBinary("contracts/test/fixtures/curecoin/genesis-transaction.bin");require(math.parse(raw)==0xbeff2fecaf2dce36eba2ceea79cb90187d622aef4c0bf1506d48eaa559d39c14,"genesis tx");}
 function testGenuineHistoricalStakeProofs() public {
  uint64[10] memory heights=[uint64(9688),9689,257310,257321,257322,257323,257324,257368,500000,0];
  for(uint256 i;i<9;++i){
   bytes memory raw=vm.readFileBinary(string.concat("contracts/test/fixtures/curecoin/stake-",_decimal(heights[i]),".bin"));
   CurecoinFinalityVerifier420.Proof memory p=abi.decode(raw,(CurecoinFinalityVerifier420.Proof));
   _install(p);(uint64 h,bytes32 hash_)=verifier.verifyFinalizedBlock(raw);require(h==heights[i]&&hash_==p.state.blockHash,"historical stake");
   (bool ok,)=address(verifier).staticcall(abi.encodeCall(verifier.verifyFinalizedTransfer,(raw)));require(!ok,"history without bridge destination credited");
  }
 }
 function _decimal(uint64 n) private pure returns(string memory){bytes memory b=new bytes(20);uint256 p=20;do{b[--p]=bytes1(uint8(48+n%10));n/=10;}while(n!=0);bytes memory out=new bytes(20-p);for(uint256 i;i<out.length;++i)out[i]=b[p+i];return string(out);}
 function testRealVerifierAdapterReplayAfterRotation() public {
  vm.etch(ROUTER,type(CureRouterEndToEnd420).runtimeCode);
  CurecoinBridgeAdapter420 a=new CurecoinBridgeAdapter420(address(this),ROUTER,address(verifier));
  bytes32 route=keccak256("420/BRIDGE/ROUTE/CURE/MAINNET");a.setCureBinding(keccak256("CURE"),route);a.setGatewayScript(sha256(hex"76a914424242424242424242424242424242424242424288ac"),true);
  IBridgeAdapter420.VerifiedTransfer memory r=CureRouterEndToEnd420(ROUTER).inbound(a,proof);require(r.amount==42000000&&r.recipient==address(0xb0b),"native CURE transfer");
  CurecoinFinalityVerifier420 next=new CurecoinFinalityVerifier420(address(this),address(checkpoints),ROUTER,6);next.setGateway(sha256(hex"76a914424242424242424242424242424242424242424288ac"),route);a.setVerifier(address(next));
  (bool ok,)=ROUTER.call(abi.encodeCall(CureRouterEndToEnd420.inbound,(a,proof)));require(!ok,"replay after rotation");
 }
 function testRealVerifierCannotSubstituteAdapterRoute() public {
  vm.etch(ROUTER,type(CureRouterEndToEnd420).runtimeCode);CurecoinBridgeAdapter420 a=new CurecoinBridgeAdapter420(address(this),ROUTER,address(verifier));a.setCureBinding(keccak256("CURE"),keccak256("different-route"));a.setGatewayScript(sha256(hex"76a914424242424242424242424242424242424242424288ac"),true);
  (bool ok,)=ROUTER.call(abi.encodeCall(CureRouterEndToEnd420.inbound,(a,proof)));require(!ok,"route substitution");
 }
 function testKernelTargetEqualityAndUnboundedProduct() public view {
  require(math.hit(bytes32(uint256(10)<<248),5,2),"native equality");require(!math.hit(bytes32(uint256(11)<<248),5,2),"above target");require(math.hit(bytes32(type(uint256).max),type(uint256).max,2),"unbounded product");require(math.hit(bytes32(0),1,0),"zero target equality");
 }
 function testNativeHybridPublicKeyAndParity() public view {
  CurecoinFinalityVerifier420.Proof memory p=_decode();bytes memory pub=hex"0679be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8";
  math.sig(bytes32(CurecoinConsensus420.reverse(p.state.blockHash)),p.blockSignature,pub);pub[0]=0x07;
  (bool ok,)=address(math).staticcall(abi.encodeCall(math.sig,(bytes32(CurecoinConsensus420.reverse(p.state.blockHash)),p.blockSignature,pub)));require(!ok,"hybrid parity");
 }
 function testHeaderNonceIsBoundByNativeSignature() public {
  CurecoinFinalityVerifier420.Proof memory p=_decode();p.header[76]^=0x01;p.state.headerSha256=sha256(p.header);p.state.blockHash=bytes32(CurecoinConsensus420.reverse(sha256(abi.encodePacked(sha256(p.header)))));_reject(p,true);
 }
 function testInvalidMinimumAgeContextRejected() public {CurecoinFinalityVerifier420.Proof memory p=_decode();p.state.minimumStakeAge=1;_reject(p,true);}
 function testFuzzCoinAgeSaturates(uint64 seed,uint32 age) public view {uint64 amount=uint64(uint256(seed)%156000000000000+1);uint32 elapsed=uint32(uint256(age)%(120 days));uint256 capped=elapsed+4 days>90 days?86 days:elapsed;require(math.weight(amount,1000,uint32(1000+4 days)+elapsed)==uint256(amount)*capped/1000000/86400,"coin age");}
 function testFuzzCompactTargetRoundTrip(uint32 seed) public view {uint32 bits=0x1d000000|(seed%0x7fffff+1);uint256 t=CurecoinConsensus420.target(CurecoinConsensus420.compact(uint256(bits&0x7fffff)<<208),true,300000);require(t>0&&t<=type(uint256).max>>24,"target");}
}

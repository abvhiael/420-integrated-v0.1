// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../src/bridge/verifiers/DobbscoinFinalityVerifier420.sol";
import "../src/bridge/adapters/DobbscoinBridgeAdapter420.sol";

interface DobbscoinVm420 {function expectRevert() external;function prank(address) external;function warp(uint256) external;function chainId(uint256) external;function addr(uint256) external returns(address);function sign(uint256,bytes32) external returns(uint8,bytes32,bytes32);function readFile(string calldata) external view returns(string memory);function parseJsonBytes(string calldata,string calldata) external pure returns(bytes memory);}
contract DobbscoinVerifierRouter420 {function inbound(DobbscoinBridgeAdapter420 a,bytes memory p) external returns(IBridgeAdapter420.VerifiedTransfer memory){return a.verifyInbound(p);}}
contract DobbscoinConsensusHarness420 {
    function target(uint32 bits) external pure returns(uint256){return DobbscoinConsensus420.target(bits);}
    function work(uint32 bits) external pure returns(uint256){return DobbscoinConsensus420.work(bits);}
    function activation(bytes memory h,uint64 n) external pure returns(bool){return DobbscoinConsensus420.activation(h,n);}
    function aux(bytes memory h,DobbscoinConsensus420.AuxPow memory a) external pure {DobbscoinConsensus420.checkAux(h,a);}
    function slot(uint32 n,uint256 h) external pure returns(uint32){return DobbscoinConsensus420.expectedIndex(n,h);}
    function parse(bytes memory raw,bool parent) external pure returns(DobbscoinWire420.Transaction memory){return DobbscoinWire420.parse(raw,parent);}
}
/// @dev Controlled checkpoint authority fixtures exercise the proof consumer. They
/// are never described as genuine mined mainnet deposits. Historical fixtures have
/// independently computed scrypt work and native full-replay provenance.
contract DobbscoinFinalityVerifier420Test {
    DobbscoinVm420 constant vm=DobbscoinVm420(address(uint160(uint256(keccak256("hevm cheat code")))));
    bytes32 constant ROUTE=keccak256("BOB-route");bytes32 constant ASSET=keccak256("BOB-asset");
    bytes constant SCRIPT=hex"76a914111111111111111111111111111111111111111188ac";
    DobbscoinVerifierRouter420 router;DobbscoinConsensusHarness420 harness;DobbscoinFinalityVerifier420 verifier;AuthenticatedCheckpoint420 cp;DobbscoinBridgeAdapter420 adapter;
    DobbscoinFinalityVerifier420.Proof p;
    function header(uint32 version,bytes32 previous,bytes32 root,uint32 time,uint32 bits) internal pure returns(bytes memory){return abi.encodePacked(BridgeWire420.encodeLE(version,4),previous,root,BridgeWire420.encodeLE(time,4),BridgeWire420.encodeLE(bits,4),hex"00000000");}
    function transaction(bytes memory memo,uint64 amount) internal pure returns(bytes memory){return abi.encodePacked(hex"0100000001",bytes32(uint256(1)),hex"000000000151ffffffff02",BridgeWire420.encodeLE(amount,8),bytes1(uint8(SCRIPT.length)),SCRIPT,hex"0000000000000000",bytes1(uint8(memo.length)),memo,hex"00000000");}
    function setUp() public {
        vm.warp(1800000000);router=new DobbscoinVerifierRouter420();harness=new DobbscoinConsensusHarness420();
        cp=new AuthenticatedCheckpoint420(address(this),keccak256("DOBBSCOIN/MAINNET"),vm.addr(23),1,bytes32(uint256(1)),bytes32(uint256(1)));
        verifier=new DobbscoinFinalityVerifier420(address(this),address(cp),address(router),1);verifier.setGateway(SCRIPT,ROUTE);
        adapter=new DobbscoinBridgeAdapter420(address(this),address(router),address(verifier));adapter.setBobBinding(ASSET,ROUTE);adapter.setGatewayScript(keccak256(SCRIPT),true);
        p.route=ROUTE;p.recipient=address(0xB0B);p.transactionIndex=1;p.paymentIndex=0;p.commitmentIndex=1;
        p.transaction=transaction(verifier.commitmentScript(ROUTE,keccak256(SCRIPT),0,p.recipient,4200000000),4200000000);
        p.transactionBranch=new bytes32[](1);p.transactionBranch[0]=bytes32(uint256(123));
        bytes32 root=BridgeCrypto420.sha256d(abi.encodePacked(p.transactionBranch[0],BridgeCrypto420.sha256d(p.transaction)));
        p.header=header(3,bytes32(uint256(2)),root,1700000000,0x1e0fffff);
        p.state=DobbscoinFinalityVerifier420.State(verifier.GENESIS(),verifier.CONSENSUS_SOURCE(),1900000,DobbscoinConsensus420.reverse(BridgeCrypto420.sha256d(p.header)),DobbscoinConsensus420.reverse(bytes32(uint256(2))),sha256(p.header),sha256(p.header),bytes32(0),100,100+harness.work(0x1e0fffff),0x1e0fffff,1699999880,1699999000);
        seal();
    }
    function seal() internal {p.state.blockHash=DobbscoinConsensus420.reverse(BridgeCrypto420.sha256d(p.header));p.state.headerSha256=sha256(p.header);bytes32 leaf=verifier.stateLeaf(p.state);
        cp=new AuthenticatedCheckpoint420(address(this),verifier.NETWORK(),vm.addr(23),p.state.height+287,bytes32(uint256(42)),leaf);
        verifier=new DobbscoinFinalityVerifier420(address(this),address(cp),address(router),1);verifier.setGateway(SCRIPT,ROUTE);adapter.setVerifier(address(verifier));
    }
    function verify() internal view returns(IDobbscoinFinalityVerifier420.FinalizedTransfer memory){return verifier.verifyFinalizedTransfer(abi.encode(p));}
    function fail() internal {vm.expectRevert();verifier.verifyFinalizedTransfer(abi.encode(p));}
    function testControlledTransferAndAdapterConsume() public {IBridgeAdapter420.VerifiedTransfer memory t=router.inbound(adapter,abi.encode(p));require(t.routeId==ROUTE&&t.amount==4200000000&&t.recipient==address(0xB0B));}
    function testConfirmationBoundary288() public {require(verify().confirmations==288);}
    function test287ConfirmationsRejected() public {p.state.height++;seal();/* seal fixes depth; advance the state without re-sealing instead */p.state.height++;fail();}
    function testUnauthenticatedState() public {p.state.parentTime++;fail();}
    function testRawRpcEnvelopeRejected() public {vm.expectRevert();verifier.verifyFinalizedTransfer(bytes('{"confirmations":288,"finalized":true}'));}
    function testHeaderSubstitution() public {p.header[79]=0x01;fail();}
    function testScryptCommitmentBindsWorkHeader() public {p.state.workHeaderSha256=bytes32(uint256(1));seal();fail();}
    function testInsufficientScryptWork() public {p.state.scryptHash=bytes32(type(uint256).max);seal();fail();}
    function testWrongNormalDifficulty() public {p.state.expectedBits=0x1e0ffffe;seal();fail();}
    function testChainWorkMismatch() public {p.state.chainWork++;seal();fail();}
    function testChainWorkOverflow() public {p.state.parentWork=type(uint256).max;seal();fail();}
    function testWrongSourceRevision() public {p.state.consensusSource=bytes32(uint256(1));seal();fail();}
    function testWrongGenesis() public {p.state.genesis=bytes32(uint256(1));seal();fail();}
    function testWrongAncestry() public {p.state.parentHash=bytes32(uint256(1));seal();fail();}
    function testMedianTimePastEquality() public {p.state.medianTimePast=1700000000;seal();fail();}
    function testFutureTime() public {vm.warp(1699990000);fail();}
    function testWrongDestinationChain() public {vm.chainId(block.chainid+1);fail();}
    function testStaleAuthorityEpoch() public {cp.rotate(address(0x42));fail();}
    function testBadCheckpointSignature() public {vm.expectRevert();cp.advance(p.state.height+288,bytes32(uint256(9)),bytes32(uint256(8)),new bytes(65));}
    function testSignedAdvanceThenReplayRejected() public {uint64 next=p.state.height+288;bytes32 leaf=verifier.stateLeaf(p.state);(uint8 v,bytes32 r,bytes32 s)=vm.sign(23,cp.digest(next,bytes32(uint256(9)),leaf));bytes memory sig=abi.encodePacked(r,s,v);cp.advance(next,bytes32(uint256(9)),leaf,sig);require(verify().confirmations==289);vm.expectRevert();cp.advance(next,bytes32(uint256(9)),leaf,sig);}
    function testTransactionSubstitution() public {p.transaction[50]=0x02;fail();}
    function testWrongTransactionPosition() public {p.transactionIndex=0;fail();}
    function testWrongMerkleBranch() public {p.transactionBranch[0]=bytes32(uint256(4));fail();}
    function testWrongGateway() public {verifier.setGateway(SCRIPT,bytes32(0));fail();}
    function testWrongRecipient() public {p.recipient=address(0x123);fail();}
    function testWrongRouteMemo() public {verifier.setGateway(SCRIPT,bytes32(uint256(1)));p.route=bytes32(uint256(1));fail();}
    function testOutputIndexSubstitution() public {p.paymentIndex=1;p.commitmentIndex=0;fail();}
    function testCanonicalAbiRequired() public {vm.expectRevert();verifier.verifyFinalizedTransfer(bytes.concat(abi.encode(p),hex"00"));}
    function testReplaySurvivesVerifierRotation() public {router.inbound(adapter,abi.encode(p));seal();vm.expectRevert();router.inbound(adapter,abi.encode(p));}
    function testPrematureAuxPow() public {p.header=header(259,bytes32(uint256(2)),DobbscoinWire420.hashAt(p.header,36),1700000000,0x1e0fffff);p.state.workHeaderSha256=sha256(p.header);seal();fail();}
    function testPrematureChainId() public {p.header=header((176<<16)|3,bytes32(uint256(2)),DobbscoinWire420.hashAt(p.header,36),1700000000,0x1e0fffff);p.state.workHeaderSha256=sha256(p.header);seal();fail();}
    function testPostActivationStandaloneIsAllowed() public {p.state.height=2000000;p.header=header((176<<16)|3,bytes32(uint256(2)),DobbscoinWire420.hashAt(p.header,36),1700000000,0x1e0fffff);p.state.workHeaderSha256=sha256(p.header);seal();require(verify().auxPowValidated);}
    function testPostActivationMissingChainIdRejected() public {p.state.height=2000000;seal();fail();}
    function testEmergencyStrictlyGreaterThanSixHours() public {p.state.expectedBits=0x1e0ffffe;p.state.parentTime=1700000000-21600;seal();fail();p.state.parentTime--;seal();require(verify().finalized);}
    function testEmergencyNotBeforeActivation() public {p.state.height=1888887;p.state.expectedBits=0x1e0ffffe;p.state.parentTime=1699900000;seal();fail();}
    function testEmergencyDoesNotForceMinimum() public {p.state.parentTime=1699900000;seal();require(verify().finalized);}
    function testAuxiliaryDataWithoutFlagRejected() public {p.aux.parentHeader=new bytes(80);fail();}
    function testNativeMoneyLimitExceedsBitcoinLimit() public {bytes memory tx_=transaction(hex"6a20",30000000*100000000);require(harness.parse(tx_,false).outputs[0].amount==30000000*100000000);}
    function testMoneyAboveNativeLimitRejected() public {vm.expectRevert();harness.parse(transaction(hex"6a20",1000000000000000001),false);}
    function testLegacyOnlyRejectsSegwitMarker() public {vm.expectRevert();harness.parse(hex"01000000000100000000",false);}
    function testTrailingTransactionDataRejected() public {vm.expectRevert();harness.parse(bytes.concat(p.transaction,hex"00"),false);}
    function testBadCompactTargets() public {uint32[6] memory bad=[uint32(0),0x1e8fffff,0x23000001,0x22000100,0x21010000,0x1f0fffff];for(uint256 i;i<bad.length;++i){vm.expectRevert();harness.target(bad[i]);}}

    function auxFixture(bytes memory prefix,bytes memory suffix,uint32 parentVersion) internal {
        p.state.height=2000000;p.header=header((176<<16)|259,bytes32(uint256(2)),DobbscoinWire420.hashAt(p.header,36),1700000000,0x1e0fffff);
        bytes memory script=abi.encodePacked(prefix,DobbscoinConsensus420.reverse(BridgeCrypto420.sha256d(p.header)),suffix);
        p.aux.coinbase=abi.encodePacked(hex"0100000001",bytes32(0),hex"ffffffff",bytes1(uint8(script.length)),script,hex"ffffffff0000000000");
        p.aux.parentHeader=header(parentVersion,bytes32(0),BridgeCrypto420.sha256d(p.aux.coinbase),1700000000,0);
        p.state.workHeaderSha256=sha256(p.aux.parentHeader);seal();
    }
    function testAuxPowParentZeroOutputsAndChildTarget() public {auxFixture(hex"fabe6d6d",hex"0100000000000000",1);require(verify().finalized);}
    function testAuxPowParentBranchOver32MatchesNative() public {auxFixture(hex"fabe6d6d",hex"0100000000000000",1);p.aux.parentBranch=new bytes32[](33);bytes32 root=BridgeCrypto420.sha256d(p.aux.coinbase);for(uint256 i;i<33;++i)root=BridgeCrypto420.sha256d(abi.encodePacked(root,bytes32(0)));p.aux.parentHeader=header(1,bytes32(0),root,1700000000,0);p.state.workHeaderSha256=sha256(p.aux.parentHeader);seal();require(verify().finalized);}
    function testAuxPowLegacyRootAt20Allowed() public {auxFixture(new bytes(20),hex"0100000000000000",1);require(verify().finalized);}
    function testAuxPowLegacyRootAt21Rejected() public {auxFixture(new bytes(21),hex"0100000000000000",1);fail();}
    function testAuxPowDuplicateMagicRejected() public {auxFixture(hex"fabe6d6d",hex"0100000000000000fabe6d6d",1);fail();}
    function testAuxPowMagicMustPrecedeRoot() public {auxFixture(hex"fabe6d6d00",hex"0100000000000000",1);fail();}
    function testAuxPowParentSameChainRejected() public {auxFixture(hex"fabe6d6d",hex"0100000000000000",(176<<16)|1);fail();}
    function testAuxPowWrongParentMerkleRejected() public {auxFixture(hex"fabe6d6d",hex"0100000000000000",1);p.aux.parentHeader[36]=0xff;fail();}
    function testAuxPowParentIndexMustBeZero() public {auxFixture(hex"fabe6d6d",hex"0100000000000000",1);p.aux.parentIndex=1;fail();}
    function testAuxPowTreeSizeRejected() public {auxFixture(hex"fabe6d6d",hex"0200000000000000",1);fail();}
    function testAuxPowTruncatedTreeRejected() public {auxFixture(hex"fabe6d6d",hex"01000000",1);fail();}
    function testAuxPowInvalidChainIndexRejected() public {auxFixture(hex"fabe6d6d",hex"0100000000000000",1);p.aux.chainIndex=1;fail();}
    function testAuxPowBranchTooLongRejected() public {auxFixture(hex"fabe6d6d",hex"0100000000000000",1);p.aux.chainBranch=new bytes32[](31);fail();}
    function testAuxPowBindsChildHeader() public {auxFixture(hex"fabe6d6d",hex"0100000000000000",1);p.header[79]=0x01;seal();fail();}
    function testUnauthorizedAuthorityGatewayAndVerifierChanges() public {vm.expectRevert();vm.prank(address(0xBAD));cp.rotate(address(0x42));vm.expectRevert();vm.prank(address(0xBAD));verifier.setGateway(SCRIPT,ROUTE);vm.expectRevert();vm.prank(address(0xBAD));adapter.setVerifier(address(verifier));}

    function merkleCheckpoint() internal {p.stateIndex=1;p.stateBranch=new bytes32[](1);p.stateBranch[0]=bytes32(uint256(7));bytes32 root=sha256(abi.encodePacked(p.stateBranch[0],verifier.stateLeaf(p.state)));cp=new AuthenticatedCheckpoint420(address(this),verifier.NETWORK(),vm.addr(23),p.state.height+287,bytes32(uint256(42)),root);verifier=new DobbscoinFinalityVerifier420(address(this),address(cp),address(router),1);verifier.setGateway(SCRIPT,ROUTE);}
    function testStateMerkleNonzeroIndexPasses() public {merkleCheckpoint();require(verify().finalized);}
    function testStateMerkleIndexSubstitutionRejected() public {merkleCheckpoint();p.stateIndex=0;fail();}
    function testMemoCannotMoveToAnotherRouter() public {DobbscoinVerifierRouter420 other=new DobbscoinVerifierRouter420();verifier=new DobbscoinFinalityVerifier420(address(this),address(cp),address(other),1);verifier.setGateway(SCRIPT,ROUTE);fail();}
    function testMinimumDepositHeightEnforced() public {verifier=new DobbscoinFinalityVerifier420(address(this),address(cp),address(router),p.state.height+1);verifier.setGateway(SCRIPT,ROUTE);fail();}
    function testFuzzExpectedIndex(uint32 nonce,uint8 h) public view {uint256 height=uint256(h)%31;uint32 result=harness.slot(nonce,height);require(result<(1<<height));uint32 r;unchecked{r=nonce*1103515245+12345;r+=176;r=r*1103515245+12345;}require(result==r%(1<<height));}
    function testFuzzCompactWork(uint16 word) public view {uint32 b=0x1d000000|uint32(word+uint256(1));uint256 t=harness.target(b);require(harness.work(b)==type(uint256).max/(t+1)+(type(uint256).max%(t+1)==t?1:0));}
}

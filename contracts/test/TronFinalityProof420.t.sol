// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../src/bridge/verifiers/TronFinalityVerifier420.sol";
import "./TronBridgeAdapter420.t.sol";

interface TronVm420 {
    function addr(uint256) external returns (address);
    function sign(uint256, bytes32) external returns (uint8, bytes32, bytes32);
    function chainId(uint256) external;
    function readFileBinary(string calldata) external view returns (bytes memory);
}

contract TronWireHarness420 {
    function header(bytes memory b) external pure returns (TronWire420.Header memory) { return TronWire420.header(b); }
    function transfer(bytes memory b) external pure returns (TronWire420.Transfer memory) { return TronWire420.transfer(b); }
    function inclusion(bytes32 leaf, uint32 index, uint32 count, bytes32[] memory path, bytes32 root) external pure {
        TronWire420.inclusion(leaf,index,count,path,root);
    }
    function install(TronFinalityVerifier420 v, TronFinalityVerifier420.ProfileInput memory p) external { v.installProfile(p); }
}

contract TronFinalityProof420Test {
    TronVm420 private constant vm = TronVm420(address(uint160(uint256(keccak256("hevm cheat code")))));
    bytes32 private constant ROUTE = keccak256("420/BRIDGE/ROUTE/TRX/MAINNET");
    bytes32 private constant ASSET = keccak256("420/BRIDGE/ASSET/TRX");
    bytes20 private constant GATEWAY = bytes20(uint160(0x420420));
    TronRouterCaller420 private router;
    TronFinalityVerifier420 private verifier;
    TronBridgeAdapter420 private adapter;
    TronWireHarness420 private wire;
    bytes32 private profileId;
    TronFinalityVerifier420.ProfileInput private config;

    function setUp() public {
        router = new TronRouterCaller420(); verifier = new TronFinalityVerifier420(address(this),address(router));
        adapter = new TronBridgeAdapter420(address(this),address(router),address(verifier));
        adapter.setGatewayAccount(GATEWAY,true); adapter.setTrxBinding(ASSET,ROUTE); verifier.setGateway(GATEWAY,ROUTE);
        wire = new TronWireHarness420();
        config.genesis=verifier.MAINNET_GENESIS(); config.snapshotHash=keccak256("controlled snapshot");
        config.checkpointNumber=100; config.checkpointHash=bytes32((uint256(100)<<192)|123);
        config.checkpointTime=3_000_000; config.lastNumber=10000; config.expiresAt=24_000_000;
        for(uint256 i;i<27;++i){config.witnesses[i]=bytes20(vm.addr(i+1));config.signingKeys[i]=vm.addr(i+1);}
        profileId=verifier.installProfile(config);
    }

    function vi(uint256 v) private pure returns(bytes memory out) {
        while(v>=128){out=bytes.concat(out,bytes1(uint8(v)|128));v>>=7;}
        return bytes.concat(out,bytes1(uint8(v)));
    }
    function n(uint256 f,uint256 v) private pure returns(bytes memory){return bytes.concat(vi(f*8),vi(v));}
    function b(uint256 f,bytes memory v) private pure returns(bytes memory){return bytes.concat(vi(f*8+2),vi(v.length),v);}
    function sig(uint256 key,bytes32 hash) private returns(bytes memory) {
        (uint8 v,bytes32 r,bytes32 s)=vm.sign(key,hash);return abi.encodePacked(r,s,v-27);
    }
    function memo() private view returns(bytes memory){return abi.encodePacked(bytes8("420TRXV1"),block.chainid,address(router),ROUTE,address(0xB0B));}
    function txBytes(uint64 amount,bytes memory data,uint8 result_) private returns(bytes memory) {
        bytes memory transfer_=bytes.concat(b(1,abi.encodePacked(bytes1(0x41),vm.addr(1000))),b(2,abi.encodePacked(bytes1(0x41),GATEWAY)),n(3,amount));
        bytes memory parameter=bytes.concat(b(1,bytes("type.googleapis.com/protocol.TransferContract")),b(2,transfer_));
        bytes memory contract_=bytes.concat(n(1,1),b(2,parameter));
        bytes memory raw=bytes.concat(b(1,hex"0063"),b(4,hex"0102030405060708"),n(8,4_000_000),b(10,data),b(11,contract_),n(14,3_000_000));
        return bytes.concat(b(1,raw),b(2,sig(1000,sha256(raw))),b(5,n(3,result_)));
    }
    function build(bytes32 root,uint256 len,uint256 stride) private returns(bytes[] memory raws,bytes[] memory signatures) {
        raws=new bytes[](len);signatures=new bytes[](len);bytes32 parent=config.checkpointHash;
        for(uint256 i;i<len;++i){
            uint64 time=uint64(config.checkpointTime+(i+1)*3000*stride);uint256 rank=time/3000%27;
            raws[i]=bytes.concat(n(1,time),b(2,abi.encodePacked(i==0?root:bytes32(0))),b(3,abi.encodePacked(parent)),n(7,101+i),b(9,abi.encodePacked(bytes1(0x41),config.witnesses[rank])),n(10,37));
            signatures[i]=sig(rank+1,sha256(raws[i]));parent=TronWire420.blockId(raws[i],uint64(101+i));
        }
    }
    function proof(bytes memory tx_) private view returns(TronFinalityVerifier420.DepositProof memory p){
        p=TronFinalityVerifier420.DepositProof(profileId,101,tx_,0,1,new bytes32[](0));
    }
    function solid(bytes memory tx_) private {
        (bytes[] memory raws,bytes[] memory signatures)=build(sha256(tx_),19,1);
        verifier.solidify(profileId,100,raws,signatures,0);
    }
    function rejected(bytes memory data) private {
        (bool ok,)=address(verifier).call(data);require(!ok,"accepted invalid proof");
    }
    function rejectDeposit(bytes memory tx_) private {
        solid(tx_);rejected(abi.encodeCall(verifier.verifyFinalizedTransfer,(abi.encode(proof(tx_)))));
    }

    function testNativeSolidificationAndConcreteAdapterDeposit() public {
        bytes memory tx_=txBytes(42_000_000,memo(),1);solid(tx_);
        IBridgeAdapter420.VerifiedTransfer memory t=router.inbound(adapter,abi.encode(proof(tx_)));
        require(t.routeId==ROUTE&&t.assetId==ASSET&&t.amount==42_000_000&&t.recipient==address(0xB0B),"deposit binding");
        require(t.sender==vm.addr(1000)&&t.sourceTxId!=0&&t.sourceMessageId!=0,"source identity");
        require(verifier.canonicalSolid(101)!=0,"not solid");
        (bool ok,)=address(router).call(abi.encodeCall(router.inbound,(adapter,abi.encode(proof(tx_)))));require(!ok,"replay");
    }
    function testEighteenDistinctProducersCannotSolidify() public {
        (bytes[] memory h,bytes[] memory s)=build(bytes32(uint256(1)),18,1);
        rejected(abi.encodeCall(verifier.solidify,(profileId,100,h,s,0)));
        require(verifier.canonicalSolid(101)==0,"atomicity");
    }
    function testRepeatedProducerBlocksCannotReplaceDistinctSRs() public {
        (bytes[] memory h,bytes[] memory s)=build(bytes32(uint256(1)),27,27);
        rejected(abi.encodeCall(verifier.solidify,(profileId,100,h,s,0)));
    }
    function testBadSRSignatureFails() public {
        (bytes[] memory h,bytes[] memory s)=build(bytes32(uint256(1)),19,1);s[4]=sig(1000,sha256(h[4]));
        rejected(abi.encodeCall(verifier.solidify,(profileId,100,h,s,0)));
    }
    function testWrongScheduledSRFails() public {
        (bytes[] memory h,bytes[] memory s)=build(bytes32(uint256(1)),19,1);
        h[0]=bytes.concat(n(1,3_003_000),b(2,abi.encodePacked(bytes32(uint256(1)))),b(3,abi.encodePacked(config.checkpointHash)),n(7,101),b(9,abi.encodePacked(bytes1(0x41),config.witnesses[0])));
        s[0]=sig(1,sha256(h[0]));rejected(abi.encodeCall(verifier.solidify,(profileId,100,h,s,0)));
    }
    function testBrokenAncestryAndMalformedHeaderFail() public {
        (bytes[] memory h,bytes[] memory s)=build(bytes32(uint256(1)),19,1);h[1]=h[0];
        rejected(abi.encodeCall(verifier.solidify,(profileId,100,h,s,0)));
        h[0]=hex"088000";rejected(abi.encodeCall(verifier.solidify,(profileId,100,h,s,0)));
    }
    function testConflictingSolidBranchCannotReplaceAcceptedBlock() public {
        solid(txBytes(1,memo(),1));(bytes[] memory h,bytes[] memory s)=build(bytes32(uint256(1)),19,1);
        rejected(abi.encodeCall(verifier.solidify,(profileId,100,h,s,0)));
    }
    function testInvalidPendingBranchDoesNotPinHead() public {
        (bytes[] memory h,bytes[] memory s)=build(bytes32(uint256(1)),18,1);
        rejected(abi.encodeCall(verifier.solidify,(profileId,100,h,s,0)));solid(txBytes(2,memo(),1));
    }
    function testUnknownAndDisabledProfileReject() public {
        bytes memory tx_=txBytes(1,memo(),1);TronFinalityVerifier420.DepositProof memory p=proof(tx_);p.profile=keccak256("unknown");
        rejected(abi.encodeCall(verifier.verifyFinalizedTransfer,(abi.encode(p))));solid(tx_);verifier.disableProfile(profileId);
        rejected(abi.encodeCall(verifier.verifyFinalizedTransfer,(abi.encode(proof(tx_)))));
        rejected(abi.encodeCall(verifier.installProfile,(config)));
    }
    function testSnapshotGovernanceAndClusterFailClosed() public {
        (bool ok,)=address(wire).call(abi.encodeCall(wire.install,(verifier,config)));require(!ok,"unauthorized profile");
        TronFinalityVerifier420.ProfileInput memory c=config;c.genesis=keccak256("NILE");rejected(abi.encodeCall(verifier.installProfile,(c)));
        c=config;c.witnesses[1]=c.witnesses[0];rejected(abi.encodeCall(verifier.installProfile,(c)));
    }
    function testSnapshotDeadlineAndCheckpointHeightFailClosed() public {
        (bytes[] memory h,bytes[] memory s)=build(bytes32(uint256(1)),19,1);
        rejected(abi.encodeCall(verifier.solidify,(profileId,99,h,s,0)));
        TronFinalityVerifier420.ProfileInput memory c=config;c.snapshotHash=keccak256("short window");c.expiresAt=c.checkpointTime+3000;
        bytes32 id=verifier.installProfile(c);rejected(abi.encodeCall(verifier.solidify,(id,100,h,s,0)));
    }
    function testWrongDestinationAndRouteMemoFail() public {
        rejectDeposit(txBytes(1,abi.encodePacked(bytes8("420TRXV1"),block.chainid,address(router),keccak256("wrong"),address(0xB0B)),1));
    }
    function testWrongRouterMemoFails() public {rejectDeposit(txBytes(1,abi.encodePacked(bytes8("420TRXV1"),block.chainid,address(0x123),ROUTE,address(0xB0B)),1));}
    function testWrongChainMemoFails() public {rejectDeposit(txBytes(1,abi.encodePacked(bytes8("420TRXV1"),block.chainid+1,address(router),ROUTE,address(0xB0B)),1));}
    function testMissingMemoAndZeroAmountFail() public {rejectDeposit(txBytes(0,hex"",1));}
    function testCommittedFailureCannotBecomeSuccessfulTransfer() public {rejectDeposit(txBytes(1,memo(),2));}
    function testUnapprovedGatewayFails() public {bytes memory tx_=txBytes(1,memo(),1);verifier.setGateway(GATEWAY,0);rejectDeposit(tx_);}
    function testRPCOnlyAndUnsolidifiedTransactionReject() public {
        rejected(abi.encodeCall(verifier.verifyFinalizedTransfer,(bytes('{"solidified":true,"result":"SUCCESS"}'))));
        bytes memory tx_=txBytes(1,memo(),1);rejected(abi.encodeCall(verifier.verifyFinalizedTransfer,(abi.encode(proof(tx_)))));
    }
    function testResultTamperingFailsMerkleInclusion() public {
        bytes memory tx_=txBytes(1,memo(),1);solid(tx_);tx_[tx_.length-1]=0x02;
        rejected(abi.encodeCall(verifier.verifyFinalizedTransfer,(abi.encode(proof(tx_)))));
    }
    function testNonCanonicalEnvelopeAndWrongIndexReject() public {
        bytes memory tx_=txBytes(1,memo(),1);solid(tx_);bytes memory p=abi.encode(proof(tx_));
        rejected(abi.encodeCall(verifier.verifyFinalizedTransfer,(bytes.concat(p,hex"00"))));
        TronFinalityVerifier420.DepositProof memory w=proof(tx_);w.index=1;
        rejected(abi.encodeCall(verifier.verifyFinalizedTransfer,(abi.encode(w))));
    }
    function testDestinationChainChangeRejectsOldProfile() public {
        bytes memory tx_=txBytes(1,memo(),1);solid(tx_);vm.chainId(block.chainid+1);
        rejected(abi.encodeCall(verifier.verifyFinalizedTransfer,(abi.encode(proof(tx_)))));
    }
    function testVerifierRotationPreservesAdapterReplay() public {
        bytes memory tx_=txBytes(1,memo(),1);solid(tx_);router.inbound(adapter,abi.encode(proof(tx_)));
        adapter.setVerifier(address(verifier));(bool ok,)=address(router).call(abi.encodeCall(router.inbound,(adapter,abi.encode(proof(tx_)))));require(!ok,"rotated replay");
    }
    function testOddMerkleNodeIsPromotedWithoutDuplication() public {
        bytes32 a=sha256("a");bytes32 c=sha256("c");bytes32 ab=sha256(abi.encodePacked(a,sha256("b")));
        bytes32 root=sha256(abi.encodePacked(ab,c));bytes32[] memory path=new bytes32[](1);path[0]=ab;
        wire.inclusion(c,2,3,path,root);(bool ok,)=address(wire).call(abi.encodeCall(wire.inclusion,(c,2,3,path,sha256(abi.encodePacked(ab,sha256(abi.encodePacked(c,c)))))));require(!ok,"bitcoin odd rule");
    }
    function testFuzzNativeSunAmountPreserved(uint64 value) public {
        uint64 amount=uint64(uint256(value)%uint64(type(int64).max))+1;
        TronWire420.Transfer memory t=wire.transfer(txBytes(amount,memo(),1));require(t.amount==amount,"amount truncation");
    }
    function testFuzzUnknownWireTagsFail(uint32 field) public {
        uint256 f=uint256(field)%100000+100;bytes memory raw=bytes.concat(n(1,3_003_000),n(f,1));
        (bool ok,)=address(wire).call(abi.encodeCall(wire.header,(raw)));require(!ok,"unknown header accepted");
    }

    function testProductionCodeSizeAndPerCallGasBounds() public {
        require(address(verifier).code.length<=24576&&address(adapter).code.length<=24576,"runtime EIP170");
        require(type(TronFinalityVerifier420).creationCode.length<=49152,"init EIP3860");
        bytes memory tx_=txBytes(1,memo(),1);(bytes[] memory h,bytes[] memory s)=build(sha256(tx_),128,1);
        uint256 before_=gasleft();verifier.solidify(profileId,100,h,s,100);
        require(before_-gasleft()<30_000_000,"solidification per-call budget");
        before_=gasleft();router.inbound(adapter,abi.encode(proof(tx_)));
        require(before_-gasleft()<30_000_000,"deposit per-call budget");
    }

    function testNativeHighSProducerSignatureMatchesJavaTron() public {
        (bytes[] memory h,bytes[] memory s)=build(bytes32(uint256(1)),19,1);
        bytes memory original=s[0];bytes32 r;uint256 scalar;uint8 v;
        assembly {r:=mload(add(original,32)) scalar:=mload(add(original,64)) v:=byte(0,mload(add(original,96)))}
        scalar=0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141-scalar;
        s[0]=abi.encodePacked(r,bytes32(scalar),v^1);verifier.solidify(profileId,100,h,s,0);
    }

    function testMalformedAndMissingRequiredProtobufFieldsReject() public {
        bytes[] memory malformed=new bytes[](5);malformed[0]=hex"08ffffffffffffffffffff02";
        malformed[1]=hex"0f";malformed[2]=hex"0a20ff";malformed[3]=hex"08010801";malformed[4]=hex"4800";
        for(uint256 i;i<malformed.length;++i){(bool ok,)=address(wire).call(abi.encodeCall(wire.header,(malformed[i])));require(!ok,"malformed header");}
        (bool accepted,)=address(wire).call(abi.encodeCall(wire.transfer,(bytes.concat(txBytes(1,memo(),1),hex"2a00"))));
        require(!accepted,"duplicate result");
    }

    function testNativeTransferRejectsTokenTypeAndSelfTransfer() public {
        bytes memory tx_=txBytes(1,memo(),1);
        // Locate the actual field boundaries, independent of varint/payload lengths.
        (,,uint256 rawStart,uint256 rawSize,)=TronProto420.field(tx_,0);
        bytes memory originalRaw=TronProto420.cut(tx_,rawStart,rawSize);uint256 pos;bool changed;
        while(pos<originalRaw.length){
            (uint256 f,,uint256 v,,uint256 end)=TronProto420.field(originalRaw,pos);pos=end;
            if(f==11){tx_[rawStart+v+1]=0x02;changed=true;break;}
        }
        require(changed,"test contract located");
        (bool ok,)=address(wire).call(abi.encodeCall(wire.transfer,(tx_)));require(!ok,"token accepted as TRX");
        address owner=vm.addr(1000);bytes memory self_=bytes.concat(b(1,abi.encodePacked(bytes1(0x41),owner)),b(2,abi.encodePacked(bytes1(0x41),owner)),n(3,1));
        bytes memory contract_=bytes.concat(n(1,1),b(2,bytes.concat(b(1,bytes("type.googleapis.com/protocol.TransferContract")),b(2,self_))));
        bytes memory raw=b(11,contract_);bytes memory packet=bytes.concat(b(1,raw),b(2,sig(1000,sha256(raw))));
        (ok,)=address(wire).call(abi.encodeCall(wire.transfer,(packet)));require(!ok,"self-transfer");
    }

    function testSignedNativeFailureStatusAndUnsupportedMemoReject() public {
        bytes memory tx_=txBytes(1,hex"",1);rejectDeposit(tx_);
    }

    function testDelegatedWitnessPermissionAuthenticatesSRIdentity() public {
        TronFinalityVerifier420.ProfileInput memory delegated=config;
        uint256 rank=(config.checkpointTime/3000+1)%27;
        delegated.snapshotHash=keccak256("authenticated delegated permission snapshot");delegated.signingKeys[rank]=vm.addr(2000);
        bytes32 id=verifier.installProfile(delegated);
        (bytes[] memory h,bytes[] memory s)=build(bytes32(uint256(1)),19,1);
        rejected(abi.encodeCall(verifier.solidify,(id,100,h,s,0)));
        s[0]=sig(2000,sha256(h[0]));verifier.solidify(id,100,h,s,0);
    }

    function testSignedFailedNativeResultAndInt64OverflowReject() public {
        bytes memory tx_=txBytes(1,memo(),1);
        // Replace the final Result message with authenticated FAILED + contractRet SUCCESS.
        bytes memory failed=bytes.concat(TronProto420.cut(tx_,0,tx_.length-4),b(5,bytes.concat(n(2,1),n(3,1))));
        (bool ok,)=address(wire).call(abi.encodeCall(wire.transfer,(failed)));require(!ok,"FAILED result accepted");
        (ok,)=address(wire).call(abi.encodeCall(wire.transfer,(txBytes(type(uint64).max,memo(),1))));require(!ok,"negative int64 amount accepted");
        (ok,)=address(wire).call(abi.encodeCall(wire.transfer,(txBytes(0,memo(),1))));require(!ok,"zero amount accepted");
    }
}

contract TronHistoricalEvidence420Test {
    TronVm420 private constant vm = TronVm420(address(uint160(uint256(keccak256("hevm cheat code")))));
    function testGenuineMainnetSolidifiedNativeTransfer() public {
        TronRouterCaller420 router=new TronRouterCaller420();
        TronFinalityVerifier420 verifier=new TronFinalityVerifier420(address(this),address(router));
        TronFinalityVerifier420.ProfileInput memory cfg=abi.decode(vm.readFileBinary("contracts/test/fixtures/tron/historical-profile.bin"),(TronFinalityVerifier420.ProfileInput));
        bytes32 id=verifier.installProfile(cfg);
        (bytes[] memory raws,bytes[] memory signatures)=abi.decode(vm.readFileBinary("contracts/test/fixtures/tron/historical-headers.bin"),(bytes[],bytes[]));
        uint64 anchor=2;
        while(anchor<1045){
            uint64 target=anchor+100;if(target>1045)target=1045;
            uint256 len=target-anchor+40;bytes[] memory h=new bytes[](len);bytes[] memory s=new bytes[](len);
            for(uint256 i;i<len;++i){h[i]=raws[anchor-2+i];s[i]=signatures[anchor-2+i];}
            verifier.solidify(id,anchor,h,s,uint32(target-anchor-1));anchor=target;
        }
        bytes memory tx_=vm.readFileBinary("contracts/test/fixtures/tron/historical-transaction.bin");
        TronFinalityVerifier420.DepositProof memory p=TronFinalityVerifier420.DepositProof(id,1045,tx_,0,1,new bytes32[](0));
        (TronWire420.Transfer memory t,TronFinalityVerifier420.SolidBlock memory block_)=verifier.verifyNativeTransfer(p);
        require(t.id==0x21b97f0cdebc560c8533bc532252d0eef8247c3b59e8dfb1c40a2dbb6c8dd3db&&t.amount==580000000000,"historical transfer");
        require(block_.id==verifier.canonicalSolid(1045)&&t.owner==hex"71b0af54e0a1182a5e0947d6a64f3b22740ef318"&&t.gateway==hex"47d8f622c81c6512502a1a3b219ad89518d42cd2","historical identity");
        // Genuine historical payment is not a bridge deposit: no invented gateway/memo authority.
        (bool ok,)=address(verifier).call(abi.encodeCall(verifier.verifyFinalizedTransfer,(abi.encode(p))));require(!ok,"historical payment relabelled");
    }
}

// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../src/bridge/verifiers/XrplFinalityVerifier420.sol";
import "./XrplBridgeAdapter420.t.sol";

interface XrplVm420 {
    function readFileBinary(string calldata) external view returns(bytes memory);
    function etch(address,bytes calldata) external;
    function chainId(uint256) external;
}
contract XrplWireHarness420 {
    function payment(bytes memory t,bytes memory m) external pure returns(XrplPayment420.Payment memory){return XrplPayment420.parse(t,m);}
    function validation(bytes memory v) external pure returns(XrplValidation420.Validation memory){return XrplValidation420.parse(v);}
    function nativeAmount(bytes memory v) external pure returns(uint64){return XrplPayment420.nativeAmount(v,0,v.length);}
    function install(XrplFinalityVerifier420 v,XrplFinalityVerifier420.ProfileInput memory p) external {v.installProfile(p);}
    function auth(bytes32 h,bytes memory s,uint32 flags,address key) external pure {XrplValidation420.authenticate(h,s,flags,key);}
    function field(bytes memory b) external pure returns(XrplBinary420.Field memory){return XrplBinary420.field(b,0,0);}
}

contract XrplFinalityProof420Test {
    XrplVm420 private constant vm=XrplVm420(address(uint160(uint256(keccak256("hevm cheat code")))));
    bytes32 private constant ROUTE=keccak256("420/BRIDGE/ROUTE/XRP/MAINNET");
    bytes32 private constant ASSET=keccak256("420/BRIDGE/ASSET/XRP");
    bytes20 private constant GATEWAY=bytes20(uint160(0x420420));
    XrplRouterCaller420 private router;
    XrplFinalityVerifier420 private verifier;
    XrplBridgeAdapter420 private adapter;
    XrplWireHarness420 private wire;
    bytes32 private id;
    XrplFinalityVerifier420.ProfileInput private config;
    struct Bundle {bytes header;bytes[] validations;bytes transaction;bytes metadata;bytes32[16][] nodes;}
    function load(string memory name) private view returns(Bundle memory b){
        (b.header,b.validations,b.transaction,b.metadata,b.nodes)=abi.decode(vm.readFileBinary(string.concat("contracts/test/fixtures/xrpl/controlled-",name,".bin")),(bytes,bytes[],bytes,bytes,bytes32[16][]));
    }
    function setUp() public {
        vm.chainId(420);router=XrplRouterCaller420(address(0x420420));vm.etch(address(router),type(XrplRouterCaller420).runtimeCode);
        verifier=new XrplFinalityVerifier420(address(this),address(router));adapter=new XrplBridgeAdapter420(address(this),address(router),address(verifier));
        adapter.setGatewayAccount(GATEWAY,true);adapter.setXrpBinding(ASSET,ROUTE);verifier.setGateway(GATEWAY,true,420,ROUTE);
        wire=new XrplWireHarness420();config=abi.decode(vm.readFileBinary("contracts/test/fixtures/xrpl/controlled-profile.bin"),(XrplFinalityVerifier420.ProfileInput));
        id=verifier.installProfile(config);
    }
    function proof(Bundle memory b) private view returns(XrplFinalityVerifier420.Proof memory){return XrplFinalityVerifier420.Proof(id,b.header,b.transaction,b.metadata,b.nodes);}
    function certify(Bundle memory b) private {for(uint16 i;i<4;++i)verifier.submitValidation(id,b.header,b.validations[i],i);}
    function rejected(bytes memory data) private {(bool ok,)=address(verifier).call(data);require(!ok,"invalid proof accepted");}
    function rejectPayment(string memory name) private {Bundle memory b=load(name);certify(b);rejected(abi.encodeCall(verifier.verifyFinalizedTransfer,(abi.encode(proof(b)))));}

    function testNativeQuorumSHAMapAndConcreteTaggedDeposit() public {
        Bundle memory b=load("success");certify(b);IBridgeAdapter420.VerifiedTransfer memory t=router.inbound(adapter,abi.encode(proof(b)));
        require(t.amount==42_000_000&&t.recipient==address(0xb0b)&&t.routeId==ROUTE&&t.assetId==ASSET,"native binding");
        require(t.sourceTxId!=0&&t.sourceMessageId!=0,"source identities");
        (bool ok,)=address(router).call(abi.encodeCall(router.inbound,(adapter,abi.encode(proof(b)))));require(!ok,"replay accepted");
    }
    function testBelowQuorumCannotValidateLedger() public {Bundle memory b=load("success");for(uint16 i;i<3;++i)verifier.submitValidation(id,b.header,b.validations[i],i);rejected(abi.encodeCall(verifier.verifyFinalizedTransfer,(abi.encode(proof(b)))));}
    function testDuplicateMasterCannotCountTwice() public {Bundle memory b=load("success");verifier.submitValidation(id,b.header,b.validations[0],0);rejected(abi.encodeCall(verifier.submitValidation,(id,b.header,b.validations[0],uint16(0))));}
    function testWrongMemberAndMutatedSignatureReject() public {
        Bundle memory b=load("success");rejected(abi.encodeCall(verifier.submitValidation,(id,b.header,b.validations[0],uint16(1))));
        b.validations[0][b.validations[0].length-1]^=0x01;rejected(abi.encodeCall(verifier.submitValidation,(id,b.header,b.validations[0],uint16(0))));
    }
    function testWrongLedgerAndSequenceValidationReject() public {
        Bundle memory a=load("success");Bundle memory b=load("failed");rejected(abi.encodeCall(verifier.submitValidation,(id,a.header,b.validations[0],uint16(0))));
        a.header[3]^=0x01;rejected(abi.encodeCall(verifier.submitValidation,(id,a.header,a.validations[0],uint16(0))));
    }
    function testConflictingValidatedLedgerCannotReplaceCanonical() public {
        Bundle memory a=load("success");certify(a);Bundle memory b=load("failed");rejected(abi.encodeCall(verifier.submitValidation,(id,b.header,b.validations[0],uint16(0))));
    }
    function testUnknownDisabledAndExpiredProfilesFailClosed() public {
        Bundle memory b=load("success");rejected(abi.encodeCall(verifier.submitValidation,(keccak256("unknown"),b.header,b.validations[0],uint16(0))));
        certify(b);verifier.disableProfile(id);rejected(abi.encodeCall(verifier.verifyFinalizedTransfer,(abi.encode(proof(b)))));
        rejected(abi.encodeCall(verifier.installProfile,(config)));
    }
    function testTrustedListQuorumAndGovernanceRules() public {
        XrplFinalityVerifier420.ProfileInput memory c=config;c.quorum=3;rejected(abi.encodeCall(verifier.installProfile,(c)));
        c=config;c.masters[1]=c.masters[0];rejected(abi.encodeCall(verifier.installProfile,(c)));
        c=config;c.network=keccak256("XRPL/TESTNET");rejected(abi.encodeCall(verifier.installProfile,(c)));
        (bool ok,)=address(wire).call(abi.encodeCall(wire.install,(verifier,config)));require(!ok,"untrusted installer");
    }
    function testSnapshotTimeAndLedgerWindowsReject() public {
        Bundle memory b=load("success");XrplFinalityVerifier420.ProfileInput memory c=config;c.firstTime=800000001;
        bytes32 other=verifier.installProfile(c);rejected(abi.encodeCall(verifier.submitValidation,(other,b.header,b.validations[0],uint16(0))));
        c=config;c.firstLedger=1001;c.lastLedger=1001;other=verifier.installProfile(c);rejected(abi.encodeCall(verifier.submitValidation,(other,b.header,b.validations[0],uint16(0))));
    }
    function testCommittedFailureRejects() public {rejectPayment("failed");}
    function testPartialPaymentCannotOverCreditRequestedAmount() public {rejectPayment("partial");}
    function testIssuedCurrencyCannotBecomeNativeXRP() public {rejectPayment("issued");}
    function testDeliveredAmountMismatchRejects() public {rejectPayment("delivered-mismatch");}
    function testDestinationTagSubstitutionRejects() public {rejectPayment("wrong-tag");}
    function testAbsentDestinationTagDiffersFromZeroTag() public {
        Bundle memory b=load("missing-tag");certify(b);rejected(abi.encodeCall(verifier.verifyFinalizedTransfer,(abi.encode(proof(b)))));
        verifier.setGateway(GATEWAY,false,0,ROUTE);router.inbound(adapter,abi.encode(proof(b)));
    }
    function testExplicitZeroTagRequiresExplicitBinding() public {
        Bundle memory b=load("zero-tag");certify(b);rejected(abi.encodeCall(verifier.verifyFinalizedTransfer,(abi.encode(proof(b)))));
        verifier.setGateway(GATEWAY,true,0,ROUTE);router.inbound(adapter,abi.encode(proof(b)));
    }
    function testMissingBridgeMemoCannotRelabelPayment() public {rejectPayment("missing-memo");}
    function testWrongDestinationChainRejects() public {rejectPayment("wrong-chain");}
    function testWrongDestinationRouterRejects() public {rejectPayment("wrong-router");}
    function testWrongRouteRejects() public {rejectPayment("wrong-route");}
    function testZeroNativeAmountRejects() public {rejectPayment("zero-amount");}
    function testRPCOnlyValidatedAssertionRejects() public {rejected(abi.encodeCall(verifier.verifyFinalizedTransfer,(bytes('{"validated":true,"TransactionResult":"tesSUCCESS"}'))));}
    function testMetadataAndTransactionRootTamperingRejects() public {
        Bundle memory b=load("success");certify(b);b.metadata[b.metadata.length-1]=0x80;
        rejected(abi.encodeCall(verifier.verifyFinalizedTransfer,(abi.encode(proof(b)))));
    }
    function testKeyDirectedSHAMapWrongBranchRejects() public {
        Bundle memory b=load("success");certify(b);b.nodes[0][0]^=bytes32(uint256(1));
        rejected(abi.encodeCall(verifier.verifyFinalizedTransfer,(abi.encode(proof(b)))));
    }
    function testSHAMapMissingOrExcessiveDepthRejects() public {
        Bundle memory b=load("success");certify(b);b.nodes=new bytes32[16][](0);
        rejected(abi.encodeCall(verifier.verifyFinalizedTransfer,(abi.encode(proof(b)))));b.nodes=new bytes32[16][](65);
        rejected(abi.encodeCall(verifier.verifyFinalizedTransfer,(abi.encode(proof(b)))));
    }
    function testMalformedSTObjectAndNonCanonicalEnvelopeReject() public {
        Bundle memory b=load("success");certify(b);bytes memory p=abi.encode(proof(b));rejected(abi.encodeCall(verifier.verifyFinalizedTransfer,(bytes.concat(p,hex"00"))));
        (bool ok,)=address(wire).call(abi.encodeCall(wire.validation,(bytes.concat(b.validations[0],hex"2280000001"))));require(!ok,"duplicate field");
    }
    function testPartialAndNonCanonicalValidationReject() public {
        Bundle memory b=load("success");b.validations[0][4]=0x00;
        rejected(abi.encodeCall(verifier.submitValidation,(id,b.header,b.validations[0],uint16(0))));
    }
    function testGatewayRevocationAndReplayAcrossVerifierRotation() public {
        Bundle memory b=load("success");certify(b);verifier.setGateway(GATEWAY,true,420,0);rejected(abi.encodeCall(verifier.verifyFinalizedTransfer,(abi.encode(proof(b)))));
        verifier.setGateway(GATEWAY,true,420,ROUTE);router.inbound(adapter,abi.encode(proof(b)));adapter.setVerifier(address(verifier));
        (bool ok,)=address(router).call(abi.encodeCall(router.inbound,(adapter,abi.encode(proof(b)))));require(!ok,"rotated replay");
    }
    function testWrongDestinationChainAfterDeploymentRejects() public {Bundle memory b=load("success");certify(b);vm.chainId(421);rejected(abi.encodeCall(verifier.verifyFinalizedTransfer,(abi.encode(proof(b)))));}
    function testProductionSizesAndPerCallGas() public {
        require(address(verifier).code.length<=24576&&address(verifier.hash()).code.length<=24576&&address(adapter).code.length<=24576,"runtime");
        require(type(XrplFinalityVerifier420).creationCode.length<=49152,"init");Bundle memory b=load("success");
        for(uint16 i;i<4;++i){uint256 before_=gasleft();verifier.submitValidation(id,b.header,b.validations[i],i);require(before_-gasleft()<30_000_000,"validation gas");}
        uint256 before_=gasleft();router.inbound(adapter,abi.encode(proof(b)));require(before_-gasleft()<30_000_000,"deposit gas");
    }
    function testFuzzNativeDropsIntact(uint64 value) public {
        uint64 n=uint64(uint256(value)%100_000_000_000_000_000)+1;
        require(wire.nativeAmount(abi.encodePacked(n|0x4000000000000000))==n,"drops truncation");
    }
    function testFuzzInvalidNativeSignAndIssuedBitReject(uint64 value) public {
        uint64 n=(value&0x3fffffffffffffff)|0x8000000000000000;
        (bool ok,)=address(wire).call(abi.encodeCall(wire.nativeAmount,(abi.encodePacked(n))));require(!ok,"issued/negative accepted");
    }
    function testIndependentSHA512HalfPaddingAndPrefixVectors() public {
        (bytes[] memory messages,bytes32[] memory expected)=abi.decode(vm.readFileBinary("contracts/test/fixtures/xrpl/sha512half-vectors.bin"),(bytes[],bytes32[]));
        for(uint256 i;i<messages.length;++i)require(verifier.hash().half(messages[i])==expected[i],"SHA512Half mismatch");
    }
    function testNativeDERCanonicalFlagAndMalformedSignature() public {
        (bytes32 digest,bytes memory high,address key)=abi.decode(vm.readFileBinary("contracts/test/fixtures/xrpl/controlled-high-s.bin"),(bytes32,bytes,address));
        wire.auth(digest,high,0,key);
        (bool ok,)=address(wire).call(abi.encodeCall(wire.auth,(digest,high,uint32(0x80000000),key)));require(!ok,"fully canonical high-s");
        high[0]=0x31;(ok,)=address(wire).call(abi.encodeCall(wire.auth,(digest,high,uint32(0),key)));require(!ok,"malformed DER");
        (ok,)=address(wire).call(abi.encodeCall(wire.auth,(digest,hex"3006020100020101",uint32(0),key)));require(!ok,"zero scalar");
    }
    function testMalformedVLAndNativeAmountBoundariesReject() public {
        bytes[] memory bad=new bytes[](4);bad[0]=hex"730321";bad[1]=hex"7321ff";bad[2]=hex"70032100";bad[3]=hex"73ff";
        for(uint256 i;i<bad.length;++i){(bool ok,)=address(wire).call(abi.encodeCall(wire.field,(bad[i])));require(!ok,"malformed VL accepted");}
        (bool ok,)=address(wire).call(abi.encodeCall(wire.nativeAmount,(abi.encodePacked(uint64(0x4000000000000000)))));require(!ok,"zero drops");
        (ok,)=address(wire).call(abi.encodeCall(wire.nativeAmount,(abi.encodePacked(uint64(100_000_000_000_000_001)|0x4000000000000000))));require(!ok,"XRP supply overflow");
    }
}

contract XrplHistoricalEvidence420Test {
    XrplVm420 private constant vm=XrplVm420(address(uint160(uint256(keccak256("hevm cheat code")))));
    function testGenuineNativeValidatedLedgerQuorumAndTaggedPayment() public {
        vm.chainId(420);XrplRouterCaller420 router=new XrplRouterCaller420();XrplFinalityVerifier420 v=new XrplFinalityVerifier420(address(this),address(router));
        XrplFinalityVerifier420.ProfileInput memory c=abi.decode(vm.readFileBinary("contracts/test/fixtures/xrpl/historical-profile.bin"),(XrplFinalityVerifier420.ProfileInput));
        bytes32 id=v.installProfile(c);bytes memory header=vm.readFileBinary("contracts/test/fixtures/xrpl/historical-header.bin");
        bytes[] memory signatures=abi.decode(vm.readFileBinary("contracts/test/fixtures/xrpl/historical-validations.bin"),(bytes[]));
        for(uint256 i;i<signatures.length;++i){
            bytes32 key=sha256(XrplValidation420.parse(signatures[i]).signingKey);uint16 member=type(uint16).max;
            for(uint16 j;j<c.signingKeyHashes.length;++j)if(key==c.signingKeyHashes[j]){member=j;break;}
            v.submitValidation(id,header,signatures[i],member);
        }
        (bytes memory tx_,bytes memory meta,bytes32[16][] memory nodes)=abi.decode(vm.readFileBinary("contracts/test/fixtures/xrpl/historical-payment.bin"),(bytes,bytes,bytes32[16][]));
        XrplFinalityVerifier420.Proof memory p=XrplFinalityVerifier420.Proof(id,header,tx_,meta,nodes);
        (XrplPayment420.Payment memory payment,XrplFinalityVerifier420.Header memory h,bytes32 txid)=v.verifyPayment(p);
        require(h.sequence==108335815&&h.ledger==0x57aae73205466cc58b797ba8be06286d5b7a26dadd7f990c6782da7c259d669e,"native ledger");
        require(txid==0xf3f79b9f3230a7823be46802a433aba2ad046262811c9655d7e909dcf88a5399&&payment.drops==24_809_848&&payment.hasTag&&payment.tag==282161781,"historical tagged drops");
        require(payment.source==hex"d528b62dc7af16417c9f44aad8c04d920a3a705f"&&payment.gateway==hex"cfa3536f5d67dd960240d14d9af13517551e57ff","historical accounts");
        (bool ok,)=address(v).call(abi.encodeCall(v.verifyFinalizedTransfer,(abi.encode(p))));require(!ok,"ordinary payment relabelled");
    }
}

// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../src/bridge/verifiers/DogecoinFinalityVerifier420.sol";
import "../src/bridge/adapters/DogecoinBridgeAdapter420.sol";
import "./DogecoinBridgeAdapter420.t.sol";

interface DogecoinVm420 {
    function readFileBinary(string calldata) external view returns(bytes memory);
    function warp(uint256) external;
    function store(address,bytes32,bytes32) external;
    function expectRevert(bytes4) external;
}

contract DogecoinConsensusQualification420Test {
    DogecoinVm420 constant vm=DogecoinVm420(address(uint160(uint256(keccak256("hevm cheat code")))));
    bytes32 constant ROUTE=keccak256("btc-route");
    bytes32 constant ASSET=keccak256("btc-asset");
    function slice(bytes memory b,uint256 at,uint256 n) internal pure returns(bytes memory r){
        require(at+n<=b.length);r=new bytes(n);
        for(uint256 i;i<n;i+=32){assembly("memory-safe"){mstore(add(add(r,32),i),mload(add(add(b,32),add(at,i))))}}
        // The final word may contain unused bytes; bytes length excludes them.
    }
    function testTargetsAndFuzzArithmetic(uint32 bits) public {
        DogecoinHeaderChain420 c=new DogecoinHeaderChain420();
        (bool ok,bytes memory out)=address(c).staticcall(abi.encodeCall(c.decodeTarget,(bits)));
        if(ok){
            uint256 t=abi.decode(out,(uint256));
            require(t>0 && t<=c.POW_LIMIT());
            require(c.blockWork(t)==type(uint256).max/(t+1)+(type(uint256).max%(t+1)==t?1:0));
            require(c.decodeTarget(c.encodeTarget(t))<=t);
        }
        require(c.decodeTarget(0x01010000)==1);
        require(c.decodeTarget(0x02008000)==128);
    }
    function testMalformedHeadersAndTimestampRules() public {
        vm.warp(1_800_000_000);
        bytes memory fixture=vm.readFileBinary("contracts/test/fixtures/dogecoin/headers.bin");
        DogecoinHeaderChain420 c=new DogecoinHeaderChain420();
        bytes memory raw=slice(fixture,80,80);
        work(c,raw);
        vm.warp(BridgeWire420.readLE(raw,68,4)-7201);
        vm.expectRevert(DogecoinHeaderChain420.InvalidTimestamp.selector);c.submit(raw,hex"");
        vm.warp(BridgeWire420.readLE(raw,68,4)-7200);c.submit(raw,hex"");
        vm.warp(1_800_000_000);
        raw=slice(fixture,160,80);raw[68]=0;raw[69]=0;raw[70]=0;raw[71]=0;
        vm.expectRevert(DogecoinHeaderChain420.InvalidTimestamp.selector);c.submit(raw,hex"");
        raw=slice(fixture,160,80);raw[72]=0xfe;
        vm.expectRevert(DogecoinHeaderChain420.InvalidTarget.selector);c.submit(raw,hex"");
        raw=slice(fixture,160,80);raw[4]^=0x01;
        vm.expectRevert(DogecoinHeaderChain420.UnknownParent.selector);c.submit(raw,hex"");
        vm.expectRevert(DogecoinHeaderChain420.InvalidHeader.selector);c.submit(hex"00",hex"");
    }
    // State injection creates deterministic fork/deposit fixtures only. Historical
    // header admission above always runs real mainnet PoW without modified storage.
    function put(DogecoinHeaderChain420 c,bytes32 h,bytes32 parent,bytes32 root,uint256 work,uint64 height,uint32 time,uint32 bits,uint32 start) internal {
        bytes32 slot=keccak256(abi.encode(h,uint256(0)));
        vm.store(address(c),slot,parent);
        vm.store(address(c),bytes32(uint256(slot)+1),root);
        vm.store(address(c),bytes32(uint256(slot)+2),bytes32(work));
        vm.store(address(c),bytes32(uint256(slot)+3),bytes32(uint256(height)|(uint256(time)<<64)|(uint256(bits)<<96)|(uint256(start)<<128)));
    }
    function testForkSelectionAndReorgOfCanonicalConfirmations() public {
        vm.warp(1_800_000_000);
        bytes memory fixture=vm.readFileBinary("contracts/test/fixtures/dogecoin/headers.bin");
        DogecoinHeaderChain420 c=new DogecoinHeaderChain420();
        work(c,slice(fixture,80,80));work(c,slice(fixture,160,80));work(c,slice(fixture,240,80));
        bytes32 one=c.submit(slice(fixture,80,80),hex"");
        bytes32 two=BridgeCrypto420.sha256d(slice(fixture,160,80));
        bytes32 fork=keccak256("synthetic competing parent");
        DogecoinHeaderChain420.Header memory first=c.getHeader(one);
        put(c,fork,c.GENESIS(),0,first.work+1,1,first.time,first.bits,first.periodStart);
        vm.store(address(c),bytes32(uint256(1)),fork);
        require(c.confirmations(one,new bytes32[](0))==0);
        // A real header on the old branch outranks the competing tip by cumulative work.
        require(c.submit(slice(fixture,160,80),hex"")==two && c.bestTip()==two);
        bytes32[] memory path=new bytes32[](1);path[0]=one;
        require(c.confirmations(one,path)==2 && c.confirmations(fork,path)==0);
        // An exactly tied competing tip is retained; equal work does not switch tips.
        put(c,fork,c.GENESIS(),0,c.getHeader(two).work+1048592,3,first.time,first.bits,first.periodStart);
        vm.store(address(c),bytes32(uint256(1)),fork);
        c.submit(slice(fixture,240,80),hex"");require(c.bestTip()==fork);
    }
    function transaction(bytes memory script,bytes memory commitment,uint64 value) internal pure returns(bytes memory){
        return abi.encodePacked(hex"0100000001",bytes32(uint256(1)),hex"0000000000ffffffff02",BridgeWire420.encodeLE(value,8),bytes1(uint8(script.length)),script,hex"000000000000000022",commitment,hex"00000000");
    }
    function parse(bytes calldata raw) external pure returns(DogecoinTransaction420.Parsed memory){return DogecoinTransaction420.parse(raw,0,1);}
    function testDisabledWitnessAndDogecoinMoneyLimits() public {
        bytes memory raw=transaction(hex"76a914111111111111111111111111111111111111111188ac",abi.encodePacked(hex"6a20",bytes32(uint256(2))),1_000_000_000_000_000_000);
        require(this.parse(raw).payment.value==1_000_000_000_000_000_000);
        bytes memory witness=abi.encodePacked(slice(raw,0,4),hex"0001",slice(raw,4,raw.length-8),hex"01020102",slice(raw,raw.length-4,4));
        vm.expectRevert(DogecoinTransaction420.InvalidTransaction.selector);this.parse(witness);
        raw=transaction(hex"76a914111111111111111111111111111111111111111188ac",abi.encodePacked(hex"6a20",bytes32(uint256(2))),1_000_000_000_000_000_001);
        vm.expectRevert(DogecoinTransaction420.InvalidTransaction.selector);this.parse(raw);
    }
    function testRealVerifierAdapterDepositAndOutpointReplayAcrossRotation() public {
        DogecoinHeaderChain420 c=new DogecoinHeaderChain420();
        DogecoinRouterCaller420 router=new DogecoinRouterCaller420();
        bytes memory script=hex"76a914111111111111111111111111111111111111111188ac";
        DogecoinFinalityVerifier420 v=new DogecoinFinalityVerifier420(c,script,ROUTE,1,address(router),12);
        bytes memory tx_=transaction(script,v.commitmentScript(0,address(0xB0B),1000),1000);
        bytes32 deposit=keccak256("synthetic deposit block");
        put(c,deposit,c.GENESIS(),BridgeCrypto420.sha256d(tx_),100,1,1386470000,0x1e0ffff0,1386325540);
        bytes32[] memory ancestry=new bytes32[](11);bytes32 parent=deposit;
        for(uint256 i;i<11;++i){bytes32 h=keccak256(abi.encode(i));put(c,h,parent,0,101+i,uint64(2+i),1386470001+uint32(i),0x1e0ffff0,1386325540);parent=h;}
        vm.store(address(c),bytes32(uint256(1)),parent);
        bytes32 cursor=parent;
        for(uint256 i;i<11;++i){cursor=c.getHeader(cursor).parent;ancestry[i]=cursor;}
        DogecoinFinalityVerifier420.Proof memory p=DogecoinFinalityVerifier420.Proof(deposit,tx_,0,1,address(0xB0B),0,new bytes32[](0),ancestry);
        DogecoinBridgeAdapter420 a=new DogecoinBridgeAdapter420(address(this),address(router),address(v));a.setDogeBinding(ASSET,ROUTE);a.setGatewayScript(v.gatewayScriptHash(),true);
        IBridgeAdapter420.VerifiedTransfer memory t=router.inbound(a,abi.encode(p));require(t.amount==1000 && t.recipient==address(0xB0B));
        DogecoinFinalityVerifier420 v2=new DogecoinFinalityVerifier420(c,script,ROUTE,1,address(router),12);a.setVerifier(address(v2));
        vm.expectRevert(DogecoinBridgeAdapter420.Replay.selector);router.inbound(a,abi.encode(p));
        p.recipient=address(0xBAD);vm.expectRevert(DogecoinFinalityVerifier420.InvalidDeposit.selector);v.verifyFinalizedTransfer(abi.encode(p));
        p.recipient=address(0xB0B);p.index=1;vm.expectRevert(DogecoinFinalityVerifier420.InvalidInclusion.selector);v.verifyFinalizedTransfer(abi.encode(p));
        p.index=0;vm.store(address(c),bytes32(uint256(1)),ancestry[0]);p.ancestry=slicePath(ancestry);
        vm.expectRevert(DogecoinFinalityVerifier420.InsufficientConfirmations.selector);v.verifyFinalizedTransfer(abi.encode(p));
    }
    function slicePath(bytes32[] memory a) internal pure returns(bytes32[] memory r){r=new bytes32[](a.length-1);for(uint256 i;i<r.length;++i)r[i]=a[i+1];}
    function depositFixture() internal returns(DogecoinHeaderChain420 c,DogecoinFinalityVerifier420 v,DogecoinFinalityVerifier420.Proof memory p){
        c=new DogecoinHeaderChain420();
        v=new DogecoinFinalityVerifier420(c,hex"76a914111111111111111111111111111111111111111188ac",ROUTE,1,address(this),12);
        bytes memory tx_=transaction(hex"76a914111111111111111111111111111111111111111188ac",v.commitmentScript(0,address(0xB0B),1000),1000);
        bytes32 deposit=keccak256("adversarial deposit");
        put(c,deposit,c.GENESIS(),BridgeCrypto420.sha256d(tx_),100,1,1386470000,0x1e0ffff0,1386325540);
        bytes32[] memory path=new bytes32[](11);bytes32 parent=deposit;
        for(uint256 i;i<11;++i){bytes32 h=keccak256(abi.encode(i));put(c,h,parent,0,101+i,uint64(2+i),1386470001+uint32(i),0x1e0ffff0,1386325540);parent=h;}
        vm.store(address(c),bytes32(uint256(1)),parent);
        for(uint256 i;i<11;++i){parent=c.getHeader(parent).parent;path[i]=parent;}
        p=DogecoinFinalityVerifier420.Proof(deposit,tx_,0,1,address(0xB0B),0,new bytes32[](0),path);
    }
    function testAdmissionRejectsSubstitutedAmountsScriptsCommitmentsAndDomains() public {
        (DogecoinHeaderChain420 c,DogecoinFinalityVerifier420 v,DogecoinFinalityVerifier420.Proof memory p)=depositFixture();
        bytes memory original=p.transaction;
        // Re-encoding strips only transport-level witness bytes, preserving the authenticated claim.
        IDogecoinFinalityVerifier420.FinalizedTransfer memory t=v.verifyFinalizedTransfer(abi.encode(p));
        p.transaction=abi.encodePacked(slice(original,0,4),hex"0001",slice(original,4,original.length-8),hex"01020102",slice(original,original.length-4,4));
        vm.expectRevert(DogecoinTransaction420.InvalidTransaction.selector);v.verifyFinalizedTransfer(abi.encode(p));
        require(t.amount==1000);
        p.transaction=transaction(hex"76a914222222222222222222222222222222222222222288ac",v.commitmentScript(0,address(0xB0B),1000),1000);
        vm.expectRevert(DogecoinFinalityVerifier420.InvalidDeposit.selector);v.verifyFinalizedTransfer(abi.encode(p));
        p.transaction=transaction(hex"76a914111111111111111111111111111111111111111188ac",v.commitmentScript(0,address(0xB0B),1000),1001);
        vm.expectRevert(DogecoinFinalityVerifier420.InvalidDeposit.selector);v.verifyFinalizedTransfer(abi.encode(p));
        p.transaction=transaction(hex"76a914111111111111111111111111111111111111111188ac",v.commitmentScript(0,address(0xB0B),0),0);
        vm.expectRevert(DogecoinFinalityVerifier420.InvalidDeposit.selector);v.verifyFinalizedTransfer(abi.encode(p));
        p.transaction=original;
        DogecoinFinalityVerifier420 other=new DogecoinFinalityVerifier420(c,hex"76a914111111111111111111111111111111111111111188ac",keccak256("another route"),1,address(this),12);
        vm.expectRevert(DogecoinFinalityVerifier420.InvalidDeposit.selector);other.verifyFinalizedTransfer(abi.encode(p));
        other=new DogecoinFinalityVerifier420(c,hex"76a914111111111111111111111111111111111111111188ac",ROUTE,1,address(v),12);
        vm.expectRevert(DogecoinFinalityVerifier420.InvalidDeposit.selector);other.verifyFinalizedTransfer(abi.encode(p));
        other=new DogecoinFinalityVerifier420(c,hex"76a914111111111111111111111111111111111111111188ac",ROUTE,2,address(this),12);
        vm.expectRevert(DogecoinFinalityVerifier420.InvalidDeposit.selector);other.verifyFinalizedTransfer(abi.encode(p));
        p.recipient=address(0);vm.expectRevert(DogecoinFinalityVerifier420.InvalidDeposit.selector);v.verifyFinalizedTransfer(abi.encode(p));
        p.recipient=address(0xB0B);
        vm.expectRevert(DogecoinFinalityVerifier420.InvalidDeposit.selector);v.verifyFinalizedTransfer(abi.encodePacked(abi.encode(p),hex"00"));
        p.paymentIndex=1;p.commitmentIndex=0;vm.expectRevert(DogecoinFinalityVerifier420.InvalidDeposit.selector);v.verifyFinalizedTransfer(abi.encode(p));
        p.paymentIndex=0;p.commitmentIndex=1;
        // A competing tip with no ancestry to the deposit makes the old proof unusable.
        vm.store(address(c),bytes32(uint256(1)),c.GENESIS());
        vm.expectRevert(DogecoinFinalityVerifier420.InsufficientConfirmations.selector);v.verifyFinalizedTransfer(abi.encode(p));
    }
    function testParserRejectsNoncanonicalCountsAndInvalidIndices() public {
        bytes memory raw=transaction(hex"76a914111111111111111111111111111111111111111188ac",abi.encodePacked(hex"6a20",bytes32(uint256(2))),1000);
        bytes memory bad=abi.encodePacked(slice(raw,0,4),hex"fd0100",slice(raw,5,raw.length-5));
        vm.expectRevert(BridgeWire420.NonCanonical.selector);this.parse(bad);
        vm.expectRevert(DogecoinTransaction420.InvalidTransaction.selector);this.parse(abi.encodePacked(raw,hex"00"));
        DogecoinTransaction420.Parsed memory p=this.parse(raw);require(p.version==1 && p.lockTime==0 && p.commitmentOutputs==1);
        (bool ok,)=address(this).call(abi.encodeCall(this.parseIndices,(raw,2,1)));require(!ok);
        (ok,)=address(this).call(abi.encodeCall(this.parseIndices,(raw,0,0)));require(!ok);
        // Two individually valid outputs exceed MAX_MONEY in aggregate.
        bad=transaction(hex"76a914111111111111111111111111111111111111111188ac",abi.encodePacked(hex"6a20",bytes32(uint256(2))),1_000_000_000_000_000_000);
        bad[81]=0x01; // commitment value starts after the payment script at byte 78
        vm.expectRevert(DogecoinTransaction420.InvalidTransaction.selector);this.parse(bad);
    }
    function parseIndices(bytes calldata b,uint32 i,uint32 j) external pure returns(DogecoinTransaction420.Parsed memory){return DogecoinTransaction420.parse(b,i,j);}
    function testFuzzTruncatedTransaction(uint16 cut) public {
        bytes memory raw=transaction(hex"76a914111111111111111111111111111111111111111188ac",abi.encodePacked(hex"6a20",bytes32(uint256(2))),1000);
        (bool ok,)=address(this).call(abi.encodeCall(this.parse,(slice(raw,0,uint256(cut)%raw.length))));require(!ok);
    }
    function testMismatchedVerifierRouteOrRouterRejectedByAdapter() public {
        DogecoinHeaderChain420 c=new DogecoinHeaderChain420();DogecoinRouterCaller420 r=new DogecoinRouterCaller420();
        DogecoinFinalityVerifier420 v=new DogecoinFinalityVerifier420(c,hex"76a914111111111111111111111111111111111111111188ac",ROUTE,1,address(this),12);
        DogecoinBridgeAdapter420 a=new DogecoinBridgeAdapter420(address(this),address(r),address(v));a.setDogeBinding(ASSET,ROUTE);a.setGatewayScript(v.gatewayScriptHash(),true);
        vm.expectRevert(DogecoinBridgeAdapter420.InvalidVerifier.selector);r.inbound(a,hex"00");
        v=new DogecoinFinalityVerifier420(c,hex"76a914111111111111111111111111111111111111111188ac",keccak256("wrong route"),1,address(r),12);a.setVerifier(address(v));
        vm.expectRevert(DogecoinBridgeAdapter420.InvalidVerifier.selector);r.inbound(a,hex"00");
    }

    function testDuplicateCommitmentsCoinbaseAndMerkleDepthRejected() public {
        (,DogecoinFinalityVerifier420 v,DogecoinFinalityVerifier420.Proof memory p)=depositFixture();
        bytes memory raw=p.transaction;raw[46]=0x03;
        p.transaction=abi.encodePacked(slice(raw,0,raw.length-4),hex"000000000000000022",v.commitmentScript(0,address(0xB0B),1000),hex"00000000");
        vm.expectRevert(DogecoinFinalityVerifier420.InvalidDeposit.selector);v.verifyFinalizedTransfer(abi.encode(p));
        // A syntactically valid coinbase with two outputs is still ineligible for deposits.
        bytes memory coinbase=abi.encodePacked(hex"0100000001",bytes32(0),hex"ffffffff020101ffffffff",slice(raw,46,raw.length-46));
        coinbase[48]=0x02;
        DogecoinTransaction420.Parsed memory parsed=this.parse(coinbase);require(parsed.coinbase);
        p.transaction=coinbase;vm.expectRevert(DogecoinFinalityVerifier420.InvalidDeposit.selector);v.verifyFinalizedTransfer(abi.encode(p));
        require(!v.verifyInclusion(bytes32(uint256(1)),bytes32(uint256(1)),0,new bytes32[](33)));
        DogecoinHeaderChain420 c=new DogecoinHeaderChain420();
        try new DogecoinFinalityVerifier420(c,hex"6a20",ROUTE,1,address(this),12) {revert("unspendable gateway");} catch {}
    }

    function work(DogecoinHeaderChain420 c,bytes memory raw) internal {LitecoinScrypt420 worker=c.scrypt();bytes32 id=worker.begin(raw);while(worker.cursor(id)<2048)worker.advance(id,32);}
}

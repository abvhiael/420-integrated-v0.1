// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../src/bridge/verifiers/LitecoinFinalityVerifier420.sol";
import "../src/bridge/adapters/LitecoinBridgeAdapter420.sol";
import "./LitecoinBridgeAdapter420.t.sol";

interface LitecoinVm420 {
    function readFileBinary(string calldata) external view returns(bytes memory);
    function warp(uint256) external;
    function store(address,bytes32,bytes32) external;
    function expectRevert(bytes4) external;
}

contract LitecoinConsensusQualification420Test {
    LitecoinVm420 constant vm=LitecoinVm420(address(uint160(uint256(keccak256("hevm cheat code")))));
    bytes32 constant ROUTE=keccak256("btc-route");
    bytes32 constant ASSET=keccak256("btc-asset");
    function slice(bytes memory b,uint256 at,uint256 n) internal pure returns(bytes memory r){
        require(at+n<=b.length);r=new bytes(n);
        for(uint256 i;i<n;i+=32){assembly("memory-safe"){mstore(add(add(r,32),i),mload(add(add(b,32),add(at,i))))}}
        // The final word may contain unused bytes; bytes length excludes them.
    }
    function testTargetsAndFuzzArithmetic(uint32 bits) public {
        LitecoinHeaderChain420 c=new LitecoinHeaderChain420();
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
        bytes memory fixture=vm.readFileBinary("contracts/test/fixtures/litecoin/headers.bin");
        LitecoinHeaderChain420 c=new LitecoinHeaderChain420();
        bytes memory raw=slice(fixture,80,80);
        work(c,raw);
        vm.warp(uint256(BridgeWire420.readLE(raw,68,4))-7201);
        vm.expectRevert(LitecoinHeaderChain420.InvalidTimestamp.selector);c.submit(raw);
        vm.warp(uint256(BridgeWire420.readLE(raw,68,4))-7200);c.submit(raw);
        vm.warp(1_800_000_000);
        raw=slice(fixture,160,80);raw[68]=0;raw[69]=0;raw[70]=0;raw[71]=0;
        vm.expectRevert(LitecoinHeaderChain420.InvalidTimestamp.selector);c.submit(raw);
        raw=slice(fixture,160,80);raw[72]=0xfe;
        vm.expectRevert(LitecoinHeaderChain420.InvalidTarget.selector);c.submit(raw);
        raw=slice(fixture,160,80);raw[4]^=0x01;
        vm.expectRevert(LitecoinHeaderChain420.UnknownParent.selector);c.submit(raw);
        vm.expectRevert(LitecoinHeaderChain420.InvalidHeader.selector);c.submit(hex"00");
    }
    // State injection creates deterministic fork/deposit fixtures only. Historical
    // header admission above always runs real mainnet PoW without modified storage.
    function put(LitecoinHeaderChain420 c,bytes32 h,bytes32 parent,bytes32 root,uint256 work,uint64 height,uint32 time,uint32 bits,uint32 start) internal {
        bytes32 slot=keccak256(abi.encode(h,uint256(0)));
        vm.store(address(c),slot,parent);
        vm.store(address(c),bytes32(uint256(slot)+1),root);
        vm.store(address(c),bytes32(uint256(slot)+2),bytes32(work));
        vm.store(address(c),bytes32(uint256(slot)+3),bytes32(uint256(height)|(uint256(time)<<64)|(uint256(bits)<<96)|(uint256(start)<<128)));
    }
    function testForkSelectionAndReorgOfCanonicalConfirmations() public {
        vm.warp(1_800_000_000);
        bytes memory fixture=vm.readFileBinary("contracts/test/fixtures/litecoin/headers.bin");
        LitecoinHeaderChain420 c=new LitecoinHeaderChain420();
        work(c,slice(fixture,80,80));work(c,slice(fixture,160,80));work(c,slice(fixture,240,80));
        bytes32 one=c.submit(slice(fixture,80,80));
        bytes32 two=BridgeCrypto420.sha256d(slice(fixture,160,80));
        bytes32 fork=keccak256("synthetic competing parent");
        LitecoinHeaderChain420.Header memory first=c.getHeader(one);
        put(c,fork,c.GENESIS(),0,first.work+1,1,first.time,first.bits,first.periodStart);
        vm.store(address(c),bytes32(uint256(1)),fork);
        require(c.confirmations(one,new bytes32[](0))==0);
        // A real header on the old branch outranks the competing tip by cumulative work.
        require(c.submit(slice(fixture,160,80))==two && c.bestTip()==two);
        bytes32[] memory path=new bytes32[](1);path[0]=one;
        require(c.confirmations(one,path)==2 && c.confirmations(fork,path)==0);
        // An exactly tied competing tip is retained; equal work does not switch tips.
        put(c,fork,c.GENESIS(),0,c.getHeader(two).work+1048592,3,first.time,first.bits,first.periodStart);
        vm.store(address(c),bytes32(uint256(1)),fork);
        c.submit(slice(fixture,240,80));require(c.bestTip()==fork);
    }
    function testRetargetClampsAndSignedElapsed() public {
        LitecoinHeaderChain420 c=new LitecoinHeaderChain420();bytes32 p=keccak256("period parent");
        uint32 old=0x1c00ffff;uint256 target=c.decodeTarget(old);
        put(c,p,c.GENESIS(),0,1,2015,100,old,101);
        require(c.expectedBits(p)==c.encodeTarget(target/4));
        put(c,p,c.GENESIS(),0,1,2015,5_000_000,old,1);
        require(c.expectedBits(p)==c.encodeTarget(target*4));
        put(c,p,c.GENESIS(),0,1,2015,5_000_000,0x1e0ffff0,1);
        require(c.expectedBits(p)==0x1e0fffff);
    }
    function transaction(bytes memory script,bytes memory commitment,uint64 value) internal pure returns(bytes memory){
        return abi.encodePacked(hex"0100000001",bytes32(uint256(1)),hex"0000000000ffffffff02",BridgeWire420.encodeLE(value,8),bytes1(uint8(script.length)),script,hex"000000000000000022",commitment,hex"00000000");
    }
    function parse(bytes calldata raw) external pure returns(LitecoinTransaction420.Parsed memory){return LitecoinTransaction420.parse(raw,0,1);}
    function testSegwitTxidAndMalformedWitness() public {
        bytes memory raw=transaction(hex"00141111111111111111111111111111111111111111",abi.encodePacked(hex"6a20",bytes32(uint256(2))),1000);
        LitecoinTransaction420.Parsed memory legacy=this.parse(raw);
        bytes memory segwit=abi.encodePacked(slice(raw,0,4),hex"0001",slice(raw,4,raw.length-8),hex"01020102",slice(raw,raw.length-4,4));
        LitecoinTransaction420.Parsed memory witness=this.parse(segwit);
        require(witness.txid==legacy.txid && witness.strippedSize==raw.length);
        segwit[segwit.length-5]=0x03;
        require(this.parse(segwit).txid==legacy.txid); // Witness bytes do not affect txid.
        segwit[5]=0x03;vm.expectRevert(LitecoinTransaction420.InvalidTransaction.selector);this.parse(segwit);
        bytes memory empty=abi.encodePacked(slice(raw,0,4),hex"0001",slice(raw,4,raw.length-8),hex"00",slice(raw,raw.length-4,4));
        vm.expectRevert(LitecoinTransaction420.InvalidTransaction.selector);this.parse(empty);
        raw=transaction(hex"00141111111111111111111111111111111111111111",abi.encodePacked(hex"6a20",bytes32(uint256(2))),8_400_000_000_000_001);
        vm.expectRevert(LitecoinTransaction420.InvalidTransaction.selector);this.parse(raw);
    }
    function testRealVerifierAdapterDepositAndOutpointReplayAcrossRotation() public {
        LitecoinHeaderChain420 c=new LitecoinHeaderChain420();
        LitecoinRouterCaller420 router=new LitecoinRouterCaller420();
        bytes memory script=hex"00141111111111111111111111111111111111111111";
        LitecoinFinalityVerifier420 v=new LitecoinFinalityVerifier420(c,script,ROUTE,1,address(router));
        bytes memory tx_=transaction(script,v.commitmentScript(0,address(0xB0B),1000),1000);
        bytes32 deposit=keccak256("synthetic deposit block");
        put(c,deposit,c.GENESIS(),BridgeCrypto420.sha256d(tx_),100,1,1318474965,0x1e0ffff0,1317972665);
        bytes32[] memory ancestry=new bytes32[](11);bytes32 parent=deposit;
        for(uint256 i;i<11;++i){bytes32 h=keccak256(abi.encode(i));put(c,h,parent,0,101+i,uint64(2+i),1318474966+uint32(i),0x1e0ffff0,1317972665);parent=h;}
        vm.store(address(c),bytes32(uint256(1)),parent);
        bytes32 cursor=parent;
        for(uint256 i;i<11;++i){cursor=c.getHeader(cursor).parent;ancestry[i]=cursor;}
        LitecoinFinalityVerifier420.Proof memory p=LitecoinFinalityVerifier420.Proof(deposit,tx_,0,1,address(0xB0B),0,new bytes32[](0),ancestry);
        LitecoinBridgeAdapter420 a=new LitecoinBridgeAdapter420(address(this),address(router),address(v));a.setLtcBinding(ASSET,ROUTE);
        IBridgeAdapter420.VerifiedTransfer memory t=router.inbound(a,abi.encode(p));require(t.amount==1000 && t.recipient==address(0xB0B));
        LitecoinFinalityVerifier420 v2=new LitecoinFinalityVerifier420(c,script,ROUTE,1,address(router));a.setVerifier(address(v2));
        vm.expectRevert(LitecoinBridgeAdapter420.Replay.selector);router.inbound(a,abi.encode(p));
        p.recipient=address(0xBAD);vm.expectRevert(LitecoinFinalityVerifier420.InvalidDeposit.selector);v.verifyFinalizedTransfer(abi.encode(p));
        p.recipient=address(0xB0B);p.index=1;vm.expectRevert(LitecoinFinalityVerifier420.InvalidInclusion.selector);v.verifyFinalizedTransfer(abi.encode(p));
        p.index=0;vm.store(address(c),bytes32(uint256(1)),ancestry[0]);p.ancestry=slicePath(ancestry);
        vm.expectRevert(LitecoinFinalityVerifier420.InsufficientConfirmations.selector);v.verifyFinalizedTransfer(abi.encode(p));
    }
    function slicePath(bytes32[] memory a) internal pure returns(bytes32[] memory r){r=new bytes32[](a.length-1);for(uint256 i;i<r.length;++i)r[i]=a[i+1];}
    function depositFixture() internal returns(LitecoinHeaderChain420 c,LitecoinFinalityVerifier420 v,LitecoinFinalityVerifier420.Proof memory p){
        c=new LitecoinHeaderChain420();
        v=new LitecoinFinalityVerifier420(c,hex"00141111111111111111111111111111111111111111",ROUTE,1,address(this));
        bytes memory tx_=transaction(hex"00141111111111111111111111111111111111111111",v.commitmentScript(0,address(0xB0B),1000),1000);
        bytes32 deposit=keccak256("adversarial deposit");
        put(c,deposit,c.GENESIS(),BridgeCrypto420.sha256d(tx_),100,1,1318474965,0x1e0ffff0,1317972665);
        bytes32[] memory path=new bytes32[](11);bytes32 parent=deposit;
        for(uint256 i;i<11;++i){bytes32 h=keccak256(abi.encode(i));put(c,h,parent,0,101+i,uint64(2+i),1318474966+uint32(i),0x1e0ffff0,1317972665);parent=h;}
        vm.store(address(c),bytes32(uint256(1)),parent);
        for(uint256 i;i<11;++i){parent=c.getHeader(parent).parent;path[i]=parent;}
        p=LitecoinFinalityVerifier420.Proof(deposit,tx_,0,1,address(0xB0B),0,new bytes32[](0),path);
    }
    function testAdmissionRejectsSubstitutedAmountsScriptsCommitmentsAndDomains() public {
        (LitecoinHeaderChain420 c,LitecoinFinalityVerifier420 v,LitecoinFinalityVerifier420.Proof memory p)=depositFixture();
        bytes memory original=p.transaction;
        // Re-encoding strips only transport-level witness bytes, preserving the authenticated claim.
        ILitecoinFinalityVerifier420.FinalizedTransfer memory t=v.verifyFinalizedTransfer(abi.encode(p));
        p.transaction=abi.encodePacked(slice(original,0,4),hex"0001",slice(original,4,original.length-8),hex"01020102",slice(original,original.length-4,4));
        ILitecoinFinalityVerifier420.FinalizedTransfer memory w=v.verifyFinalizedTransfer(abi.encode(p));
        require(w.sourceOutput==t.sourceOutput && w.messageId==t.messageId && w.amountLitoshis==t.amountLitoshis);
        p.transaction=transaction(hex"00142222222222222222222222222222222222222222",v.commitmentScript(0,address(0xB0B),1000),1000);
        vm.expectRevert(LitecoinFinalityVerifier420.InvalidDeposit.selector);v.verifyFinalizedTransfer(abi.encode(p));
        p.transaction=transaction(hex"00141111111111111111111111111111111111111111",v.commitmentScript(0,address(0xB0B),1000),1001);
        vm.expectRevert(LitecoinFinalityVerifier420.InvalidDeposit.selector);v.verifyFinalizedTransfer(abi.encode(p));
        p.transaction=transaction(hex"00141111111111111111111111111111111111111111",v.commitmentScript(0,address(0xB0B),0),0);
        vm.expectRevert(LitecoinFinalityVerifier420.InvalidDeposit.selector);v.verifyFinalizedTransfer(abi.encode(p));
        p.transaction=original;
        LitecoinFinalityVerifier420 other=new LitecoinFinalityVerifier420(c,hex"00141111111111111111111111111111111111111111",keccak256("another route"),1,address(this));
        vm.expectRevert(LitecoinFinalityVerifier420.InvalidDeposit.selector);other.verifyFinalizedTransfer(abi.encode(p));
        other=new LitecoinFinalityVerifier420(c,hex"00141111111111111111111111111111111111111111",ROUTE,1,address(v));
        vm.expectRevert(LitecoinFinalityVerifier420.InvalidDeposit.selector);other.verifyFinalizedTransfer(abi.encode(p));
        other=new LitecoinFinalityVerifier420(c,hex"00141111111111111111111111111111111111111111",ROUTE,2,address(this));
        vm.expectRevert(LitecoinFinalityVerifier420.InvalidDeposit.selector);other.verifyFinalizedTransfer(abi.encode(p));
        p.recipient=address(0);vm.expectRevert(LitecoinFinalityVerifier420.InvalidDeposit.selector);v.verifyFinalizedTransfer(abi.encode(p));
        p.recipient=address(0xB0B);
        vm.expectRevert(LitecoinFinalityVerifier420.InvalidDeposit.selector);v.verifyFinalizedTransfer(abi.encodePacked(abi.encode(p),hex"00"));
        p.paymentIndex=1;p.commitmentIndex=0;vm.expectRevert(LitecoinFinalityVerifier420.InvalidDeposit.selector);v.verifyFinalizedTransfer(abi.encode(p));
        p.paymentIndex=0;p.commitmentIndex=1;
        // A competing tip with no ancestry to the deposit makes the old proof unusable.
        vm.store(address(c),bytes32(uint256(1)),c.GENESIS());
        vm.expectRevert(LitecoinFinalityVerifier420.InsufficientConfirmations.selector);v.verifyFinalizedTransfer(abi.encode(p));
    }
    function testParserRejectsNoncanonicalCountsAndInvalidIndices() public {
        bytes memory raw=transaction(hex"00141111111111111111111111111111111111111111",abi.encodePacked(hex"6a20",bytes32(uint256(2))),1000);
        bytes memory bad=abi.encodePacked(slice(raw,0,4),hex"fd0100",slice(raw,5,raw.length-5));
        vm.expectRevert(BridgeWire420.NonCanonical.selector);this.parse(bad);
        vm.expectRevert(LitecoinTransaction420.InvalidTransaction.selector);this.parse(abi.encodePacked(raw,hex"00"));
        LitecoinTransaction420.Parsed memory p=this.parse(raw);require(p.version==1 && p.lockTime==0 && p.commitmentOutputs==1);
        (bool ok,)=address(this).call(abi.encodeCall(this.parseIndices,(raw,2,1)));require(!ok);
        (ok,)=address(this).call(abi.encodeCall(this.parseIndices,(raw,0,0)));require(!ok);
        // Two individually valid outputs exceed MAX_MONEY in aggregate.
        bad=transaction(hex"00141111111111111111111111111111111111111111",abi.encodePacked(hex"6a20",bytes32(uint256(2))),8_400_000_000_000_000);
        bad[78]=0x01; // commitment value starts after the payment script at byte 78
        vm.expectRevert(LitecoinTransaction420.InvalidTransaction.selector);this.parse(bad);
    }
    function parseIndices(bytes calldata b,uint32 i,uint32 j) external pure returns(LitecoinTransaction420.Parsed memory){return LitecoinTransaction420.parse(b,i,j);}
    function testFuzzTruncatedTransaction(uint16 cut) public {
        bytes memory raw=transaction(hex"00141111111111111111111111111111111111111111",abi.encodePacked(hex"6a20",bytes32(uint256(2))),1000);
        (bool ok,)=address(this).call(abi.encodeCall(this.parse,(slice(raw,0,uint256(cut)%raw.length))));require(!ok);
    }
    function testHistoricalVersionEnforcementAndMedianSorting() public {
        vm.warp(1_800_000_000);LitecoinHeaderChain420 c=new LitecoinHeaderChain420();
        bytes memory raw=slice(vm.readFileBinary("contracts/test/fixtures/litecoin/headers.bin"),80,80);
        work(c,raw);
        uint64[3] memory thresholds=[uint64(709999),uint64(811878),uint64(918683)];
        for(uint256 i;i<3;++i){put(c,c.GENESIS(),0,0,1048592,thresholds[i],1317972665,0x1e0ffff0,1317972665);vm.expectRevert(LitecoinHeaderChain420.InvalidHeader.selector);c.submit(raw);}
        bytes32 parent;uint32[11] memory times=[uint32(50),10,90,20,80,30,70,40,60,0,100];
        for(uint256 i;i<11;++i){bytes32 h=keccak256(abi.encode("mtp",i));put(c,h,parent,0,i+1,uint64(i),times[i],0x1e0ffff0,0);parent=h;}
        require(c.medianTimePast(parent)==50);
    }
    function testMismatchedVerifierRouteOrRouterRejectedByAdapter() public {
        LitecoinHeaderChain420 c=new LitecoinHeaderChain420();LitecoinRouterCaller420 r=new LitecoinRouterCaller420();
        LitecoinFinalityVerifier420 v=new LitecoinFinalityVerifier420(c,hex"00141111111111111111111111111111111111111111",ROUTE,1,address(this));
        LitecoinBridgeAdapter420 a=new LitecoinBridgeAdapter420(address(this),address(r),address(v));a.setLtcBinding(ASSET,ROUTE);
        vm.expectRevert(LitecoinBridgeAdapter420.InvalidVerifier.selector);r.inbound(a,hex"00");
        v=new LitecoinFinalityVerifier420(c,hex"00141111111111111111111111111111111111111111",keccak256("wrong route"),1,address(r));a.setVerifier(address(v));
        vm.expectRevert(LitecoinBridgeAdapter420.InvalidVerifier.selector);r.inbound(a,hex"00");
    }

    function testDuplicateCommitmentsCoinbaseAndMerkleDepthRejected() public {
        (,LitecoinFinalityVerifier420 v,LitecoinFinalityVerifier420.Proof memory p)=depositFixture();
        bytes memory raw=p.transaction;raw[46]=0x03;
        p.transaction=abi.encodePacked(slice(raw,0,raw.length-4),hex"000000000000000022",v.commitmentScript(0,address(0xB0B),1000),hex"00000000");
        vm.expectRevert(LitecoinFinalityVerifier420.InvalidDeposit.selector);v.verifyFinalizedTransfer(abi.encode(p));
        // A syntactically valid coinbase with two outputs is still ineligible for deposits.
        bytes memory coinbase=abi.encodePacked(hex"0100000001",bytes32(0),hex"ffffffff020101ffffffff",slice(raw,46,raw.length-46));
        coinbase[48]=0x02;
        LitecoinTransaction420.Parsed memory parsed=this.parse(coinbase);require(parsed.coinbase);
        p.transaction=coinbase;vm.expectRevert(LitecoinFinalityVerifier420.InvalidDeposit.selector);v.verifyFinalizedTransfer(abi.encode(p));
        require(!v.verifyInclusion(bytes32(uint256(1)),bytes32(uint256(1)),0,new bytes32[](33)));
        LitecoinHeaderChain420 c=new LitecoinHeaderChain420();
        try new LitecoinFinalityVerifier420(c,hex"6a20",ROUTE,1,address(this)) {revert("unspendable gateway");} catch {}
    }

    function work(LitecoinHeaderChain420 c,bytes memory raw) internal {
        LitecoinScrypt420 worker=c.scrypt();bytes32 id=worker.begin(raw);
        while(worker.cursor(id)<2048)worker.advance(id,32);
    }
}

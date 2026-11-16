// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../src/bridge/verifiers/LitecoinFinalityVerifier420.sol";
interface LitecoinHistoryVm420 {function readFileBinary(string calldata) external view returns(bytes memory);function warp(uint256) external;function store(address,bytes32,bytes32) external;function expectRevert(bytes4) external;}
contract LitecoinHistorical420Test {
    LitecoinHistoryVm420 constant vm=LitecoinHistoryVm420(address(uint160(uint256(keccak256("hevm cheat code")))));
    function read(string memory name) private view returns(bytes memory){return vm.readFileBinary(string.concat("contracts/test/fixtures/litecoin/",name));}
    function slice(bytes memory b,uint256 at,uint256 n) private pure returns(bytes memory r){r=new bytes(n);for(uint256 i;i<n;++i)r[i]=b[at+i];}
    function work(LitecoinHeaderChain420 c,bytes memory raw) private {LitecoinScrypt420 s=c.scrypt();bytes32 id=s.begin(raw);while(s.cursor(id)<2048)s.advance(id,32);}
    function testGenuineConsecutiveHeadersScryptChainWorkAndTwelveConfirmations() public {
        vm.warp(1_800_000_000);LitecoinHeaderChain420 c=new LitecoinHeaderChain420();bytes memory data=read("headers.bin");bytes memory oracle=read("oracle.bin");bytes32 deposit;
        for(uint256 i=1;i<=12;++i){bytes memory raw=slice(data,i*80,80);work(c,raw);bytes32 id=c.submit(raw);if(i==1)deposit=id;require(c.getHeader(id).work==BridgeWire420.readBE(oracle,i*36,32));require(c.medianTimePast(id)==BridgeWire420.readLE(oracle,i*36+32,4));}
        bytes32[] memory path=new bytes32[](11);bytes32 cursor=c.bestTip();for(uint256 i;i<11;++i){cursor=c.getHeader(cursor).parent;path[i]=cursor;}
        require(c.confirmations(deposit,path)==12);path[0]=0;require(c.confirmations(deposit,path)==0);
    }
    function seed(LitecoinHeaderChain420 c,bytes memory raw,uint64 height,uint256 cumulative,uint32 start) private returns(bytes32 id){
        id=BridgeCrypto420.sha256d(raw);bytes32 slot=keccak256(abi.encode(id,uint256(0)));
        vm.store(address(c),slot,bytes32(BridgeWire420.readBE(raw,4,32)));vm.store(address(c),bytes32(uint256(slot)+1),bytes32(BridgeWire420.readBE(raw,36,32)));vm.store(address(c),bytes32(uint256(slot)+2),bytes32(cumulative));
        vm.store(address(c),bytes32(uint256(slot)+3),bytes32(uint256(height)|(BridgeWire420.readLE(raw,68,4)<<64)|(BridgeWire420.readLE(raw,72,4)<<96)|(uint256(start)<<128)));
    }
    // Only historical parent CONTEXT is seeded. Both boundary headers run complete
    // real on-chain Scrypt and production difficulty/time/chainwork admission.
    function testGenuineFirstAndFullPeriodRetargetBoundaries() public {
        vm.warp(1_800_000_000);LitecoinHeaderChain420 c=new LitecoinHeaderChain420();bytes memory data=read("headers.bin");bytes memory oracle=read("oracle.bin");
        uint64[2] memory boundaries=[uint64(2016),4032];uint32[2] memory bits=[uint32(0x1e0fffff),0x1e03ffff];
        for(uint256 b;b<2;++b){uint64 height=boundaries[b];uint32 start=uint32(BridgeWire420.readLE(data,uint256(b==0?0:2015)*80+68,4));bytes32 parent;
            for(uint64 j=height-11;j<height;++j)parent=seed(c,slice(data,j*80,80),j,BridgeWire420.readBE(oracle,j*36,32),start);
            vm.store(address(c),bytes32(uint256(1)),parent);require(c.expectedBits(parent)==bits[b]);
            bytes memory raw=slice(data,height*80,80);work(c,raw);bytes32 id=c.submit(raw);require(c.bestTip()==id);
            LitecoinHeaderChain420.Header memory h=c.getHeader(id);require(h.work==BridgeWire420.readBE(oracle,height*36,32) && h.periodStart==c.getHeader(parent).time);
        }
    }
    function testModernMainnetScryptAndGenuineSegwitOutputsAndMerklePaths() public {
        LitecoinHeaderChain420 c=new LitecoinHeaderChain420();bytes memory raw=read("modern-header.bin");work(c,raw);(bytes32 digest,bool complete)=c.scrypt().result(BridgeCrypto420.sha256d(raw));
        require(complete && digest==bytes32(BridgeWire420.readBE(read("modern-pow.bin"),0,32)));
        bytes memory tx_=read("transparent.bin");LitecoinTransaction420.Parsed memory p=LitecoinTransaction420.parse(tx_,0,1);require(p.payment.value==381815687 && p.commitment.value==227171762 && !p.coinbase);
        membership(p.txid,"transparent-proof.bin");membership(BridgeCrypto420.sha256d(read("legacy.bin")),"legacy-proof.bin");
        membership(BridgeCrypto420.sha256d(read("hogex-stripped.bin")),"hogex-proof.bin");
        LitecoinFinalityVerifier420 v=new LitecoinFinalityVerifier420(c,hex"00141111111111111111111111111111111111111111",keccak256("route"),1,address(this));
        // Historical ordinary payments never satisfy the required gateway commitment.
        require(p.commitmentOutputs==0 && p.payment.scriptHash!=v.gatewayScriptHash());
    }
    function membership(bytes32 txid,string memory file) private {
        bytes memory p=read(file);uint256 index=BridgeWire420.readLE(p,0,4);uint256 count=uint8(p[4]);bytes32[] memory path=new bytes32[](count);
        for(uint256 i;i<count;++i)path[i]=bytes32(BridgeWire420.readBE(p,5+i*32,32));bytes32 root=bytes32(BridgeWire420.readBE(p,5+count*32,32));require(txid==bytes32(BridgeWire420.readBE(p,37+count*32,32)));
        bytes32 leaf=txid;for(uint256 i;i<count;++i){leaf=(index&1)==0?BridgeCrypto420.sha256d(abi.encodePacked(leaf,path[i])):BridgeCrypto420.sha256d(abi.encodePacked(path[i],leaf));index>>=1;}require(index==0 && leaf==root);
    }
}

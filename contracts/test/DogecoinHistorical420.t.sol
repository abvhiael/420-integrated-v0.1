// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../src/bridge/verifiers/DogecoinFinalityVerifier420.sol";
interface DogecoinHistoricalVm420 {function readFileBinary(string calldata) external view returns(bytes memory);function store(address,bytes32,bytes32) external;function warp(uint256) external;function expectRevert(bytes4) external;}
contract DogecoinHistorical420Test {
    DogecoinHistoricalVm420 constant vm=DogecoinHistoricalVm420(address(uint160(uint256(keccak256("hevm cheat code")))));
    function read(string memory name) private view returns(bytes memory){return vm.readFileBinary(string.concat("contracts/test/fixtures/dogecoin/",name));}
    function name(uint256 v) private pure returns(string memory){if(v==0)return "0";uint256 n;uint256 x=v;while(x!=0){++n;x/=10;}bytes memory b=new bytes(n);while(v!=0){b[--n]=bytes1(uint8(48+v%10));v/=10;}return string(b);}
    function header(uint256 height) private view returns(bytes memory){return read(string.concat("headers/",name(height),".bin"));}
    function work(DogecoinHeaderChain420 c,bytes memory raw) private {LitecoinScrypt420 s=c.scrypt();bytes32 id=s.begin(raw);while(s.cursor(id)<2048)s.advance(id,32);}
    function seed(DogecoinHeaderChain420 c,uint64 height,uint256 work_) private returns(bytes32 id){bytes memory raw=header(height);id=BridgeCrypto420.sha256d(raw);bytes32 p=keccak256(abi.encode(id,uint256(0)));vm.store(address(c),p,bytes32(BridgeWire420.readBE(raw,4,32)));vm.store(address(c),bytes32(uint256(p)+1),bytes32(BridgeWire420.readBE(raw,36,32)));vm.store(address(c),bytes32(uint256(p)+2),bytes32(work_));vm.store(address(c),bytes32(uint256(p)+3),bytes32(uint256(height)|(BridgeWire420.readLE(raw,68,4)<<64)|(BridgeWire420.readLE(raw,72,4)<<96)));}
    function context(DogecoinHeaderChain420 c,uint64 parent) private {uint256 sum;bytes32 tip;for(uint64 i=parent-10;i<=parent;++i){sum+=c.blockWork(c.decodeTarget(uint32(BridgeWire420.readLE(header(i),72,4))));tip=seed(c,i,sum);}vm.store(address(c),bytes32(uint256(1)),tip);}
    function testGenuineGenesisLinkedScryptHeadersAndWork() public {
        vm.warp(1_800_000_000);DogecoinHeaderChain420 c=new DogecoinHeaderChain420();bytes32 first;
        for(uint256 i=1;i<=12;++i){bytes memory raw=header(i);work(c,raw);bytes32 id=c.submit(raw,hex"");if(i==1)first=id;require(c.getHeader(id).height==i && c.getHeader(id).work==(i+1)*1048592);}
        bytes32[] memory path=new bytes32[](11);bytes32 cur=c.bestTip();for(uint256 i;i<11;++i){cur=c.getHeader(cur).parent;path[i]=cur;}require(c.confirmations(first,path)==12);
    }
    function testGenuineDigishieldActivationHeaderAdmission() public {
        vm.warp(1_800_000_000);DogecoinHeaderChain420 c=new DogecoinHeaderChain420();context(c,144999);bytes memory raw=header(145000);require(c.expectedBits(c.bestTip())==BridgeWire420.readLE(raw,72,4));work(c,raw);bytes32 id=c.submit(raw,hex"");require(c.bestTip()==id && c.getHeader(id).height==145000);
    }
    function testGenuineMergedMiningChainParentWorkConfirmationsAndTransaction() public {
        vm.warp(1_800_000_000);DogecoinHeaderChain420 c=new DogecoinHeaderChain420();context(c,371336);bytes32 first;
        bytes memory activation=header(371337);bytes memory aux=read("aux/371337.bin");
        vm.expectRevert(DogecoinHeaderChain420.InvalidHeader.selector);c.submit(activation,aux);
        // A completed CHILD hash must never substitute for the merged-mining PARENT's work.
        work(c,activation);vm.expectRevert(DogecoinHeaderChain420.InvalidHeader.selector);c.submit(activation,aux);
        for(uint256 height=371337;height<=371348;++height){bytes memory raw=header(height);bytes memory encoded=read(string.concat("aux/",name(height),".bin"));bytes memory parent=c.powHeader(raw,encoded,uint64(height));work(c,parent);bytes32 id=c.submit(raw,encoded);if(height==371337)first=id;require(c.getHeader(id).height==height);}
        bytes32[] memory path=new bytes32[](11);bytes32 cur=c.bestTip();for(uint256 i;i<11;++i){cur=c.getHeader(cur).parent;path[i]=cur;}require(c.confirmations(first,path)==12);
        DogecoinFinalityVerifier420 v=new DogecoinFinalityVerifier420(c,hex"76a914111111111111111111111111111111111111111188ac",keccak256("route"),1,address(this),12);
        bytes memory tx_=read("payment.bin");DogecoinTransaction420.Parsed memory txp=DogecoinTransaction420.parse(tx_,0,1);require(txp.payment.value==1400000000 && txp.commitment.value==8456400000000 && txp.commitmentOutputs==0 && !txp.coinbase);
        bytes memory proof=read("payment-proof.bin");uint256 index=BridgeWire420.readBE(proof,0,32);uint256 depth=BridgeWire420.readBE(proof,32,32);bytes32[] memory siblings=new bytes32[](depth);for(uint256 i;i<depth;++i)siblings[i]=bytes32(BridgeWire420.readBE(proof,64+32*i,32));
        require(txp.txid==bytes32(BridgeWire420.readBE(proof,64+32*depth,32)));require(v.verifyInclusion(txp.txid,c.getHeader(first).merkleRoot,index,siblings));require(!v.verifyInclusion(txp.txid,c.getHeader(first).merkleRoot,index^1,siblings));
        DogecoinFinalityVerifier420.Proof memory claim=DogecoinFinalityVerifier420.Proof(first,tx_,0,1,address(0xB0B),index,siblings,path);
        vm.expectRevert(DogecoinFinalityVerifier420.InvalidDeposit.selector);v.verifyFinalizedTransfer(abi.encode(claim));
        vm.store(address(c),bytes32(uint256(1)),c.GENESIS());vm.expectRevert(DogecoinFinalityVerifier420.InsufficientConfirmations.selector);v.verifyFinalizedTransfer(abi.encode(claim));
    }
    function testGenuinePreDigishieldRetargetBoundariesAndWork() public {
        vm.warp(1_800_000_000);DogecoinHeaderChain420 c=new DogecoinHeaderChain420();bytes memory data=read("headers.bin");bytes memory oracle=read("oracle.bin");uint64[2] memory heights=[uint64(240),480];
        for(uint256 b;b<2;++b){uint64 height=heights[b];uint32 start=uint32(BridgeWire420.readLE(data,uint256(b==0?0:239)*80+68,4));bytes32 parent;
            for(uint64 j=height-11;j<height;++j){bytes memory raw=new bytes(80);for(uint256 k;k<80;++k)raw[k]=data[uint256(j)*80+k];bytes32 id=BridgeCrypto420.sha256d(raw);bytes32 slot=keccak256(abi.encode(id,uint256(0)));vm.store(address(c),slot,bytes32(BridgeWire420.readBE(raw,4,32)));vm.store(address(c),bytes32(uint256(slot)+1),bytes32(BridgeWire420.readBE(raw,36,32)));vm.store(address(c),bytes32(uint256(slot)+2),bytes32(BridgeWire420.readBE(oracle,uint256(j)*64,32)));vm.store(address(c),bytes32(uint256(slot)+3),bytes32(uint256(j)|(BridgeWire420.readLE(raw,68,4)<<64)|(BridgeWire420.readLE(raw,72,4)<<96)|(uint256(start)<<128)));parent=id;}
            vm.store(address(c),bytes32(uint256(1)),parent);bytes memory child=new bytes(80);for(uint256 k;k<80;++k)child[k]=data[uint256(height)*80+k];require(c.expectedBits(parent)==BridgeWire420.readLE(child,72,4));work(c,child);bytes32 id=c.submit(child,hex"");require(c.bestTip()==id && c.getHeader(id).work==BridgeWire420.readBE(oracle,uint256(height)*64,32) && c.getHeader(id).periodStart==c.getHeader(parent).time);
        }
    }
}

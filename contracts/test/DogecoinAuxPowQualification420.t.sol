// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../src/bridge/verifiers/DogecoinHeaderChain420.sol";
interface DogecoinAuxVm420 {function readFileBinary(string calldata) external view returns(bytes memory);function expectRevert(bytes4) external;}
contract DogecoinAuxPowQualification420Test {
    DogecoinAuxVm420 constant vm=DogecoinAuxVm420(address(uint160(uint256(keccak256("hevm cheat code")))));
    function read(string memory file) internal view returns(bytes memory){return vm.readFileBinary(string.concat("contracts/test/fixtures/dogecoin/",file));}
    function validate(bytes calldata child,bytes calldata aux,uint64 height) external pure returns(bytes memory){return DogecoinAuxPow420.validate(child,aux,height);}
    function testGenuineActivationAuxPowAndParentScrypt() public {
        bytes memory child=read("headers/371337.bin");bytes memory aux=read("aux/371337.bin");bytes memory parent=this.validate(child,aux,371337);require(keccak256(parent)==keccak256(read("parents/371337.bin")));
        require(BridgeCrypto420.sha256d(child)==0x53f0dc500d0fd8912622c5c2475f83529326c19dac4e955a1bffc5f982393260);
        DogecoinHeaderChain420 c=new DogecoinHeaderChain420();LitecoinScrypt420 s=c.scrypt();bytes32 id=s.begin(parent);for(uint256 i;i<64;++i)s.advance(id,32);
        (bytes32 digest,bool complete)=s.result(id);require(complete && digest==bytes32(BridgeWire420.readBE(read("parent-pow.bin"),0,32)));
        uint256 pow;for(uint256 i;i<32;++i)pow|=uint256(uint8(digest[i]))<<(8*i);require(pow<=c.decodeTarget(uint32(BridgeWire420.readLE(child,72,4))));
    }
    function testAuxPowRejectsSubstitutedBranchesIndexParentAndEnvelope() public {
        bytes memory child=read("headers/371337.bin");bytes memory encoded=read("aux/371337.bin");DogecoinAuxPow420.Proof memory p=abi.decode(encoded,(DogecoinAuxPow420.Proof));
        p.parentIndex=1;vm.expectRevert(DogecoinAuxPow420.InvalidAuxPow.selector);this.validate(child,abi.encode(p),371337);p.parentIndex=0;
        p.chainIndex^=1;vm.expectRevert(DogecoinAuxPow420.InvalidAuxPow.selector);this.validate(child,abi.encode(p),371337);p.chainIndex^=1;
        p.parentBranch[0]^=bytes32(uint256(1));vm.expectRevert(DogecoinAuxPow420.InvalidAuxPow.selector);this.validate(child,abi.encode(p),371337);p.parentBranch[0]^=bytes32(uint256(1));
        p.chainBranch[0]^=bytes32(uint256(1));vm.expectRevert(DogecoinAuxPow420.InvalidAuxPow.selector);this.validate(child,abi.encode(p),371337);p.chainBranch[0]^=bytes32(uint256(1));
        p.parentHeader[2]=0x62;p.parentHeader[3]=0;vm.expectRevert(DogecoinAuxPow420.InvalidAuxPow.selector);this.validate(child,abi.encode(p),371337);
        vm.expectRevert(DogecoinAuxPow420.InvalidAuxPow.selector);this.validate(child,abi.encodePacked(encoded,hex"00"),371337);
        p=abi.decode(encoded,(DogecoinAuxPow420.Proof));p.chainBranch=new bytes32[](31);vm.expectRevert(DogecoinAuxPow420.InvalidAuxPow.selector);this.validate(child,abi.encode(p),371337);
        child[4]^=0x01;vm.expectRevert(DogecoinAuxPow420.InvalidAuxPow.selector);this.validate(child,encoded,371337);
    }
    function slice(bytes memory b,uint256 at,uint256 n) internal pure returns(bytes memory r){r=new bytes(n);for(uint256 i;i<n;++i)r[i]=b[at+i];}
    function rebind(DogecoinAuxPow420.Proof memory p,bytes memory script) internal pure returns(DogecoinAuxPow420.Proof memory){
        uint256 old=uint8(p.coinbase[41]);require(old<253 && script.length<253);p.coinbase=abi.encodePacked(slice(p.coinbase,0,41),bytes1(uint8(script.length)),script,slice(p.coinbase,42+old,p.coinbase.length-42-old));
        bytes32 root=DogecoinAuxPow420.branch(BridgeCrypto420.sha256d(p.coinbase),0,p.parentBranch);for(uint256 i;i<32;++i)p.parentHeader[36+i]=root[i];return p;
    }
    function testMergedMiningMagicPlacementTreeSizeNonceAndLegacyRootRules() public {
        bytes memory child=read("headers/371337.bin");DogecoinAuxPow420.Proof memory p=abi.decode(read("aux/371337.bin"),(DogecoinAuxPow420.Proof));
        bytes32 root=DogecoinAuxPow420.branch(BridgeCrypto420.sha256d(child),p.chainIndex,p.chainBranch);bytes memory reversed=new bytes(32);for(uint256 i;i<32;++i)reversed[i]=root[31-i];
        uint256 old=uint8(p.coinbase[41]);bytes memory script=slice(p.coinbase,42,old);uint256 at;
        for(uint256 i;i+32<=script.length;++i)if(keccak256(slice(script,i,32))==keccak256(reversed)){at=i;break;}
        bytes memory tail=slice(script,at+32,8);
        DogecoinAuxPow420.Proof memory q=rebind(abi.decode(abi.encode(p),(DogecoinAuxPow420.Proof)),abi.encodePacked(hex"00",reversed,tail));this.validate(child,abi.encode(q),371337);
        q=rebind(abi.decode(abi.encode(p),(DogecoinAuxPow420.Proof)),abi.encodePacked(new bytes(21),reversed,tail));vm.expectRevert(DogecoinAuxPow420.InvalidAuxPow.selector);this.validate(child,abi.encode(q),371337);
        q=rebind(abi.decode(abi.encode(p),(DogecoinAuxPow420.Proof)),abi.encodePacked(hex"fabe6d6dfabe6d6d",reversed,tail));vm.expectRevert(DogecoinAuxPow420.InvalidAuxPow.selector);this.validate(child,abi.encode(q),371337);
        q=rebind(abi.decode(abi.encode(p),(DogecoinAuxPow420.Proof)),abi.encodePacked(hex"fabe6d6d00",reversed,tail));vm.expectRevert(DogecoinAuxPow420.InvalidAuxPow.selector);this.validate(child,abi.encode(q),371337);
        tail[0]^=0x01;q=rebind(abi.decode(abi.encode(p),(DogecoinAuxPow420.Proof)),abi.encodePacked(hex"fabe6d6d",reversed,tail));vm.expectRevert(DogecoinAuxPow420.InvalidAuxPow.selector);this.validate(child,abi.encode(q),371337);
        tail[0]^=0x01;tail[4]^=0x01;q=rebind(abi.decode(abi.encode(p),(DogecoinAuxPow420.Proof)),abi.encodePacked(hex"fabe6d6d",reversed,tail));vm.expectRevert(DogecoinAuxPow420.InvalidAuxPow.selector);this.validate(child,abi.encode(q),371337);
        q=rebind(p,abi.encodePacked(hex"fabe6d6d",reversed));vm.expectRevert(DogecoinAuxPow420.InvalidAuxPow.selector);this.validate(child,abi.encode(q),371337);
    }
    function testChainIdentityActivationLegacyV2AndBuriedBaseVersions() public {
        bytes memory h=read("headers/371337.bin");bytes memory a=read("aux/371337.bin");vm.expectRevert(DogecoinAuxPow420.InvalidAuxPow.selector);this.validate(h,a,371336);
        h[0]=0x02;h[1]=0;h[2]=0;h[3]=0;this.validate(h,hex"",371336);vm.expectRevert(DogecoinAuxPow420.InvalidAuxPow.selector);this.validate(h,hex"",371337);
        h[2]=0x62;this.validate(h,hex"",371337);vm.expectRevert(DogecoinAuxPow420.InvalidAuxPow.selector);this.validate(h,hex"",1034383);
        h[0]=0x03;this.validate(h,hex"",1034383);vm.expectRevert(DogecoinAuxPow420.InvalidAuxPow.selector);this.validate(h,hex"",3464751);h[0]=0x04;this.validate(h,hex"",3464751);
    }
    function testFuzzWrongChainIdentityAlwaysFails(uint16 chain) public {if(chain==98)return;bytes memory h=read("headers/371337.bin");h[2]=bytes1(uint8(chain));h[3]=bytes1(uint8(chain>>8));vm.expectRevert(DogecoinAuxPow420.InvalidAuxPow.selector);this.validate(h,read("aux/371337.bin"),371337);}
    function testParentCandidateTransactionIsNotSubjectToDogecoinOutputValidation() public {
        bytes memory child=read("headers/371337.bin");DogecoinAuxPow420.Proof memory p=abi.decode(read("aux/371337.bin"),(DogecoinAuxPow420.Proof));
        uint256 outputCount=42+uint8(p.coinbase[41])+4;
        p.coinbase=abi.encodePacked(slice(p.coinbase,0,outputCount),hex"00",slice(p.coinbase,p.coinbase.length-4,4));
        bytes32 root=DogecoinAuxPow420.branch(BridgeCrypto420.sha256d(p.coinbase),0,p.parentBranch);for(uint256 i;i<32;++i)p.parentHeader[36+i]=root[i];
        // Core authenticates the parent candidate's hash/work, not its full chain's
        // transaction consensus. A child deposit still requires valid outputs.
        this.validate(child,abi.encode(p),371337);
    }
}

// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../src/bridge/verifiers/DogecoinHeaderChain420.sol";
interface DogecoinDifficultyVm420 {function store(address,bytes32,bytes32) external;function readFileBinary(string calldata) external view returns(bytes memory);}
contract DogecoinDifficulty420Test {
    DogecoinDifficultyVm420 constant vm=DogecoinDifficultyVm420(address(uint160(uint256(keccak256("hevm cheat code")))));
    function put(DogecoinHeaderChain420 c,bytes32 id,bytes32 parent,uint64 height,uint32 time,uint32 bits,uint32 start) private {bytes32 s=keccak256(abi.encode(id,uint256(0)));vm.store(address(c),s,parent);vm.store(address(c),bytes32(uint256(s)+2),bytes32(uint256(1)));vm.store(address(c),bytes32(uint256(s)+3),bytes32(uint256(height)|(uint256(time)<<64)|(uint256(bits)<<96)|(uint256(start)<<128)));}
    function testPreDigishieldAllClampRegimesAndPowLimit() public {
        DogecoinHeaderChain420 c=new DogecoinHeaderChain420();bytes32 p=keccak256("parent");uint32 bits=0x1c00ffff;uint256 t=c.decodeTarget(bits);
        put(c,p,c.GENESIS(),239,100,bits,101);require(c.expectedBits(p)==c.encodeTarget(t/16));
        put(c,p,c.GENESIS(),5039,100,bits,101);require(c.expectedBits(p)==c.encodeTarget(t/8));
        put(c,p,c.GENESIS(),10079,100,bits,101);require(c.expectedBits(p)==c.encodeTarget(t/4));
        put(c,p,c.GENESIS(),239,100000,bits,0);require(c.expectedBits(p)==c.encodeTarget(t*4));
        put(c,p,c.GENESIS(),239,100000,0x1e0ffff0,0);require(c.expectedBits(p)==0x1e0fffff);
        put(c,p,c.GENESIS(),240,100000,bits,0);require(c.expectedBits(p)==bits);
    }
    function testDigishieldAmplitudeSignedDivisionAndBoundsAgainstIndependentVectors() public {
        DogecoinHeaderChain420 c=new DogecoinHeaderChain420();bytes32 gp=keccak256("grandparent");bytes32 p=keccak256("parent");put(c,gp,c.GENESIS(),144998,1000000,0x1b123456,0);
        bytes memory vectors=vm.readFileBinary("contracts/test/fixtures/dogecoin/digishield-vectors.bin");
        for(uint256 at;at<vectors.length;at+=8){int32 elapsed=int32(uint32(BridgeWire420.readLE(vectors,at,4)));uint32 expected=uint32(BridgeWire420.readLE(vectors,at+4,4));put(c,p,gp,144999,uint32(uint256(int256(1000000)+elapsed)),0x1b123456,0);require(c.expectedBits(p)==expected);}
    }
    function testMergedMiningLCGOverflowAgainstIndependentVectors() public view {
        bytes memory data=vm.readFileBinary("contracts/test/fixtures/dogecoin/index-vectors.bin");
        for(uint256 i;i<data.length;i+=9)require(DogecoinAuxPow420.expectedIndex(uint32(BridgeWire420.readLE(data,i,4)),uint8(data[i+4]))==BridgeWire420.readLE(data,i+5,4));
        // Published Core recurrence, including uint32 wrap and depth zero.
        require(DogecoinAuxPow420.expectedIndex(0,0)==0);
        require(DogecoinAuxPow420.expectedIndex(0,3)==0);
    }
}

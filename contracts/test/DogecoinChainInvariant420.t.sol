// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../src/bridge/verifiers/DogecoinHeaderChain420.sol";
interface DogecoinInvariantVm420 {
    function readFileBinary(string calldata) external view returns(bytes memory);
    function warp(uint256) external;
}
contract DogecoinHistoricalHandler420 {
    DogecoinHeaderChain420 public immutable chain;
    bytes private fixture;
    uint64 public admittedHeight;
    bytes32 public admittedTip;
    constructor(bytes memory firstHeaders){chain=new DogecoinHeaderChain420();fixture=firstHeaders;admittedTip=chain.GENESIS();LitecoinScrypt420 s=chain.scrypt();
        for(uint256 h=1;h<=16;++h){bytes memory raw=new bytes(80);for(uint256 i;i<80;++i)raw[i]=fixture[h*80+i];bytes32 id=s.begin(raw);for(uint256 j;j<64;++j)s.advance(id,32);}
    }
    function submit(uint8 choice) external {
        uint256 h=choice%2==0?admittedHeight+1:uint256(choice)%16+1;
        if(h>16)return;
        bytes memory raw=new bytes(80);
        for(uint256 i;i<80;++i)raw[i]=fixture[h*80+i];
        (bool ok,bytes memory result)=address(chain).call(abi.encodeCall(chain.submit,(raw,hex"")));
        if(ok && h>admittedHeight){admittedHeight=uint64(h);admittedTip=abi.decode(result,(bytes32));}
    }
}
contract DogecoinChainInvariant420Test {
    DogecoinHistoricalHandler420 private handler;
    function setUp() public {
        DogecoinInvariantVm420 vm=DogecoinInvariantVm420(address(uint160(uint256(keccak256("hevm cheat code")))));
        vm.warp(1_800_000_000);
        bytes memory data=vm.readFileBinary("contracts/test/fixtures/dogecoin/headers.bin");
        bytes memory prefix=new bytes(17*80);for(uint256 i;i<prefix.length;++i)prefix[i]=data[i];
        handler=new DogecoinHistoricalHandler420(prefix);
    }
    function targetContracts() public view returns(address[] memory targets){targets=new address[](1);targets[0]=address(handler);}
    function invariantBestTipTracksGreatestAdmittedWorkAndGenesisIsImmutable() public view {
        DogecoinHeaderChain420 c=handler.chain();bytes32 tip=c.bestTip();
        require(tip==handler.admittedTip());
        DogecoinHeaderChain420.Header memory h=c.getHeader(tip);
        require(h.height==handler.admittedHeight() && h.work==(uint256(h.height)+1)*1048592);
        require(c.getHeader(c.GENESIS()).work==1048592);
        bytes32 cursor=tip;
        for(uint256 i;i<h.height;++i)cursor=c.getHeader(cursor).parent;
        require(cursor==c.GENESIS());
    }
}

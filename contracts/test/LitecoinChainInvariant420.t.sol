// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../src/bridge/verifiers/LitecoinHeaderChain420.sol";
interface LitecoinInvariantVm420 {function readFileBinary(string calldata) external view returns(bytes memory);function warp(uint256) external;}
contract LitecoinHistoricalHandler420 {
    LitecoinHeaderChain420 public immutable chain;bytes private fixture;uint64 public admittedHeight;bytes32 public admittedTip;
    constructor(bytes memory data){chain=new LitecoinHeaderChain420();fixture=data;admittedTip=chain.GENESIS();LitecoinScrypt420 s=chain.scrypt();
        // Immutable genuine PoW cache is computed once, before stateful ancestry fuzzing.
        for(uint256 h=1;h<=16;++h){bytes memory raw=header(h);bytes32 id=s.begin(raw);for(uint256 j;j<64;++j)s.advance(id,32);}
    }
    function header(uint256 h) private view returns(bytes memory raw){raw=new bytes(80);for(uint256 i;i<80;++i)raw[i]=fixture[h*80+i];}
    function submit(uint8 choice) external {uint256 h=choice%2==0?admittedHeight+1:uint256(choice)%16+1;if(h>16)return;
        (bool ok,bytes memory result)=address(chain).call(abi.encodeCall(chain.submit,(header(h))));if(ok && h>admittedHeight){admittedHeight=uint64(h);admittedTip=abi.decode(result,(bytes32));}
    }
}
contract LitecoinChainInvariant420Test {
    LitecoinHistoricalHandler420 private handler;
    function setUp() public {LitecoinInvariantVm420 vm=LitecoinInvariantVm420(address(uint160(uint256(keccak256("hevm cheat code")))));vm.warp(1_800_000_000);bytes memory data=vm.readFileBinary("contracts/test/fixtures/litecoin/headers.bin");bytes memory first=new bytes(17*80);for(uint256 i;i<first.length;++i)first[i]=data[i];handler=new LitecoinHistoricalHandler420(first);}
    function targetContracts() public view returns(address[] memory targets){targets=new address[](1);targets[0]=address(handler);}
    function invariantOnlyContiguousGenuineGreatestWorkChainCanAdvance() public view {LitecoinHeaderChain420 c=handler.chain();bytes32 tip=c.bestTip();require(tip==handler.admittedTip());LitecoinHeaderChain420.Header memory h=c.getHeader(tip);require(h.height==handler.admittedHeight() && h.work==(uint256(h.height)+1)*1048592);require(c.getHeader(c.GENESIS()).work==1048592);bytes32 cursor=tip;for(uint256 i;i<h.height;++i)cursor=c.getHeader(cursor).parent;require(cursor==c.GENESIS());}
}

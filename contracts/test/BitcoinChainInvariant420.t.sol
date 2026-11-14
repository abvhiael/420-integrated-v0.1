// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../src/bridge/verifiers/BitcoinHeaderChain420.sol";
interface BitcoinInvariantVm420 {
    function readFileBinary(string calldata) external view returns(bytes memory);
    function warp(uint256) external;
}
contract BitcoinHistoricalHandler420 {
    BitcoinHeaderChain420 public immutable chain;
    bytes private fixture;
    uint64 public admittedHeight;
    bytes32 public admittedTip;
    constructor(bytes memory firstHeaders){chain=new BitcoinHeaderChain420();fixture=firstHeaders;admittedTip=chain.GENESIS();}
    function submit(uint8 choice) external {
        uint256 h=choice%2==0?admittedHeight+1:uint256(choice)%64+1;
        if(h>64)return;
        bytes memory raw=new bytes(80);
        for(uint256 i;i<80;++i)raw[i]=fixture[h*80+i];
        (bool ok,bytes memory result)=address(chain).call(abi.encodeCall(chain.submit,(raw)));
        if(ok && h>admittedHeight){admittedHeight=uint64(h);admittedTip=abi.decode(result,(bytes32));}
    }
}
contract BitcoinChainInvariant420Test {
    BitcoinHistoricalHandler420 private handler;
    function setUp() public {
        BitcoinInvariantVm420 vm=BitcoinInvariantVm420(address(uint160(uint256(keccak256("hevm cheat code")))));
        vm.warp(1_800_000_000);
        bytes memory data=vm.readFileBinary("contracts/test/fixtures/bitcoin/headers.bin");
        bytes memory prefix=new bytes(65*80);for(uint256 i;i<prefix.length;++i)prefix[i]=data[i];
        handler=new BitcoinHistoricalHandler420(prefix);
    }
    function targetContracts() public view returns(address[] memory targets){targets=new address[](1);targets[0]=address(handler);}
    function invariantBestTipTracksGreatestAdmittedWorkAndGenesisIsImmutable() public view {
        BitcoinHeaderChain420 c=handler.chain();bytes32 tip=c.bestTip();
        require(tip==handler.admittedTip());
        BitcoinHeaderChain420.Header memory h=c.getHeader(tip);
        require(h.height==handler.admittedHeight() && h.work==(uint256(h.height)+1)*4295032833);
        require(c.getHeader(c.GENESIS()).work==4295032833);
        bytes32 cursor=tip;
        for(uint256 i;i<h.height;++i)cursor=c.getHeader(cursor).parent;
        require(cursor==c.GENESIS());
    }
}

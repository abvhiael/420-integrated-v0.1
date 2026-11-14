// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../src/bridge/verifiers/LitecoinScrypt420.sol";
contract LitecoinScrypt420Test {
    function testGenuineGenesisScryptAndBoundedProgress() public {
        LitecoinScrypt420 s=new LitecoinScrypt420();
        bytes memory h=abi.encodePacked(hex"01000000",bytes32(0),hex"d9ced4ed1130f7b7faad9be25323ffafa33232a17c3edf6cfd97bee6bafbdd97",hex"b9aa8e4ef0ff0f1ecd513f7c");
        require(h.length==80);bytes32 id=s.begin(h);require(id==0xe2bf047e7e5a191aa4ef34d314979dc9986e0f19251edaba5940fd1fe365a712);
        (,bool done)=s.result(id);require(!done);uint256 maxGas;
        for(uint256 i;i<64;++i){uint256 before_=gasleft();s.advance(id,32);uint256 used=before_-gasleft();if(used>maxGas)maxGas=used;}
        (bytes32 digest,bool complete)=s.result(id);require(complete);require(digest==0x001e67b013726fd7382e9acb69165b4b6316227fb3156b5b414ba6340c050000);
        require(maxGas<30_000_000,"progress cannot fit normal block");require(s.begin(h)==id && s.cursor(id)==2048);
        (bool ok,)=address(s).call(abi.encodeCall(s.advance,(id,uint16(1))));require(!ok);
    }
}

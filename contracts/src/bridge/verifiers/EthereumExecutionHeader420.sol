// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./EthereumRLP420.sol";

library EthereumExecutionHeader420 {
    error InvalidExecutionHeader();
    struct Header {bytes32 blockHash; bytes32 parentHash; bytes32 stateRoot; bytes32 transactionsRoot; bytes32 receiptsRoot; uint64 number; uint64 timestamp;}
    function parse(bytes memory raw) internal pure returns(Header memory h){
        EthereumRLP420.validate(raw);
        EthereumRLP420.Item[] memory f=EthereumRLP420.children(raw,EthereumRLP420.item(raw,0));
        // Post-Merge headers: London, Shanghai, Cancun, Prague/Fulu.
        if(f.length!=15 && f.length!=16 && f.length!=17 && f.length!=20 && f.length!=21)revert InvalidExecutionHeader();
        for(uint256 i;i<f.length;++i)if(f[i].list)revert InvalidExecutionHeader();
        h.parentHash=EthereumRLP420.word(raw,f[0]);EthereumRLP420.word(raw,f[1]);EthereumRLP420.account(raw,f[2]);
        h.stateRoot=EthereumRLP420.word(raw,f[3]);h.transactionsRoot=EthereumRLP420.word(raw,f[4]);h.receiptsRoot=EthereumRLP420.word(raw,f[5]);
        EthereumRLP420.integer(raw,f[7]);
        if(f[6].length!=256 || f[12].length>32 || f[14].length!=8)revert InvalidExecutionHeader();
        uint256 number=EthereumRLP420.integer(raw,f[8]);uint256 timestamp=EthereumRLP420.integer(raw,f[11]);
        if(number==0 || number>type(uint64).max || timestamp>type(uint64).max)revert InvalidExecutionHeader();
        h.number=uint64(number);h.timestamp=uint64(timestamp);
        uint256 gasLimit=EthereumRLP420.integer(raw,f[9]);uint256 gasUsed=EthereumRLP420.integer(raw,f[10]);
        if(gasUsed>gasLimit)revert InvalidExecutionHeader();
        EthereumRLP420.word(raw,f[13]);if(f.length>=16)EthereumRLP420.integer(raw,f[15]);
        if(f.length>=17)EthereumRLP420.word(raw,f[16]);
        if(f.length>=20){EthereumRLP420.integer(raw,f[17]);EthereumRLP420.integer(raw,f[18]);EthereumRLP420.word(raw,f[19]);}
        if(f.length==21)EthereumRLP420.word(raw,f[20]);
        h.blockHash=keccak256(raw);
    }
}

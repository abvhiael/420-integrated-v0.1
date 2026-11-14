// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./EthereumRLP420.sol";

/// @notice Ethereum hexary trie membership for raw RLP keys (transaction/receipt indices).
/// Embedded children are consumed directly; only hashed nodes belong in the proof array.
library EthereumMPT420 {
    error InvalidTrieProof();
    function nibble(bytes memory key,uint256 at) private pure returns(uint8){return (at&1)==0?uint8(key[at/2])>>4:uint8(key[at/2])&15;}
    function verify(bytes32 root,bytes memory key,bytes memory value,bytes[] memory proof) internal pure {
        if(root==0 || value.length==0 || key.length==0 || key.length>32 || proof.length==0 || proof.length>64)revert InvalidTrieProof();
        uint256 used=1;uint256 pos;bytes memory node=proof[0];
        if(keccak256(node)!=root)revert InvalidTrieProof();
        for(uint256 hop;hop<128;++hop){
            EthereumRLP420.validate(node);
            EthereumRLP420.Item[] memory fields=EthereumRLP420.children(node,EthereumRLP420.item(node,0));
            EthereumRLP420.Item memory child;
            if(fields.length==17){
                if(pos==key.length*2){finish(node,fields[16],value,used,proof.length);return;}
                child=fields[nibble(key,pos++)];
            } else if(fields.length==2){
                bytes memory path=EthereumRLP420.data(node,fields[0]);
                if(path.length==0)revert InvalidTrieProof();
                uint8 flag=uint8(path[0])>>4;if(flag>3 || ((flag&1)==0 && (uint8(path[0])&15)!=0))revert InvalidTrieProof();
                uint256 start=(flag&1)==1?1:2;uint256 size=path.length*2-start;
                if(size>key.length*2-pos || ((flag&2)==0 && size==0))revert InvalidTrieProof();
                for(uint256 i;i<size;++i)if(nibble(path,start+i)!=nibble(key,pos+i))revert InvalidTrieProof();
                pos+=size;
                if((flag&2)!=0){if(pos!=key.length*2)revert InvalidTrieProof();finish(node,fields[1],value,used,proof.length);return;}
                child=fields[1];
            } else revert InvalidTrieProof();
            if(child.list){
                if(child.total>=32)revert InvalidTrieProof();node=EthereumRLP420.encoded(node,child);
            } else {
                bytes32 expected=EthereumRLP420.word(node,child);
                if(used>=proof.length)revert InvalidTrieProof();node=proof[used++];
                if(node.length<32 || keccak256(node)!=expected)revert InvalidTrieProof();
            }
        }
        revert InvalidTrieProof();
    }
    function finish(bytes memory node,EthereumRLP420.Item memory item,bytes memory value,uint256 used,uint256 count) private pure {
        if(used!=count || keccak256(EthereumRLP420.data(node,item))!=keccak256(value))revert InvalidTrieProof();
    }
}

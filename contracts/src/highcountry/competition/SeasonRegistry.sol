// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Immutable, monotonic season schedule. No token, wallet or prize authority.
contract SeasonRegistry {
    error Invalid();
    error Unauthorized();
    struct Season {uint64 starts; uint64 ends; address authority; bytes32 rulesHash; bool cancelled;}
    mapping(bytes32 => Season) public seasons;
    event SeasonCreated(bytes32 indexed id,address indexed authority,uint64 starts,uint64 ends,bytes32 rulesHash);
    event SeasonCancelled(bytes32 indexed id);
    function create(bytes32 id,uint64 starts,uint64 ends,bytes32 rulesHash) external {
        if(id==bytes32(0)||rulesHash==bytes32(0)||seasons[id].authority!=address(0)
          ||starts<=block.timestamp||ends<=starts) revert Invalid();
        seasons[id]=Season(starts,ends,msg.sender,rulesHash,false);
        emit SeasonCreated(id,msg.sender,starts,ends,rulesHash);
    }
    function cancel(bytes32 id) external {
        Season storage s=seasons[id];
        if(s.authority!=msg.sender||s.cancelled||block.timestamp>=s.starts) revert Unauthorized();
        s.cancelled=true;emit SeasonCancelled(id);
    }
    function live(bytes32 id) external view returns(bool){
        Season memory s=seasons[id];
        return s.authority!=address(0)&&!s.cancelled&&block.timestamp>=s.starts&&block.timestamp<s.ends;
    }
}

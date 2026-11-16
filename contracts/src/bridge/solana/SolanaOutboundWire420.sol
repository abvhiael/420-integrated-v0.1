// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../../interfaces/ISolanaOutboundMessage420.sol";
/// @notice Canonical public request encoding. Carries no finality, backing or signing authority.
library SolanaOutboundWire420 {
    error InvalidRequest();
    function encode(ISolanaOutboundMessage420.OutboundMessage memory r) internal pure returns(bytes memory) {
        if(r.sourceChainId==0 || r.sourceRouter==address(0) || r.sourceAdapter==address(0) || r.messageId==0 || r.routeId==0 || r.assetId==0 || r.sender==address(0) || r.localAmount==0 || r.solanaAmount==0 || r.solanaAsset==0 || r.nonce==0 || r.extra.length>type(uint32).max) revert InvalidRequest();
        bytes memory domain=abi.encodePacked(bytes8("420SREQ1"),bytes32(r.sourceChainId),r.sourceRouter,r.sourceAdapter,r.messageId);
        bytes memory parties=abi.encodePacked(r.routeId,r.assetId,r.sender,r.recipient);
        bytes memory amounts=abi.encodePacked(bytes32(r.localAmount),littleEndian(r.solanaAmount,8),r.solanaAsset,bytes32(r.nonce),littleEndian(r.extra.length,4),r.extra);
        return bytes.concat(domain,parties,amounts);
    }
    function littleEndian(uint256 value,uint256 width) private pure returns(bytes memory out) {
        out=new bytes(width);for(uint256 i;i<width;++i)out[i]=bytes1(uint8(value>>(8*i)));
    }
}

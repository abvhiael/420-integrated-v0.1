// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./SupportedTokenRoutes420.t.sol";
contract SolanaOutboundTokenMessage420Test is TokenRouteFixture420 {
 function testSolanaOutboundPayloadForEveryApprovedSPL() public {
  for(uint256 i=7;i<9;++i){SupportedTokenRoutes420.Profile memory p=configure(i);bytes32 id=router.outbound(sol,p.routeId,p.assetId,42 ether);ISolanaOutboundMessage420.OutboundMessage memory m=sol.outboundMessage(id);uint256 raw=42*(10**uint256(p.decimals));require(m.solanaAmount==raw&&m.localAmount==42 ether&&m.solanaAsset==p.sourceAsset&&m.routeId==p.routeId&&m.assetId==p.assetId);require(m.sourceChainId==block.chainid&&m.sourceRouter==address(router)&&m.sourceAdapter==address(sol)&&m.sender==address(this)&&m.recipient==0&&m.nonce==i-6);require(id==keccak256(abi.encode(sol.ADAPTER_ID(),block.chainid,p.routeId,p.assetId,address(this),new bytes(32),uint256(42 ether),raw,p.sourceAsset,i-6,bytes(""))),"qualified SPL digest changed");bytes memory wire=sol.outboundMessageData(id);require(wire.length==336);bytes32 mint;assembly("memory-safe"){mint:=mload(add(wire,300))}require(mint==p.sourceAsset,"mint truncated");}
 }
}

// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./SupportedTokenRoutes420.t.sol";
contract EthereumOutboundTokenMessage420Test is TokenRouteFixture420 {
 function testEthereumOutboundPayloadForEveryApprovedERC20() public {
  for(uint256 i;i<7;++i){SupportedTokenRoutes420.Profile memory p=configure(i);bytes32 id=router.outbound(eth,p.routeId,p.assetId,42 ether);IEthereumOutboundMessage420.OutboundMessage memory m=eth.outboundMessage(id);uint256 raw=42*(10**uint256(p.decimals));require(m.ethereumAmount==raw&&m.localAmount==42 ether&&m.ethereumAsset==p.sourceAsset&&m.routeId==p.routeId&&m.assetId==p.assetId);require(m.sender==address(this)&&m.recipient==address(0xB0B)&&m.sourceChainId==block.chainid&&m.sourceRouter==address(router)&&m.sourceAdapter==address(eth)&&m.nonce==i+1);require(id==keccak256(abi.encode(eth.ADAPTER_ID(),block.chainid,p.routeId,p.assetId,address(this),abi.encodePacked(address(0xB0B)),uint256(42 ether),raw,p.sourceAsset,i+1,bytes(""))),"qualified token digest changed");}
 }
}

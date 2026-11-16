// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../src/bridge/adapters/EthereumBridgeAdapter420.sol";
import "../src/interfaces/IEthereumSourceGatewaySettlement420.sol";
contract OutboundCodePresence420 {}
contract OutboundCaller420 {
 function send(EthereumBridgeAdapter420 a,bytes32 r,bytes32 asset,address sender,bytes memory recipient,uint256 amount,bytes memory extra) external returns(bytes32){return a.initiateOutbound(r,asset,sender,recipient,amount,extra);}
 function failAfter(EthereumBridgeAdapter420 a,bytes32 r,bytes32 asset,address sender,bytes memory recipient,uint256 amount,bytes memory extra) external {a.initiateOutbound(r,asset,sender,recipient,amount,extra);revert("downstream failure");}
}
abstract contract OutboundFixture420 {
 bytes32 constant ROUTE=keccak256("native route");bytes32 constant ASSET=keccak256("native ETH");
 EthereumBridgeAdapter420 adapter;OutboundCaller420 router;
 function setup() internal {router=new OutboundCaller420();adapter=new EthereumBridgeAdapter420(address(this),address(router),address(new OutboundCodePresence420()));adapter.setAssetMapping(adapter.ETH_NATIVE_SOURCE_ASSET(),ASSET,true);adapter.setRouteBinding(ASSET,ROUTE);}
 function send(uint256 amount,address recipient,bytes memory extra) internal returns(bytes32){return router.send(adapter,ROUTE,ASSET,address(this),abi.encodePacked(recipient),amount,extra);}
}
contract EthereumOutboundMessage420Test is OutboundFixture420 {
 function setUp() public {setup();}
 function testPublicPayloadBindsEveryOutboundFieldAndPreservesLegacyDigest() public {bytes memory extra=hex"012345";bytes32 id=send(42 ether,address(0xBEEF),extra);IEthereumOutboundMessage420.OutboundMessage memory m=adapter.outboundMessage(id);require(m.sourceChainId==block.chainid&&m.sourceRouter==address(router)&&m.sourceAdapter==address(adapter));require(m.messageId==id&&m.routeId==ROUTE&&m.assetId==ASSET&&m.sender==address(this)&&m.recipient==address(0xBEEF));require(m.localAmount==42 ether&&m.ethereumAmount==42 ether&&m.ethereumAsset==adapter.ETH_NATIVE_SOURCE_ASSET()&&m.nonce==1&&keccak256(m.extra)==keccak256(extra));require(id==keccak256(abi.encode(adapter.ADAPTER_ID(),block.chainid,ROUTE,ASSET,address(this),abi.encodePacked(address(0xBEEF)),42 ether,adapter.ETH_NATIVE_SOURCE_ASSET(),uint256(1),extra)));}
 function testZeroRecipientRejectsWithoutConsumingNonce() public {(bool ok,)=address(router).call(abi.encodeCall(router.send,(adapter,ROUTE,ASSET,address(this),new bytes(20),1,bytes(""))));require(!ok&&adapter.outboundNonce()==0);}
 function testUnknownPayloadFailsClosed() public {(bool ok,)=address(adapter).staticcall(abi.encodeCall(adapter.outboundMessage,(keccak256("unknown"))));require(!ok);}
 function testCallerCannotForgeOutboundRecord() public {(bool ok,)=address(adapter).call(abi.encodeCall(adapter.initiateOutbound,(ROUTE,ASSET,address(this),abi.encodePacked(address(1)),1,bytes(""))));require(!ok&&adapter.outboundNonce()==0);}
 function testPayloadIsStableAcrossLaterRequests() public {bytes32 first=send(5,address(1),hex"01");bytes32 hash=keccak256(abi.encode(adapter.outboundMessage(first)));bytes32 second=send(5,address(1),hex"01");require(first!=second&&adapter.outboundNonce()==2&&keccak256(abi.encode(adapter.outboundMessage(first)))==hash);}
 function testDownstreamRollbackRemovesNonceAndPayload() public {bytes32 expected=keccak256(abi.encode(adapter.ADAPTER_ID(),block.chainid,ROUTE,ASSET,address(this),abi.encodePacked(address(1)),uint256(5),adapter.ETH_NATIVE_SOURCE_ASSET(),uint256(1),hex"01"));(bool ok,)=address(router).call(abi.encodeCall(router.failAfter,(adapter,ROUTE,ASSET,address(this),abi.encodePacked(address(1)),5,hex"01")));require(!ok&&adapter.outboundNonce()==0);(ok,)=address(adapter).staticcall(abi.encodeCall(adapter.outboundMessage,(expected)));require(!ok);require(send(5,address(1),hex"01")==expected);}
 function testFuzzNativePayloadAmountAndRecipient(uint96 amount,address recipient) public {if(recipient==address(0))recipient=address(1);uint256 value=uint256(amount)+1;bytes32 id=send(value,recipient,abi.encode(amount));IEthereumOutboundMessage420.OutboundMessage memory m=adapter.outboundMessage(id);require(m.localAmount==value&&m.ethereumAmount==value&&m.recipient==recipient);}
}
contract OutboundStateHandler420 is OutboundFixture420 {
 uint256 public count;bytes32 public last;
 constructor(){setup();}
 function request(uint96 amount,address recipient) external {if(recipient==address(0))recipient=address(1);last=send(uint256(amount)+1,recipient,bytes(""));++count;}
 function rejectZero() external {(bool ok,)=address(router).call(abi.encodeCall(router.send,(adapter,ROUTE,ASSET,address(this),new bytes(20),1,bytes(""))));require(!ok);}
 function rollback() external {(bool ok,)=address(router).call(abi.encodeCall(router.failAfter,(adapter,ROUTE,ASSET,address(this),abi.encodePacked(address(1)),1,bytes(""))));require(!ok);}
 function check() external view {require(adapter.outboundNonce()==count);if(count!=0){IEthereumOutboundMessage420.OutboundMessage memory m=adapter.outboundMessage(last);require(m.nonce==count&&m.messageId==last&&m.sourceRouter==address(router)&&m.sourceAdapter==address(adapter)&&m.localAmount==m.ethereumAmount);}}
}
contract EthereumOutboundMessageInvariant420Test {
 OutboundStateHandler420 handler;struct FuzzSelector{address addr;bytes4[] selectors;}
 function setUp() public {handler=new OutboundStateHandler420();}
 function targetContracts() public view returns(address[] memory a){a=new address[](1);a[0]=address(handler);}
 function targetSelectors() public view returns(FuzzSelector[] memory a){bytes4[] memory s=new bytes4[](3);s[0]=handler.request.selector;s[1]=handler.rejectZero.selector;s[2]=handler.rollback.selector;a=new FuzzSelector[](1);a[0]=FuzzSelector(address(handler),s);}
 function invariantOnlySuccessfulRequestsPersistNonceAndTypedPayload() public view {handler.check();}
}

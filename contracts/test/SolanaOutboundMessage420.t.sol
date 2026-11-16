// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../src/bridge/adapters/SolanaBridgeAdapter420.sol";
interface SolOutboundVm420 {function readFile(string calldata) external view returns(string memory);function parseBytes(string calldata) external pure returns(bytes memory);}
contract SolOutboundPresence420 {}
contract SolOutboundCaller420 {
 function send(SolanaBridgeAdapter420 a,bytes32 r,bytes32 asset,address sender,bytes memory recipient,uint256 amount,bytes memory extra) external returns(bytes32){return a.initiateOutbound(r,asset,sender,recipient,amount,extra);}
 function failAfter(SolanaBridgeAdapter420 a,bytes32 r,bytes32 asset,address sender,bytes memory recipient,uint256 amount,bytes memory extra) external {a.initiateOutbound(r,asset,sender,recipient,amount,extra);revert("downstream failure");}
}
abstract contract SolOutboundFixture420 {
 bytes32 constant ROUTE=keccak256("native SOL route");bytes32 constant ASSET=keccak256("native SOL asset");
 SolanaBridgeAdapter420 adapter;SolOutboundCaller420 router;
 function setup() internal {router=new SolOutboundCaller420();adapter=new SolanaBridgeAdapter420(address(this),address(router),address(new SolOutboundPresence420()));adapter.setAssetMapping(adapter.SOL_NATIVE_SOURCE_ASSET(),ASSET,true);adapter.setRouteBinding(ASSET,ROUTE);}
 function send(uint256 amount,bytes32 recipient,bytes memory extra) internal returns(bytes32){return router.send(adapter,ROUTE,ASSET,address(this),abi.encodePacked(recipient),amount,extra);}
}
contract SolanaOutboundMessage420Test is SolOutboundFixture420 {
 function setUp() public {setup();}
 function testTypedMessageAndLegacyDigestBindFullPubkey() public {bytes32 recipient=bytes32((uint256(1)<<255)|1);bytes32 id=send(42e9,recipient,hex"0123");ISolanaOutboundMessage420.OutboundMessage memory m=adapter.outboundMessage(id);require(m.sourceChainId==block.chainid&&m.sourceRouter==address(router)&&m.sourceAdapter==address(adapter)&&m.messageId==id);require(m.routeId==ROUTE&&m.assetId==ASSET&&m.sender==address(this)&&m.recipient==recipient&&m.localAmount==42e9&&m.solanaAmount==42e9&&m.solanaAsset==adapter.SOL_NATIVE_SOURCE_ASSET()&&m.nonce==1&&keccak256(m.extra)==keccak256(hex"0123"));require(id==keccak256(abi.encode(adapter.ADAPTER_ID(),block.chainid,ROUTE,ASSET,address(this),abi.encodePacked(recipient),uint256(42e9),adapter.SOL_NATIVE_SOURCE_ASSET(),uint256(1),hex"0123")));bytes memory wire=adapter.outboundMessageData(id);require(wire.length==338);bytes32 key;assembly("memory-safe"){key:=mload(add(wire,228))}require(key==recipient,"pubkey truncated");}
 function testNativeAmountAboveU64RejectsBeforeNonce() public {(bool ok,)=address(router).call(abi.encodeCall(router.send,(adapter,ROUTE,ASSET,address(this),new bytes(32),uint256(type(uint64).max)+1,bytes(""))));require(!ok&&adapter.outboundNonce()==0);}
 function testExactU64MaximumRoundTrips() public {bytes32 id=send(type(uint64).max,bytes32(uint256(1)),bytes(""));require(adapter.outboundMessage(id).solanaAmount==type(uint64).max);}
 function testMalformedRecipientLengthsReject() public {for(uint256 n;n<65;++n){if(n==32)continue;(bool ok,)=address(router).call(abi.encodeCall(router.send,(adapter,ROUTE,ASSET,address(this),new bytes(n),1,bytes(""))));require(!ok&&adapter.outboundNonce()==0);}}
 function testUnknownRequestsAndUnauthorizedCallerReject() public {(bool ok,)=address(adapter).staticcall(abi.encodeCall(adapter.outboundMessage,(bytes32(uint256(1)))));require(!ok);(ok,)=address(adapter).staticcall(abi.encodeCall(adapter.outboundMessageData,(bytes32(uint256(1)))));require(!ok);(ok,)=address(adapter).call(abi.encodeCall(adapter.initiateOutbound,(ROUTE,ASSET,address(this),new bytes(32),1,bytes(""))));require(!ok&&adapter.outboundNonce()==0);}
 function testDownstreamRollbackRemovesMessageAndNonce() public {bytes32 expected=keccak256(abi.encode(adapter.ADAPTER_ID(),block.chainid,ROUTE,ASSET,address(this),new bytes(32),uint256(1),adapter.SOL_NATIVE_SOURCE_ASSET(),uint256(1),bytes("")));(bool ok,)=address(router).call(abi.encodeCall(router.failAfter,(adapter,ROUTE,ASSET,address(this),new bytes(32),1,bytes(""))));require(!ok&&adapter.outboundNonce()==0);(ok,)=address(adapter).staticcall(abi.encodeCall(adapter.outboundMessage,(expected)));require(!ok);require(send(1,bytes32(0),bytes(""))==expected);}
 function testOldPayloadSurvivesFurtherMessages() public {bytes32 first=send(1,bytes32(uint256(1)),hex"01");bytes32 digest=keccak256(adapter.outboundMessageData(first));bytes32 second=send(1,bytes32(uint256(1)),hex"01");require(first!=second&&adapter.outboundNonce()==2&&keccak256(adapter.outboundMessageData(first))==digest);}
 function testFuzzPubkeyAndLamportsAreNotTruncated(uint64 amount,bytes32 recipient) public {uint256 n=amount==0?1:amount;bytes32 id=send(n,recipient,abi.encode(recipient));ISolanaOutboundMessage420.OutboundMessage memory m=adapter.outboundMessage(id);require(m.solanaAmount==n&&m.recipient==recipient&&m.localAmount==n);}
 function testIndependentPythonGoldenWire() public view {ISolanaOutboundMessage420.OutboundMessage memory m;m.sourceChainId=420;m.sourceRouter=address(0x1111111111111111111111111111111111111111);m.sourceAdapter=address(0x2222222222222222222222222222222222222222);m.messageId=bytes32(uint256(0x3333333333333333333333333333333333333333333333333333333333333333));m.routeId=bytes32(uint256(0x4444444444444444444444444444444444444444444444444444444444444444));m.assetId=bytes32(uint256(0x5555555555555555555555555555555555555555555555555555555555555555));m.sender=address(0x6666666666666666666666666666666666666666);m.recipient=bytes32((uint256(1)<<255)|1);m.localAmount=42 ether;m.solanaAmount=42e6;m.solanaAsset=bytes32(uint256(0x7777777777777777777777777777777777777777777777777777777777777777));m.nonce=(uint256(1)<<128)+1;m.extra=hex"deadbeef";SolOutboundVm420 vm=SolOutboundVm420(address(uint160(uint256(keccak256("hevm cheat code")))));bytes memory expected=vm.parseBytes(vm.readFile("contracts/test/fixtures/solana/outbound-request-v1/golden.hex"));require(keccak256(SolanaOutboundWire420.encode(m))==keccak256(expected),"independent wire mismatch");}
}
contract SolOutboundHandler420 is SolOutboundFixture420 {
 uint256 public count;bytes32 public last;
 constructor(){setup();}
 function request(uint64 amount,bytes32 recipient) external {last=send(amount==0?1:amount,recipient,bytes(""));++count;}
 function rollback() external {(bool ok,)=address(router).call(abi.encodeCall(router.failAfter,(adapter,ROUTE,ASSET,address(this),new bytes(32),1,bytes(""))));require(!ok);}
 function oversized() external {(bool ok,)=address(router).call(abi.encodeCall(router.send,(adapter,ROUTE,ASSET,address(this),new bytes(32),uint256(type(uint64).max)+1,bytes(""))));require(!ok);}
 function check() external view {require(adapter.outboundNonce()==count);if(count!=0){ISolanaOutboundMessage420.OutboundMessage memory m=adapter.outboundMessage(last);require(m.nonce==count&&m.messageId==last&&m.solanaAmount==m.localAmount&&adapter.outboundMessageData(last).length==336);}}
}
contract SolanaOutboundMessageInvariant420Test {
 SolOutboundHandler420 handler;struct FuzzSelector{address addr;bytes4[] selectors;}
 function setUp() public {handler=new SolOutboundHandler420();}
 function targetContracts() public view returns(address[] memory a){a=new address[](1);a[0]=address(handler);}
 function targetSelectors() public view returns(FuzzSelector[] memory a){bytes4[] memory s=new bytes4[](3);s[0]=handler.request.selector;s[1]=handler.rollback.selector;s[2]=handler.oversized.selector;a=new FuzzSelector[](1);a[0]=FuzzSelector(address(handler),s);}
 function invariantOnlySuccessfulRequestsPersistSolanaPayloadAndNonce() public view {handler.check();}
}

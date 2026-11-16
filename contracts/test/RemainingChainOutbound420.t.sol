// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../src/bridge/adapters/BnbBridgeAdapter420.sol";
import "../src/bridge/adapters/DogecoinBridgeAdapter420.sol";
import "../src/bridge/adapters/LitecoinBridgeAdapter420.sol";
import "../src/bridge/adapters/XrplBridgeAdapter420.sol";
import "../src/bridge/adapters/TronBridgeAdapter420.sol";
import "../src/bridge/adapters/PotcoinBridgeAdapter420.sol";
import "../src/bridge/adapters/DobbscoinBridgeAdapter420.sol";
import "../src/bridge/adapters/CurecoinBridgeAdapter420.sol";
import "../src/bridge/adapters/PirateChainBridgeAdapter420.sol";

interface RemainingVm420 {function prank(address) external;}
/// Outbound boundary only. This stub cannot authenticate any source evidence.
contract RemainingVerifierBoundary420 {function ping() external pure returns(bool){return true;}}
contract RemainingRouter420 {
 function send(address a,bytes32 route,bytes32 asset,bytes calldata recipient,uint256 amount,bytes calldata extra) external returns(bytes32){return IBridgeAdapter420(a).initiateOutbound(route,asset,address(0xA11CE),recipient,amount,extra);}
}
contract RemainingChainOutbound420Test {
 RemainingVm420 constant vm=RemainingVm420(address(uint160(uint256(keccak256("hevm cheat code")))));
 RemainingRouter420 router;address verifier;address[9] adapters;bytes32[9] routes;bytes32[9] assets;
 function setUp() public {
  router=new RemainingRouter420();verifier=address(new RemainingVerifierBoundary420());
  assets[0]=keccak256("420/BRIDGE/ASSET/BNB");routes[0]=keccak256("420/BRIDGE/ROUTE/BNB/MAINNET");
  BnbBridgeAdapter420 a0=new BnbBridgeAdapter420(address(this),address(router),verifier);adapters[0]=address(a0);
  a0.setAssetMapping(a0.BNB_NATIVE_SOURCE_ASSET(),assets[0],true);a0.setRouteBinding(assets[0],routes[0]);
  assets[1]=keccak256("420/BRIDGE/ASSET/DOGE");routes[1]=keccak256("420/BRIDGE/ROUTE/DOGE/MAINNET");
  DogecoinBridgeAdapter420 a1=new DogecoinBridgeAdapter420(address(this),address(router),verifier);adapters[1]=address(a1);
  a1.setDogeBinding(assets[1],routes[1]);
  assets[2]=keccak256("420/BRIDGE/ASSET/LTC");routes[2]=keccak256("420/BRIDGE/ROUTE/LTC/MAINNET");
  LitecoinBridgeAdapter420 a2=new LitecoinBridgeAdapter420(address(this),address(router),verifier);adapters[2]=address(a2);
  a2.setLtcBinding(assets[2],routes[2]);
  assets[3]=keccak256("420/BRIDGE/ASSET/XRP");routes[3]=keccak256("420/BRIDGE/ROUTE/XRP/MAINNET");
  XrplBridgeAdapter420 a3=new XrplBridgeAdapter420(address(this),address(router),verifier);adapters[3]=address(a3);
  a3.setXrpBinding(assets[3],routes[3]);
  assets[4]=keccak256("420/BRIDGE/ASSET/TRX");routes[4]=keccak256("420/BRIDGE/ROUTE/TRX/MAINNET");
  TronBridgeAdapter420 a4=new TronBridgeAdapter420(address(this),address(router),verifier);adapters[4]=address(a4);
  a4.setTrxBinding(assets[4],routes[4]);
  assets[5]=keccak256("420/BRIDGE/ASSET/POT");routes[5]=keccak256("420/BRIDGE/ROUTE/POT/MAINNET");
  PotcoinBridgeAdapter420 a5=new PotcoinBridgeAdapter420(address(this),address(router),verifier);adapters[5]=address(a5);
  a5.setPotBinding(assets[5],routes[5]);
  assets[6]=keccak256("420/BRIDGE/ASSET/BOB");routes[6]=keccak256("420/BRIDGE/ROUTE/BOB/MAINNET");
  DobbscoinBridgeAdapter420 a6=new DobbscoinBridgeAdapter420(address(this),address(router),verifier);adapters[6]=address(a6);
  a6.setBobBinding(assets[6],routes[6]);
  assets[7]=keccak256("420/BRIDGE/ASSET/CURE");routes[7]=keccak256("420/BRIDGE/ROUTE/CURE/MAINNET");
  CurecoinBridgeAdapter420 a7=new CurecoinBridgeAdapter420(address(this),address(router),verifier);adapters[7]=address(a7);
  a7.setCureBinding(assets[7],routes[7]);
  assets[8]=keccak256("420/BRIDGE/ASSET/ARRR");routes[8]=keccak256("420/BRIDGE/ROUTE/ARRR/MAINNET");
  PirateChainBridgeAdapter420 a8=new PirateChainBridgeAdapter420(address(this),address(router),verifier);adapters[8]=address(a8);
  a8.setArrrBinding(assets[8],routes[8]);
 }
 function nonce(uint256 i) internal view returns(uint256 n){(bool ok,bytes memory value)=adapters[i].staticcall(abi.encodeWithSignature("outboundNonce()"));require(ok);return abi.decode(value,(uint256));}
 function request(uint256 i,bytes memory recipient,uint256 amount,bytes memory extra) internal returns(bytes32){return router.send(adapters[i],routes[i],assets[i],recipient,amount,extra);}
 function expected(uint256 i,bytes memory recipient,uint256 amount,uint8 kind,uint256 n) internal view returns(bytes32){
  bytes32 id=IBridgeAdapter420(adapters[i]).adapterId();
  if(i==0)return keccak256(abi.encode(id,block.chainid,routes[i],assets[i],address(0xA11CE),recipient,amount,BnbBridgeAdapter420(adapters[0]).BNB_NATIVE_SOURCE_ASSET(),n,bytes("")));
  if(i==4)return keccak256(abi.encode(id,block.chainid,routes[i],assets[i],address(0xA11CE),recipient,amount,n));
  if(i==5||i==7){uint8 version=i==5?(kind==0?55:110):(kind==0?25:30);return keccak256(abi.encode(id,block.chainid,routes[i],assets[i],address(0xA11CE),recipient,amount,kind,version,n));}
  return keccak256(abi.encode(id,block.chainid,routes[i],assets[i],address(0xA11CE),recipient,amount,kind,n));
 }
 function testRemainingBnbWeiAndCanonicalMessageIdentity() public {bytes memory to=abi.encodePacked(address(0xB0B));require(request(0,to,42e18,"")==expected(0,to,42e18,0,1));require(request(0,to,42e18,"")==expected(0,to,42e18,0,2));}
 function testRemainingTronSunAndPrefix() public {bytes memory to=abi.encodePacked(uint8(0x41),bytes20(uint160(0xB0B)));require(request(4,to,42e6,"")==expected(4,to,42e6,0,1));to[0]=0xa0;(bool ok,)=address(router).call(abi.encodeCall(router.send,(adapters[4],routes[4],assets[4],to,42e6,bytes(""))));require(!ok&&nonce(4)==1,"wrong Tron prefix");}
 function testRemainingXrpDropsAndTagEndian() public {
  for(uint8 tag;tag<2;++tag){uint32 value=tag==0?0:0x01020304;bytes20 account=bytes20(uint160(0xB0B));bytes memory to=abi.encodePacked(account,tag,value);bytes32 body=keccak256(abi.encode(routes[3],assets[3],address(0xA11CE),account,tag,value,uint256(42e6),bytes("")));bytes32 id=keccak256(abi.encode(IBridgeAdapter420(adapters[3]).adapterId(),block.chainid,uint256(tag)+1,body));require(request(3,to,42e6,"")==id,"XRP tag/amount binding");}
 }
 function twoScripts(uint256 i) internal {bytes memory to=abi.encodePacked(bytes20(uint160(0xB0B)));for(uint8 kind;kind<2;++kind)require(request(i,to,42e8,abi.encodePacked(kind))==expected(i,to,42e8,kind,uint256(kind)+1),"script/version/units binding");}
 function testRemainingDogeScriptsAndBaseUnits() public {twoScripts(1);}
 function testRemainingPotScriptsAndVersions() public {twoScripts(5);}
 function testRemainingBobScriptsAndBaseUnits() public {twoScripts(6);}
 function testRemainingCureScriptsAndVersions() public {twoScripts(7);}
 function testRemainingLitecoinFiveScriptEncodings() public {for(uint8 kind;kind<5;++kind){bytes memory to=kind<3?abi.encodePacked(bytes20(uint160(0xB0B))):abi.encodePacked(bytes32(uint256(0xB0B)));require(request(2,to,42e8,abi.encodePacked(kind))==expected(2,to,42e8,kind,uint256(kind)+1));}}
 function testRemainingPirateShieldedPoolsAndBaseUnits() public {
  bytes memory sapling=bytes("zs1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqpq6d8g");
  bytes memory ironwood=bytes("pirate1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq09ld92");
  require(request(8,sapling,42e8,hex"00")==expected(8,sapling,42e8,0,1));require(request(8,ironwood,42e8,hex"01")==expected(8,ironwood,42e8,1,2));
 }
 function testRemainingRouterBypassAndUnauthorizedVerifierRotation() public {
  for(uint256 i;i<9;++i){(bool ok,)=adapters[i].call(abi.encodeCall(IBridgeAdapter420.verifyInbound,(hex"01")));require(!ok,"direct inbound bypass");
   (ok,)=adapters[i].call(abi.encodeCall(IBridgeAdapter420.initiateOutbound,(routes[i],assets[i],address(this),new bytes(20),1,hex"00")));require(!ok,"direct outbound bypass");
   address replacement=address(new RemainingVerifierBoundary420());vm.prank(address(0xBAD));(ok,)=adapters[i].call(abi.encodeWithSignature("setVerifier(address)",replacement));require(!ok,"unauthorized rotation");require(nonce(i)==0,"unauthorized nonce change");}
 }
 function testRemainingWrongRouteAssetAndMalformedRecipient() public {
  for(uint256 i;i<9;++i){bytes memory to=i==3?abi.encodePacked(bytes20(uint160(0xB0B)),uint8(0),uint32(0)):i==4?abi.encodePacked(uint8(0x41),bytes20(uint160(0xB0B))):i==8?bytes("zs1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqpq6d8g"):abi.encodePacked(bytes20(uint160(0xB0B)));bytes memory extra=(i==0||i==3||i==4)?bytes(""):abi.encodePacked(uint8(0));
   (bool ok,)=address(router).call(abi.encodeCall(router.send,(adapters[i],bytes32(uint256(1)),assets[i],to,1,extra)));require(!ok,"wrong route");
   (ok,)=address(router).call(abi.encodeCall(router.send,(adapters[i],routes[i],bytes32(uint256(1)),to,1,extra)));require(!ok,"wrong asset");
   (ok,)=address(router).call(abi.encodeCall(router.send,(adapters[i],routes[i],assets[i],bytes(""),1,extra)));require(!ok&&nonce(i)==0,"malformed recipient/nonce");}
 }
}

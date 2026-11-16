// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./BridgeGenesisIntegration420.t.sol";
import "../src/bridge/adapters/EthereumBridgeAdapter420.sol";
import "../src/bridge/adapters/BnbBridgeAdapter420.sol";
import "../src/bridge/adapters/SolanaBridgeAdapter420.sol";
import "../src/bridge/adapters/TronBridgeAdapter420.sol";
import "../src/bridge/adapters/XrplBridgeAdapter420.sol";
import "../src/bridge/adapters/BitcoinBridgeAdapter420.sol";
import "../src/bridge/adapters/LitecoinBridgeAdapter420.sol";
import "../src/bridge/adapters/DogecoinBridgeAdapter420.sol";
import "../src/bridge/adapters/PotcoinBridgeAdapter420.sol";
import "../src/bridge/adapters/CurecoinBridgeAdapter420.sol";
import "../src/bridge/adapters/DobbscoinBridgeAdapter420.sol";
import "../src/bridge/adapters/PirateChainBridgeAdapter420.sol";
import "../src/bridge/adapters/USDCCCTPAdapter.sol";
import "../src/bridge/adapters/CADCLayerZeroAdapter.sol";
contract V22CodePresenceOnly {uint8 public constant decimals=6;}
contract BridgeFinalAdmission420Test is BridgeGenesisFixture420 {
 function testEveryUnqualifiedConcreteAdapterAndRouteFailClosed() public {
  Fixture memory f=_setup();address presence=address(new V22CodePresenceOnly());address router=address(f.router);address[14] memory list;
  list[0]=address(new EthereumBridgeAdapter420(address(this),router,presence));list[1]=address(new BnbBridgeAdapter420(address(this),router,presence));list[2]=address(new SolanaBridgeAdapter420(address(this),router,presence));list[3]=address(new TronBridgeAdapter420(address(this),router,presence));list[4]=address(new XrplBridgeAdapter420(address(this),router,presence));list[5]=address(new BitcoinBridgeAdapter420(address(this),router,presence));list[6]=address(new LitecoinBridgeAdapter420(address(this),router,presence));list[7]=address(new DogecoinBridgeAdapter420(address(this),router,presence));list[8]=address(new PotcoinBridgeAdapter420(address(this),router,presence));list[9]=address(new CurecoinBridgeAdapter420(address(this),router,presence));list[10]=address(new DobbscoinBridgeAdapter420(address(this),router,presence));list[11]=address(new PirateChainBridgeAdapter420(address(this),router,presence));list[12]=address(new USDCCCTPAdapter(address(this),router,presence,ASSET_ID));list[13]=address(new CADCLayerZeroAdapter(address(this),router,presence,ASSET_ID));
  bytes32 expected=keccak256(abi.encodeWithSignature("Error(string)","unqualified verifier"));
  for(uint256 i;i<list.length;++i){bytes32 id=IBridgeAdapter420(list[i]).adapterId();f.router.setAdapter(id,list[i]);(bool ok,bytes memory reason)=router.call(abi.encodeCall(f.router.acceptInbound,(id,bytes('{"finalized":true}'))));require(!ok&&keccak256(reason)==expected,"unqualified adapter reached proof execution");
   BridgeRouteRegistry.Route memory r=BridgeRouteRegistry.Route(ASSET_ID,1,uint64(block.chainid),ASSET_ID,ASSET_ID,id,keccak256("not qualified"),uint32(i+2),BridgeRouteRegistry.Status.ACTIVE,true,true);
   (ok,reason)=address(f.routes).call(abi.encodeCall(f.routes.setRoute,(keccak256(abi.encode(i)),r)));require(!ok&&keccak256(reason)==expected,"unqualified route activated");
  }
  (,,,,,,uint256 tvl)=f.risk.routeUsage(ROUTE_ID);require(tvl==0,"unsupported proof changed accounting");
 }
}

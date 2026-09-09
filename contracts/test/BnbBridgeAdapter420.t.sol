// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bridge/adapters/BnbBridgeAdapter420.sol";
import "../src/interfaces/IBnbFinalityVerifier420.sol";

contract BnbFinalityVerifierMock420 is IBnbFinalityVerifier420 {
    FinalizedTransfer private nextTransfer;
    function set(FinalizedTransfer calldata transfer_) external { nextTransfer = transfer_; }
    function verifyFinalizedTransfer(bytes calldata) external view returns (FinalizedTransfer memory) { return nextTransfer; }
}

contract BnbRouterCaller420 {
    function inbound(BnbBridgeAdapter420 adapter, bytes calldata proof) external returns (IBridgeAdapter420.VerifiedTransfer memory) { return adapter.verifyInbound(proof); }
    function outbound(BnbBridgeAdapter420 adapter, bytes32 routeId, bytes32 assetId, address sender, bytes calldata recipient, uint256 amount, bytes calldata extra) external returns (bytes32) {
        return adapter.initiateOutbound(routeId, assetId, sender, recipient, amount, extra);
    }
}

contract BnbBridgeAdapter420Test {
    bytes32 private constant ROUTE = keccak256("420/BRIDGE/ROUTE/BNB/MAINNET");
    bytes32 private constant BNB_ASSET = keccak256("420/BRIDGE/ASSET/BNB");
    bytes32 private constant BEP20_ASSET = keccak256("420/BRIDGE/ASSET/BEP20/TEST");
    address private constant GATEWAY = address(0x420420);
    address private constant TOKEN = address(0xBEEF20);
    BnbFinalityVerifierMock420 private verifier;
    BnbRouterCaller420 private router;
    BnbBridgeAdapter420 private adapter;

    constructor() {
        verifier = new BnbFinalityVerifierMock420(); router = new BnbRouterCaller420();
        adapter = new BnbBridgeAdapter420(address(this), address(router), address(verifier));
        adapter.setGateway(GATEWAY, true); adapter.setAssetMapping(adapter.BNB_NATIVE_SOURCE_ASSET(), BNB_ASSET, true); adapter.setRouteBinding(BNB_ASSET, ROUTE);
        _setHealthy(address(0), keccak256("bnb-message-1"));
    }
    function testCanonicalMainnetBnbInboundPasses() public { IBridgeAdapter420.VerifiedTransfer memory v=router.inbound(adapter,hex"01"); require(v.routeId==ROUTE,"route"); require(v.assetId==BNB_ASSET,"asset"); require(v.sender==address(0xA11CE),"sender"); require(v.recipient==address(0xB0B),"recipient"); require(v.amount==42 ether,"amount"); }
    function testWrongChainFailsClosed() public { IBnbFinalityVerifier420.FinalizedTransfer memory p=_healthy(address(0),keccak256("wrong-chain")); p.sourceChainId=97; verifier.set(p); (bool ok,)=address(router).call(abi.encodeCall(router.inbound,(adapter,hex"01"))); require(!ok,"wrong chain accepted"); }
    function testUnfinalizedFailsClosed() public { IBnbFinalityVerifier420.FinalizedTransfer memory p=_healthy(address(0),keccak256("unfinalized")); p.finalized=false; verifier.set(p); (bool ok,)=address(router).call(abi.encodeCall(router.inbound,(adapter,hex"01"))); require(!ok,"unfinalized accepted"); }
    function testWrongGatewayFailsClosed() public { IBnbFinalityVerifier420.FinalizedTransfer memory p=_healthy(address(0),keccak256("wrong-gateway")); p.gateway=address(0xBAD); verifier.set(p); (bool ok,)=address(router).call(abi.encodeCall(router.inbound,(adapter,hex"01"))); require(!ok,"gateway accepted"); }
    function testUnknownBep20FailsClosed() public { _setHealthy(TOKEN,keccak256("unknown-token")); (bool ok,)=address(router).call(abi.encodeCall(router.inbound,(adapter,hex"01"))); require(!ok,"unknown token accepted"); }
    function testQualifiedBep20BindsToIntendedRoute() public { bytes32 key=adapter.sourceAssetKey(TOKEN); adapter.setAssetMapping(key,BEP20_ASSET,true); adapter.setRouteBinding(BEP20_ASSET,ROUTE); _setHealthy(TOKEN,keccak256("qualified-token")); IBridgeAdapter420.VerifiedTransfer memory v=router.inbound(adapter,hex"01"); require(v.assetId==BEP20_ASSET,"wrong asset"); require(v.routeId==ROUTE,"wrong route"); }
    function testReplayFailsClosed() public { _setHealthy(address(0),keccak256("replay")); router.inbound(adapter,hex"01"); (bool ok,)=address(router).call(abi.encodeCall(router.inbound,(adapter,hex"01"))); require(!ok,"replay accepted"); }
    function testDirectInboundBypassFailsClosed() public { (bool ok,)=address(adapter).call(abi.encodeCall(adapter.verifyInbound,(hex"01"))); require(!ok,"direct inbound accepted"); }
    function testOutboundWrongRouteFailsClosed() public { bytes memory recipient=abi.encodePacked(address(0xB0B)); (bool ok,)=address(router).call(abi.encodeCall(router.outbound,(adapter,keccak256("wrong"),BNB_ASSET,address(this),recipient,1 ether,bytes("")))); require(!ok,"wrong route accepted"); }
    function testOutboundMalformedRecipientFailsClosed() public { bytes memory recipient=hex"010203"; (bool ok,)=address(router).call(abi.encodeCall(router.outbound,(adapter,ROUTE,BNB_ASSET,address(this),recipient,1 ether,bytes("")))); require(!ok,"bad recipient accepted"); }
    function testAssetRebindingRemovesStaleSourceMapping() public { bytes32 tokenKey=adapter.sourceAssetKey(TOKEN); adapter.setAssetMapping(tokenKey,BEP20_ASSET,true); adapter.setAssetMapping(adapter.BNB_NATIVE_SOURCE_ASSET(),BEP20_ASSET,true); require(adapter.assetIdBySourceAsset(tokenKey)==bytes32(0),"stale source mapping"); require(adapter.sourceAssetByAssetId(BEP20_ASSET)==adapter.BNB_NATIVE_SOURCE_ASSET(),"new source missing"); }
    function _setHealthy(address token, bytes32 messageId) private { verifier.set(_healthy(token,messageId)); }
    function _healthy(address token, bytes32 messageId) private pure returns (IBnbFinalityVerifier420.FinalizedTransfer memory p) {
        p=IBnbFinalityVerifier420.FinalizedTransfer({sourceChainId:56,blockNumber:42_000_000,blockHash:keccak256("bnb-block"),transactionHash:keccak256(abi.encode("bnb-tx",messageId)),messageId:messageId,gateway:GATEWAY,sourceToken:token,sourceSender:address(0xA11CE),recipient:address(0xB0B),amount:42 ether,finalized:true});
    }
}

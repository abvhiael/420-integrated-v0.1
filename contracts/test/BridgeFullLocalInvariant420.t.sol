// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./BridgeFullLocalFixture420.sol";
contract FullLocalHandler420 is BridgeFullLocalFixture420 {
    bool public consumed;bool public available;bool private initialized;
    function initialize() external {require(!initialized);initialized=true;setUp();available=true;}
    function revoke() external {bytes32 id=qualification.currentApproval(address(adapter));if(id!=0)qualification.revoke(id,keccak256("invariant revocation"));available=false;}
    function suspend() external {routes.setDirection(route(6),false,false);available=false;}
    function restore() external {BridgeRouteRegistry.Route memory next;(next.assetId,next.sourceChainId,next.destinationChainId,next.sourceAsset,next.destinationAsset,next.adapterId,next.verifierConfigHash,next.version,next.status,next.inboundEnabled,next.outboundEnabled)=routes.routes(route(6));next.inboundEnabled=true;next.outboundEnabled=true;next.status=BridgeRouteRegistry.Status.APPROVED_INACTIVE;routes.setRoute(route(6),next);qualifyLocal();available=true;}
    function attempt() external {(bool ok,)=address(gateway).call(abi.encodeCall(gateway.acceptInboundAndSettle,(adapter.ADAPTER_ID(),transport(proof("base-standard")))));require(ok==(available&&!consumed),"native settlement authorization model");if(ok)consumed=true;}
    function check() external view {CCTPV2Message420.Message memory m=message("base-standard");uint256 expected=consumed?m.amount-m.fee:0;require(token.balanceOf(m.mintRecipient)==expected,"native supply changed without accepted proof");require(adapter.consumedNonces(m.nonce)==consumed&&(CCTPNativeMT420(MT).usedNonces(m.nonce)==1)==consumed);(,,,,,,uint256 tvl)=risk.routeUsage(route(6));(,,,,,,uint256 assetTvl)=risk.assetUsage(ASSET);require(tvl==expected&&assetTvl==expected,"risk/supply drift");bytes32 id=transfers.deriveTransferId(route(6),ASSET,address(uint160(uint256(m.messageSender))),m.mintRecipient,m.amount-m.fee,keccak256(file("base-standard.message.hex")),sourceMessage());(,,,,,,,BridgeTransferRegistry.Status status,,)=transfers.transfers(id);require(status==(consumed?BridgeTransferRegistry.Status.COMPLETED:BridgeTransferRegistry.Status.NONE),"native delivery/lifecycle drift");}
}
contract BridgeFullLocalInvariant420Test {
    FullLocalHandler420 private handler;struct FuzzSelector{address addr;bytes4[] selectors;}
    function setUp() public {handler=new FullLocalHandler420();handler.initialize();}
    function targetContracts() public view returns(address[] memory a){a=new address[](1);a[0]=address(handler);}
    function targetSelectors() public view returns(FuzzSelector[] memory a){bytes4[] memory s=new bytes4[](4);s[0]=handler.revoke.selector;s[1]=handler.suspend.selector;s[2]=handler.restore.selector;s[3]=handler.attempt.selector;a=new FuzzSelector[](1);a[0]=FuzzSelector(address(handler),s);}
    function invariantAuthenticEvidenceCannotDoubleSettleOrBypassRevocation() public view {handler.check();}
}

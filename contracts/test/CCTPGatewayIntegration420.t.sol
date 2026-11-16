// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./BridgeFullLocalFixture420.sol";
contract CCTPGatewayIntegration420Test is BridgeFullLocalFixture420 {
    function testActualRouterRecordsNativeCCTPDelivery() public {
        CCTPV2Message420.Message memory m=message("base-standard");bytes32 id=gateway.acceptInbound(adapter.ADAPTER_ID(),transport(proof("base-standard")));
        (,,,,uint256 amount,,,BridgeTransferRegistry.Status status,,)=transfers.transfers(id);
        require(amount==m.amount-m.fee&&status==BridgeTransferRegistry.Status.VERIFIED&&token.balanceOf(m.mintRecipient)==amount,"native delivery/lifecycle");
        (,,,,,,uint256 tvl)=risk.routeUsage(route(6));require(tvl==amount,"risk accounting");
    }
    function testRouterRiskRejectionRollsBackNativeMintAndBothNonceStores() public {
        risk.setRouteLimits(route(6),limits(1));CCTPV2Message420.Message memory m=message("base-standard");
        (bool ok,)=address(gateway).call(abi.encodeCall(gateway.acceptInbound,(adapter.ADAPTER_ID(),transport(proof("base-standard")))));
        require(!ok&&!adapter.consumedNonces(m.nonce)&&CCTPNativeMT420(MT).usedNonces(m.nonce)==0&&token.balanceOf(m.mintRecipient)==0,"atomic native/router rollback");
        (,,,,,,uint256 tvl)=risk.routeUsage(route(6));require(tvl==0,"risk rollback");
    }
    function testRouterOutboundBurnAndLifecycle() public {
        gateway.acceptInbound(adapter.ADAPTER_ID(),transport(proof("base-standard")));token.fund(address(this),10e6);token.approve(address(adapter),10e6);
        bytes32 id=gateway.initiateOutbound(adapter.ADAPTER_ID(),route(6),ASSET,abi.encode(bytes32(uint256(uint160(address(0xB0B))))),10e6,abi.encode(bytes32(0),uint256(0),uint32(2000),bytes("")));
        require(id!=0&&token.balanceOf(address(this))==0&&token.allowance(address(adapter),TM)==0,"native outbound burn");
        bytes32 transferId=transfers.deriveOutboundTransferId(route(6),ASSET,address(this),keccak256(abi.encode(bytes32(uint256(uint160(address(0xB0B)))))),10e6,id);
        (,,,,,,,BridgeTransferRegistry.Status status,,)=transfers.transfers(transferId);require(status==BridgeTransferRegistry.Status.SOURCE_PENDING,"native request pending attestation");
    }
}

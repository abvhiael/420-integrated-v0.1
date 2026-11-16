// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./BridgeFullLocalFixture420.sol";

/// Native Circle implementations and historical signatures; controlled token/Genesis only.
contract ProviderCCTPCompletion420Test is BridgeFullLocalFixture420 {
    function rejectClean(bytes memory p) internal {
        (bool ok,)=address(gateway).call(abi.encodeCall(gateway.acceptInbound,(adapter.ADAPTER_ID(),transport(p))));
        require(!ok,"provider substitution admitted");assertClean();
    }
    function testProviderCCTPProxyRuntimeImpersonationFailsQualification() public {
        // A substituted proxy cannot inherit approval by claiming the same implementation.
        bytes memory original=MT.code;
        vm.etch(MT,ICircleCCTPProxy420(MT).implementation().code);
        require(!qualification.isCurrent(address(adapter)),"runtime substitution retained approval");
        rejectClean(proof("base-standard"));vm.etch(MT,original);
        gateway.acceptInbound(adapter.ADAPTER_ID(),transport(proof("base-standard")));
        require(adapter.consumedNonces(message("base-standard").nonce),"restored native path");
    }
    function testProviderCCTPPeerRotationCannotReviveConsumedNonce() public {
        gateway.acceptInbound(adapter.ADAPTER_ID(),transport(proof("base-standard")));
        uint256 balance=token.balanceOf(message("base-standard").mintRecipient);
        USDCCCTPAdapter.Peer memory p=USDCCCTPAdapter.Peer(route(6),message("base-standard").sender,bytes32(uint256(uint160(MT))),message("base-standard").burnToken,2000,true,true,true);
        p.inbound=false;adapter.setPeer(6,p);require(!qualification.isCurrent(address(adapter)),"peer drift approved");
        p.inbound=true;adapter.setPeer(6,p);qualifyLocal();
        (bool ok,)=address(gateway).call(abi.encodeCall(gateway.acceptInbound,(adapter.ADAPTER_ID(),transport(proof("base-standard")))));
        require(!ok&&token.balanceOf(message("base-standard").mintRecipient)==balance&&adapter.consumedNonces(message("base-standard").nonce),"requalified duplicate mint");
    }
    function testProviderCCTPMessengerRuntimeCannotImpersonateNativeIssuer() public {
        vm.etch(TM,hex"60006000fd");require(!qualification.isCurrent(address(adapter)),"messenger substitution approved");rejectClean(proof("base-standard"));
    }
}

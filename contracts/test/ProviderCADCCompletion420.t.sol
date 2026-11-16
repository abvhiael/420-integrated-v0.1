// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./CADCGatewayIntegration420.t.sol";
interface ProviderVm420 {function etch(address,bytes calldata) external;}

/// A complete native-provider dependency manifest; controlled OFT/DVNs are NOT issuer approval.
contract ProviderCADCCompletion420Test is CADCGatewayIntegration420Test {
    function qualifyProviderDependencies() internal returns(BridgeVerifierRegistry420 q){
        q=BridgeQualificationFixture420.registry(env);
        CADCBridgeIntegration c=CADCBridgeIntegration(address(integration));c.setActive(false);
        bytes32 old=q.currentApproval(address(c));
        BridgeVerifierRegistry420.Registration memory r=abi.decode(q.registration(old),(BridgeVerifierRegistry420.Registration));
        // Pin actual local token/OFT, Endpoint V2, effective ULN and all DVN runtimes.
        // Production proxy instances must use their audited implementation profile instead.
        r.dependencies=new BridgeVerifierRegistry420.Identity[](6);
        address[6] memory targets=[address(oft),address(ep),address(uln),address(a),address(b),address(optional)];
        for(uint256 n;n<targets.length;++n)r.dependencies[n]=q.identity(targets[n],BridgeVerifierRegistry420.ProxyKind.DIRECT);
        r.evidenceHash=keccak256("COMPLETE CONTROLLED PROVIDER MANIFEST / NOT ISSUER AUTHORIZATION");
        bytes32 id=q.record(r,old,true);c.bindQualification(id);c.setActive(true);
    }
    function rejectCleanProvider(bytes memory m) internal {
        (bool ok,)=address(gateway).call(abi.encodeCall(gateway.acceptInbound,(adapter.adapterId(),transport(1,m))));
        require(!ok&&!adapter.consumed(guid(1))&&oft.balanceOf(RECIPIENT)==0&&ep.lazyInboundNonce(address(oft),30101,REMOTE)==0,"partial provider delivery");
    }
    function testProviderCADCDvnRuntimeChangeInvalidatesIssuerGuard() public {
        BridgeVerifierRegistry420 q=qualifyProviderDependencies();bytes memory m=message(125);ready(1,m);
        ProviderVm420(address(vm)).etch(address(a),hex"60006000fd");
        require(!q.isCurrent(address(integration)),"DVN code drift retained approval");rejectCleanProvider(m);
    }
    function testProviderCADCNativeEndpointRuntimeSubstitutionRejected() public {
        BridgeVerifierRegistry420 q=qualifyProviderDependencies();
        ProviderVm420(address(vm)).etch(address(ep),hex"60006000fd");
        require(!q.isCurrent(address(integration)),"endpoint impersonation retained approval");
        (bool ok,)=address(integration).staticcall(abi.encodeCall(ICADCIntegration420.requireActive,()));require(!ok,"issuer guard accepted endpoint");
    }
    function testProviderCADCRequalificationCannotReplayNativePacket() public {
        qualifyProviderDependencies();bytes memory m=message(125);ready(1,m);
        gateway.acceptInbound(adapter.adapterId(),transport(1,m));qualifyProviderDependencies();
        (bool ok,)=address(gateway).call(abi.encodeCall(gateway.acceptInbound,(adapter.adapterId(),transport(1,m))));
        require(!ok&&adapter.consumed(guid(1))&&oft.balanceOf(RECIPIENT)==125e12,"duplicate native credit");
    }
}

// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../interfaces/I420System.sol";
import "../interfaces/genesis/ICapabilityRegistry420.sol";
import "./AIIds420.sol";
contract AIAuthorization420 is I420System {
    ICapabilityRegistry420 public immutable capabilityRegistry;
    bytes32 private constant SCOPE_DOMAIN=keccak256("420/AI/CAPABILITY/SCOPE/V1");
    bytes32 private constant PROVIDER_SCOPE=keccak256("420/AI/SCOPE/PROVIDER/V1");
    bytes32 private constant DEPLOYMENT_SCOPE=keccak256("420/AI/SCOPE/DEPLOYMENT/V1");
    bytes32 private constant REQUEST_SCOPE=keccak256("420/AI/SCOPE/REQUEST/V1");
    error InvalidRegistry(); error InvalidScope();
    constructor(address r){if(r==address(0)||r.code.length==0)revert InvalidRegistry();capabilityRegistry=ICapabilityRegistry420(r);}
    function systemName() external pure returns(string memory){return "AIAuthorization420";}
    function protocolVersion() external pure returns(uint32){return 1;}
    function scopeProvider(bytes32 id) public pure returns(bytes32){return _scope(PROVIDER_SCOPE,id);}
    function scopeDeployment(bytes32 id) public pure returns(bytes32){return _scope(DEPLOYMENT_SCOPE,id);}
    function scopeRequest(bytes32 id) public pure returns(bytes32){return _scope(REQUEST_SCOPE,id);}
    function isAuthorized(address p,bytes32 a,bytes32 s,uint256 amount) public view returns(bool){
        if(p==address(0)||s==bytes32(0)||!_known(a))return false;
        try capabilityRegistry.isAuthorized(p,AIIds420.COMPONENT_AI,a,s,amount) returns(bool ok){return ok;} catch{return false;}
    }
    function isProviderAuthorized(address p,bytes32 id,bytes32 a) external view returns(bool){return isAuthorized(p,a,scopeProvider(id),0);}
    function isDeploymentAuthorized(address p,bytes32 id,bytes32 a) external view returns(bool){return isAuthorized(p,a,scopeDeployment(id),0);}
    function isRequestAuthorized(address p,bytes32 id,bytes32 a,uint256 amount) external view returns(bool){return isAuthorized(p,a,scopeRequest(id),amount);}
    function _scope(bytes32 k,bytes32 id) private pure returns(bytes32){if(id==bytes32(0))revert InvalidScope();return keccak256(abi.encode(SCOPE_DOMAIN,k,id));}
    function _known(bytes32 a) private pure returns(bool){return a==AIIds420.ACTION_REGISTER_PROVIDER||a==AIIds420.ACTION_REGISTER_DEPLOYMENT||
        a==AIIds420.ACTION_UPDATE_DEPLOYMENT||a==AIIds420.ACTION_SET_DEPLOYMENT_STATE||a==AIIds420.ACTION_CREATE_REQUEST||a==AIIds420.ACTION_BIND_COMPUTE;}
}

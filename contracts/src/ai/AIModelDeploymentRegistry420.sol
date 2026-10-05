// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../interfaces/I420System.sol"; import "./AIIds420.sol"; import "./AIAuthorization420.sol"; import "./AIProviderRegistry.sol"; import "./AIModelRegistry.sol";
contract AIModelDeploymentRegistry420 is I420System {
    enum State{NONE,REGISTERED,ACTIVE,SUSPENDED,RETIRED}
    struct Deployment{bytes32 providerId;bytes32 modelVersionId;bytes32 computeOfferRef;bytes32 servicePricingPolicyId;bytes32 endpointManifestHash;uint64 endpointExpiry;bytes32 regionPolicyHash;bytes32 slaPolicyId;uint64 createdAt;uint32 revision;State state;bool exists;}
    AIAuthorization420 public immutable authorization; AIProviderRegistry public immutable providers; AIModelRegistry public immutable models; mapping(bytes32=>Deployment) private deployments;
    error InvalidDependency();error InvalidDeployment();error DeploymentExists();error DeploymentNotFound();error Unauthorized();error InvalidState();
    event DeploymentRegistered(bytes32 indexed deploymentId,bytes32 indexed providerId,bytes32 indexed modelVersionId,bytes32 computeOfferRef);
    event DeploymentUpdated(bytes32 indexed deploymentId,bytes32 endpointManifestHash,uint32 revision);
    event DeploymentStateChanged(bytes32 indexed deploymentId,State previousState,State newState,uint32 revision);
    constructor(address a,address p,address m){if(a==address(0)||p==address(0)||m==address(0)||a.code.length==0||p.code.length==0||m.code.length==0)revert InvalidDependency();authorization=AIAuthorization420(a);providers=AIProviderRegistry(p);models=AIModelRegistry(m);}
    function systemName() external pure returns(string memory){return "AIModelDeploymentRegistry420";} function protocolVersion() external pure returns(uint32){return 1;}
    function registerDeployment(bytes32 id,bytes32 pid,bytes32 vid,bytes32 offer,bytes32 pricing,bytes32 endpoint,uint64 expiry,bytes32 region,bytes32 sla) external {
        if(id==0||pid==0||vid==0||offer==0||pricing==0||endpoint==0||region==0||sla==0||(expiry!=0&&expiry<=block.timestamp)||!models.isVersionOperational(vid))revert InvalidDeployment();
        if(deployments[id].exists)revert DeploymentExists(); address op=_operator(pid);
        if(msg.sender!=op&&!authorization.isDeploymentAuthorized(msg.sender,id,AIIds420.ACTION_REGISTER_DEPLOYMENT))revert Unauthorized();
        deployments[id]=Deployment(pid,vid,offer,pricing,endpoint,expiry,region,sla,uint64(block.timestamp),1,State.REGISTERED,true);emit DeploymentRegistered(id,pid,vid,offer);
    }
    function updateDeployment(bytes32 id,bytes32 offer,bytes32 pricing,bytes32 endpoint,uint64 expiry,bytes32 region,bytes32 sla) external {
        Deployment storage d=_get(id);if(d.state==State.ACTIVE||d.state==State.RETIRED)revert InvalidState();
        if(offer==0||pricing==0||endpoint==0||region==0||sla==0||(expiry!=0&&expiry<=block.timestamp))revert InvalidDeployment();
        if(msg.sender!=_operator(d.providerId)&&!authorization.isDeploymentAuthorized(msg.sender,id,AIIds420.ACTION_UPDATE_DEPLOYMENT))revert Unauthorized();
        d.computeOfferRef=offer;d.servicePricingPolicyId=pricing;d.endpointManifestHash=endpoint;d.endpointExpiry=expiry;d.regionPolicyHash=region;d.slaPolicyId=sla;d.revision++;emit DeploymentUpdated(id,endpoint,d.revision);
    }
    function setState(bytes32 id,State next) external {Deployment storage d=_get(id);if(msg.sender!=_operator(d.providerId)&&!authorization.isDeploymentAuthorized(msg.sender,id,AIIds420.ACTION_SET_DEPLOYMENT_STATE))revert Unauthorized();
        State prev=d.state;bool ok=(prev==State.REGISTERED&&(next==State.ACTIVE||next==State.RETIRED))||(prev==State.ACTIVE&&(next==State.SUSPENDED||next==State.RETIRED))||(prev==State.SUSPENDED&&(next==State.ACTIVE||next==State.RETIRED));
        if(!ok)revert InvalidState();if(next==State.ACTIVE&&!_deps(d))revert InvalidState();d.state=next;d.revision++;emit DeploymentStateChanged(id,prev,next,d.revision);}
    function getDeployment(bytes32 id) external view returns(Deployment memory){return _get(id);} function isOperational(bytes32 id) public view returns(bool){Deployment storage d=deployments[id];return d.exists&&d.state==State.ACTIVE&&_deps(d);}
    function _deps(Deployment storage d) private view returns(bool){return providers.isOperational(d.providerId)&&models.isVersionOperational(d.modelVersionId)&&(d.endpointExpiry==0||block.timestamp<=d.endpointExpiry);}
    function _operator(bytes32 id) private view returns(address op){(address a,address s,bytes32 mh,bytes32 sr,bytes32 cr,uint64 ca,uint32 rev,AIProviderRegistry.ProviderState st,bool ex)=providers.providers(id);s;mh;sr;cr;ca;rev;st;if(!ex||a==address(0))revert InvalidDeployment();return a;}
    function _get(bytes32 id) private view returns(Deployment storage d){d=deployments[id];if(!d.exists)revert DeploymentNotFound();}
}

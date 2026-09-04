// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./ResourceAuthorization420.sol";
import "./ResourceIds420.sol";

contract ResourceProviderRegistry420 is I420System {
    enum State { NONE, REGISTERED, ACTIVE, SUSPENDED, RETIRED }
    struct Provider { address operatorAccount; bytes32 metadataHash; bytes32 stakeRef; uint32 revision; State state; bool exists; }
    ResourceAuthorization420 public immutable authorization; mapping(bytes32=>Provider) private _providers;
    error InvalidProvider(); error ProviderExists(); error ProviderNotFound(); error Unauthorized(); error InvalidState(); error StakeRequired();
    event ProviderRegistered(bytes32 indexed providerId,address indexed operatorAccount,bytes32 stakeRef); event ProviderStateChanged(bytes32 indexed providerId,State state);
    constructor(address authorization_) { require(authorization_!=address(0),"dependency"); authorization=ResourceAuthorization420(authorization_); }
    function systemName() external pure returns(string memory){return "ResourceProviderRegistry420";} function protocolVersion() external pure returns(uint32){return 1;}
    function registerProvider(bytes32 providerId,address operatorAccount,bytes32 metadataHash,bytes32 stakeRef) external { if(providerId==0||operatorAccount==address(0)) revert InvalidProvider(); if(_providers[providerId].exists) revert ProviderExists(); if(msg.sender!=operatorAccount&&!authorization.isProviderAuthorized(msg.sender,providerId,ResourceIds420.ACTION_REGISTER_PROVIDER)) revert Unauthorized(); _providers[providerId]=Provider(operatorAccount,metadataHash,stakeRef,1,State.REGISTERED,true); emit ProviderRegistered(providerId,operatorAccount,stakeRef); }
    function setState(bytes32 providerId,State next) external { Provider storage p=_get(providerId); if(msg.sender!=p.operatorAccount&&!authorization.isProviderAuthorized(msg.sender,providerId,ResourceIds420.ACTION_SET_PROVIDER_STATE)) revert Unauthorized(); State old=p.state; bool ok=(old==State.REGISTERED&&(next==State.ACTIVE||next==State.RETIRED))||(old==State.ACTIVE&&(next==State.SUSPENDED||next==State.RETIRED))||(old==State.SUSPENDED&&(next==State.ACTIVE||next==State.RETIRED)); if(!ok) revert InvalidState(); if(next==State.ACTIVE&&p.stakeRef==0) revert StakeRequired(); p.state=next; p.revision++; emit ProviderStateChanged(providerId,next); }
    function updateProvider(bytes32 providerId,bytes32 metadataHash,bytes32 stakeRef) external { Provider storage p=_get(providerId); if(p.state==State.ACTIVE||p.state==State.RETIRED) revert InvalidState(); if(msg.sender!=p.operatorAccount&&!authorization.isProviderAuthorized(msg.sender,providerId,ResourceIds420.ACTION_UPDATE_PROVIDER)) revert Unauthorized(); p.metadataHash=metadataHash; p.stakeRef=stakeRef; p.revision++; }
    function getProvider(bytes32 providerId) external view returns(Provider memory){return _get(providerId);} function isActive(bytes32 providerId) external view returns(bool){return _providers[providerId].exists&&_providers[providerId].state==State.ACTIVE;}
    function _get(bytes32 id) private view returns(Provider storage p){p=_providers[id]; if(!p.exists) revert ProviderNotFound();}
}

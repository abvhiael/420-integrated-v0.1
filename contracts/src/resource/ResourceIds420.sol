// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

library ResourceIds420 {
    bytes32 internal constant COMPONENT_RESOURCE = keccak256("420/RESOURCE/COMPONENT/V1");
    bytes32 internal constant SERVICE_RELAY = keccak256("420/RESOURCE/SERVICE/RELAY/V1");
    bytes32 internal constant SERVICE_STORE = keccak256("420/RESOURCE/SERVICE/STORE/V1");
    bytes32 internal constant SERVICE_CACHE = keccak256("420/RESOURCE/SERVICE/CACHE/V1");
    bytes32 internal constant SERVICE_GATEWAY = keccak256("420/RESOURCE/SERVICE/GATEWAY/V1");

    bytes32 internal constant ACTION_REGISTER_PROVIDER = keccak256("420/RESOURCE/ACTION/REGISTER_PROVIDER/V1");
    bytes32 internal constant ACTION_UPDATE_PROVIDER = keccak256("420/RESOURCE/ACTION/UPDATE_PROVIDER/V1");
    bytes32 internal constant ACTION_SET_PROVIDER_STATE = keccak256("420/RESOURCE/ACTION/SET_PROVIDER_STATE/V1");
    bytes32 internal constant ACTION_REGISTER_NODE = keccak256("420/RESOURCE/ACTION/REGISTER_NODE/V1");
    bytes32 internal constant ACTION_UPDATE_NODE = keccak256("420/RESOURCE/ACTION/UPDATE_NODE/V1");
    bytes32 internal constant ACTION_SET_NODE_STATE = keccak256("420/RESOURCE/ACTION/SET_NODE_STATE/V1");
    bytes32 internal constant ACTION_PUBLISH_OFFER = keccak256("420/RESOURCE/ACTION/PUBLISH_OFFER/V1");
    bytes32 internal constant ACTION_OPEN_SESSION = keccak256("420/RESOURCE/ACTION/OPEN_SESSION/V1");
    bytes32 internal constant ACTION_SUBMIT_RECEIPT = keccak256("420/RESOURCE/ACTION/SUBMIT_RECEIPT/V1");
    bytes32 internal constant ACTION_SETTLE = keccak256("420/RESOURCE/ACTION/SETTLE/V1");

    function isService(bytes32 serviceId) internal pure returns (bool) {
        return serviceId == SERVICE_RELAY || serviceId == SERVICE_STORE || serviceId == SERVICE_CACHE || serviceId == SERVICE_GATEWAY;
    }
}

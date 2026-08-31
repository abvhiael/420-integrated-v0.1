// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

library RightsIds420 {
    bytes32 internal constant COMPONENT_RIGHTS = keccak256("420/RIGHTS/COMPONENT/V1");
    bytes32 internal constant SERVICE_POLICY = keccak256("420/RIGHTS/SERVICE/POLICY/V1");
    bytes32 internal constant SERVICE_ASSETS = keccak256("420/RIGHTS/SERVICE/ASSETS/V1");
    bytes32 internal constant SERVICE_CLAIMS = keccak256("420/RIGHTS/SERVICE/CLAIMS/V1");
    bytes32 internal constant SERVICE_LICENSES = keccak256("420/RIGHTS/SERVICE/LICENSES/V1");

    bytes32 internal constant ACTION_REGISTER_ASSET = keccak256("420/RIGHTS/ACTION/REGISTER_ASSET/V1");
    bytes32 internal constant ACTION_UPDATE_ASSET = keccak256("420/RIGHTS/ACTION/UPDATE_ASSET/V1");
    bytes32 internal constant ACTION_DECLARE_CLAIM = keccak256("420/RIGHTS/ACTION/DECLARE_CLAIM/V1");
    bytes32 internal constant ACTION_SUPERSEDE_CLAIM = keccak256("420/RIGHTS/ACTION/SUPERSEDE_CLAIM/V1");
    bytes32 internal constant ACTION_TRANSFER_RIGHT = keccak256("420/RIGHTS/ACTION/TRANSFER_RIGHT/V1");
    bytes32 internal constant ACTION_GRANT_LICENSE = keccak256("420/RIGHTS/ACTION/GRANT_LICENSE/V1");
    bytes32 internal constant ACTION_REVOKE_LICENSE = keccak256("420/RIGHTS/ACTION/REVOKE_LICENSE/V1");

    bytes32 internal constant RIGHT_COPYRIGHT = keccak256("420/RIGHTS/CLASS/COPYRIGHT/V1");
    bytes32 internal constant RIGHT_TRADEMARK = keccak256("420/RIGHTS/CLASS/TRADEMARK/V1");
    bytes32 internal constant RIGHT_PATENT = keccak256("420/RIGHTS/CLASS/PATENT/V1");
    bytes32 internal constant RIGHT_PERSONALITY = keccak256("420/RIGHTS/CLASS/PERSONALITY/V1");
    bytes32 internal constant RIGHT_GENETIC = keccak256("420/RIGHTS/CLASS/GENETIC/V1");
    bytes32 internal constant RIGHT_DATA = keccak256("420/RIGHTS/CLASS/DATA/V1");
    bytes32 internal constant RIGHT_MODEL = keccak256("420/RIGHTS/CLASS/MODEL/V1");
    bytes32 internal constant RIGHT_CONTRACTUAL = keccak256("420/RIGHTS/CLASS/CONTRACTUAL/V1");
}

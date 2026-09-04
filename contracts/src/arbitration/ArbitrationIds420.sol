// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

library ArbitrationIds420 {
    bytes32 internal constant COMPONENT_ARBITRATION = keccak256("420/component/arbitration/v1");
    bytes32 internal constant ACTION_OPEN_CASE = keccak256("420/action/arbitration/open-case/v1");
    bytes32 internal constant ACTION_SUBMIT_EVIDENCE = keccak256("420/action/arbitration/submit-evidence/v1");
    bytes32 internal constant ACTION_RULE = keccak256("420/action/arbitration/rule/v1");
    bytes32 internal constant ACTION_APPEAL = keccak256("420/action/arbitration/appeal/v1");
    bytes32 internal constant ACTION_FINALIZE = keccak256("420/action/arbitration/finalize/v1");
}

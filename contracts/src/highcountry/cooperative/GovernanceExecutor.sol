// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import {CooperativeGovernance} from "./CooperativeGovernance.sol";

/// @notice Executor can only set inert, nonfinancial cooperative policy metadata.
/// @dev No generic external calls, wallet signing, custody, treasury or rights mutation.
contract GovernanceExecutor {
    error Unauthorized();
    CooperativeGovernance public immutable governance;
    mapping(bytes32 => mapping(bytes32 => bytes32)) public policy;
    event PolicySet(bytes32 indexed cooperative,bytes32 indexed scope,bytes32 value,bytes32 proposal);
    constructor(address governance_){
        if(governance_.code.length==0) revert Unauthorized();
        governance=CooperativeGovernance(governance_);
    }
    function execute(bytes32 id) external {
        if(!governance.executable(id)) revert Unauthorized();
        (bytes32 coop,,bytes32 action,bytes32 scope,bytes32 value,,,,,,,) = governance.proposals(id);
        if(action!=governance.ACTION_SET_POLICY()||scope==bytes32(0)) revert Unauthorized();
        governance.markExecuted(id);
        policy[coop][scope]=value;
        emit PolicySet(coop,scope,value,id);
    }
}

// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../BetAuthorization420.sol";

abstract contract SportsAuthority420 {
    BetAuthorization420 public immutable authorization;
    error Invalid();
    error Unauthorized();
    error State();
    error Missing();
    error Conflict();
    error Separation();

    constructor(address auth) {
        if (auth == address(0) || auth.code.length == 0) revert Invalid();
        authorization = BetAuthorization420(auth);
    }

    // Registry/deployment domain prevents grants for a sibling deployment being reused.
    function scope(bytes32 id) public view virtual returns (bytes32) {
        return keccak256(abi.encode("420.BET.SPORTS.SCOPE.V1", block.chainid, address(this), id));
    }

    function _auth(bytes32 action, bytes32 id) internal view {
        if (!authorization.isAuthorized(msg.sender, action, scope(id), 0)) revert Unauthorized();
    }
}

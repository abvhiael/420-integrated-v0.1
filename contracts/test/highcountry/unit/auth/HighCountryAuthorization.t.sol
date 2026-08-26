// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ICapabilityRegistry420 } from "../../../../src/interfaces/genesis/ICapabilityRegistry420.sol";
import { HighCountryAuthorization } from "../../../../src/highcountry/auth/HighCountryAuthorization.sol";
import { AuthorizationRequest } from "../../../../src/highcountry/types/HighCountryTypes.sol";
import { MockCapabilityRegistry } from "../../mocks/MockCapabilityRegistry.sol";

contract HighCountryAuthorizationTest {
    bytes32 private constant MODULE_ID = keccak256("HC.MODULE.PLANT_REGISTRY");
    bytes32 private constant ACTION_ID = keccak256("HC.ACTION.PLANT_REGISTRY.TEND");
    bytes32 private constant SCOPE_HASH = keccak256("plant:1");
    bytes32 private constant GRANT_ID = keccak256("grant:1");
    uint256 private constant AMOUNT = 1;

    MockCapabilityRegistry private registry;
    HighCountryAuthorization private authorization;

    constructor() {
        registry = new MockCapabilityRegistry();
        authorization = new HighCountryAuthorization(address(registry));
    }

    function testDefaultDeny() public view {
        AuthorizationRequest memory request = _request();
        require(!authorization.isAuthorized(request), "default must deny");
    }

    function testCapabilityApproval() public {
        _setGrant(uint64(block.timestamp), uint64(block.timestamp + 1 days), false);
        AuthorizationRequest memory request = _request();
        require(authorization.isAuthorized(request), "valid capability rejected");
        authorization.requireAuthorized(request);
    }

    function testExpiredCapabilityDenied() public {
        uint64 expiredAt = block.timestamp == 0 ? 0 : uint64(block.timestamp - 1);
        _setGrant(0, expiredAt, false);
        AuthorizationRequest memory request = _request();
        require(!authorization.isAuthorized(request), "expired capability accepted");
        require(_requireAuthorizedReverts(request), "expired capability did not revert");
    }

    function testRevokedCapabilityDenied() public {
        _setGrant(0, uint64(block.timestamp + 1 days), true);
        AuthorizationRequest memory request = _request();
        require(!authorization.isAuthorized(request), "revoked capability accepted");
        require(_requireAuthorizedReverts(request), "revoked capability did not revert");
    }

    function testZeroPrincipalFailsClosed() public view {
        AuthorizationRequest memory request = _request();
        request.principal = address(0);
        require(!authorization.isAuthorized(request), "zero principal authorized");
    }

    function _setGrant(uint64 validFrom, uint64 validUntil, bool revoked) private {
        ICapabilityRegistry420.CapabilityGrant memory grant = ICapabilityRegistry420.CapabilityGrant({
            principal: address(this),
            componentId: MODULE_ID,
            capabilityId: ACTION_ID,
            scopeHash: SCOPE_HASH,
            perCallLimit: AMOUNT,
            periodLimit: 0,
            periodSeconds: 0,
            validFrom: validFrom,
            validUntil: validUntil,
            revoked: revoked
        });
        registry.setGrant(GRANT_ID, grant, AMOUNT);
    }

    function _request() private view returns (AuthorizationRequest memory) {
        return AuthorizationRequest({
            principal: address(this),
            moduleId: MODULE_ID,
            actionId: ACTION_ID,
            scopeHash: SCOPE_HASH,
            amount: AMOUNT
        });
    }

    function _requireAuthorizedReverts(AuthorizationRequest memory request) private returns (bool) {
        (bool ok,) = address(authorization).call(
            abi.encodeWithSelector(authorization.requireAuthorized.selector, request)
        );
        return !ok;
    }
}

// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/pay/MerchantRegistry420.sol";
import "./helpers/GenesisMocks420.sol";

interface VmMerchantBusiness420 {
    function prank(address) external;
}

contract PayMerchantBusiness420Test {
    VmMerchantBusiness420 private constant vm =
        VmMerchantBusiness420(address(uint160(uint256(keccak256("hevm cheat code")))));
    bytes32 private constant FIRST = keccak256("first merchant");
    bytes32 private constant SECOND = keccak256("second merchant");
    bytes32 private constant LOCATION = keccak256("location");
    address private constant CONTROLLER = address(0x4201);
    address private constant DELEGATE = address(0x4202);
    address private constant OUTSIDER = address(0x4203);
    MerchantRegistry420 private registry;

    function setUp() public {
        GenesisMockEnvironment420 env = new GenesisMockEnvironment420();
        registry = new MerchantRegistry420(address(this), address(env.registry()), keccak256("merchant qualification"));
        env.registerResident(address(registry), registry.componentId());
        vm.prank(CONTROLLER);
        registry.registerForController(FIRST, CONTROLLER, CONTROLLER);
        vm.prank(OUTSIDER);
        registry.registerForController(SECOND, OUTSIDER, OUTSIDER);
    }

    function testOnboardingBindsControllerAndStatusIsGoverned() public {
        (address owner,,, MerchantRegistry420.Status status, bool active,) = registry.merchants(FIRST);
        require(owner == CONTROLLER && status == MerchantRegistry420.Status.REGISTERED && active);
        vm.prank(OUTSIDER);
        (bool registered,) = address(registry).call(abi.encodeCall(
            registry.registerForController, (keccak256("spoof"), CONTROLLER, OUTSIDER)
        ));
        require(!registered);
        vm.prank(CONTROLLER);
        (bool elevated,) = address(registry).call(abi.encodeCall(
            registry.setStatus, (FIRST, MerchantRegistry420.Status.REGULATED, true)
        ));
        require(!elevated);
        registry.setStatus(FIRST, MerchantRegistry420.Status.CREDENTIALED, true);
        (,,, status,,) = registry.merchants(FIRST);
        require(status == MerchantRegistry420.Status.CREDENTIALED);
    }

    function testTenantRolesAndLocationRevocation() public {
        vm.prank(CONTROLLER);
        registry.setLocation(FIRST, LOCATION, true);
        vm.prank(CONTROLLER);
        registry.setRole(FIRST, LOCATION, DELEGATE, MerchantRegistry420.Role.CASHIER);
        require(registry.effectiveRole(FIRST, LOCATION, DELEGATE) == MerchantRegistry420.Role.CASHIER);
        require(registry.effectiveRole(SECOND, LOCATION, DELEGATE) == MerchantRegistry420.Role.NONE);
        require(registry.effectiveRole(FIRST, bytes32(0), DELEGATE) == MerchantRegistry420.Role.NONE);
        vm.prank(DELEGATE);
        (bool granted,) = address(registry).call(abi.encodeCall(
            registry.setRole, (FIRST, LOCATION, DELEGATE, MerchantRegistry420.Role.LOCATION_MANAGER)
        ));
        require(!granted);
        vm.prank(CONTROLLER);
        registry.setLocation(FIRST, LOCATION, false);
        require(registry.effectiveRole(FIRST, LOCATION, DELEGATE) == MerchantRegistry420.Role.NONE);
        vm.prank(CONTROLLER);
        registry.setLocation(FIRST, LOCATION, true);
        require(registry.effectiveRole(FIRST, LOCATION, DELEGATE) == MerchantRegistry420.Role.NONE);
    }

    function testMerchantDeactivationRevokesDelegation() public {
        vm.prank(CONTROLLER);
        registry.setRole(FIRST, bytes32(0), DELEGATE, MerchantRegistry420.Role.REPORTER);
        require(registry.effectiveRole(FIRST, bytes32(0), DELEGATE) == MerchantRegistry420.Role.REPORTER);
        registry.setStatus(FIRST, MerchantRegistry420.Status.REGISTERED, false);
        require(registry.effectiveRole(FIRST, bytes32(0), DELEGATE) == MerchantRegistry420.Role.NONE);
        registry.setStatus(FIRST, MerchantRegistry420.Status.REGISTERED, true);
        require(registry.effectiveRole(FIRST, bytes32(0), DELEGATE) == MerchantRegistry420.Role.NONE);
    }
}

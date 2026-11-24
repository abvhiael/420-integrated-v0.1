// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/apps/ProtocolRegistry.sol";
import "../src/system/CapabilityRegistry420.sol";
import "../src/revenue/DevelopmentCompensationVault420.sol";
import "../src/revenue/FoundingDeveloperCompensationSplitter420.sol";
import {FounderCompensationTestToken420} from "./FounderWalletClaimsAndCompensation420.t.sol";

interface VmDevCompEcosystem420 {
    struct Log { bytes32[] topics; bytes data; address emitter; }
    function deal(address, uint256) external;
    function prank(address) external;
    function recordLogs() external;
    function getRecordedLogs() external returns (Log[] memory);
}

contract DevCompApplication420 {
    ProtocolRegistry private immutable registry;
    bytes32 private immutable app;
    bytes32 private constant SERVICE = keccak256("420/service/development-compensation/v1");
    constructor(ProtocolRegistry r, bytes32 a) { registry = r; app = a; }
    function payNative(bytes32 ref, uint256 net) external payable {
        (address target,) = registry.resolveActive(SERVICE);
        DevelopmentCompensationVault420 v = DevelopmentCompensationVault420(payable(target));
        v.contributeNative{value: msg.value}(app, ref, v.policyId(), net, 1000);
    }
    function payToken(FounderCompensationTestToken420 token, bytes32 ref, uint256 net) external {
        (address target,) = registry.resolveActive(SERVICE);
        DevelopmentCompensationVault420 v = DevelopmentCompensationVault420(payable(target));
        token.approve(target, net / 10);
        v.contributeToken(address(token), app, ref, v.policyId(), net, 1000);
    }
}

contract DevelopmentCompensationEcosystem420Test {
    VmDevCompEcosystem420 private constant vm =
        VmDevCompEcosystem420(address(uint160(uint256(keccak256("hevm cheat code")))));
    bytes32 private constant SERVICE = keccak256("420/service/development-compensation/v1");
    bytes32 private constant APP = keccak256("420/app/local-ecosystem-fixture/v1");
    bytes32 private constant REF = keccak256("local receipt");
    address private constant ADMIN = address(0xAA11);
    address private constant ANDREW = address(0xAA22);
    address private constant JANET = address(0xAA33);
    ProtocolRegistry private registry;
    CapabilityRegistry420 private caps;
    FoundingDeveloperCompensationSplitter420 private splitter;
    DevelopmentCompensationVault420 private vault;
    DevCompApplication420 private source;

    function setUp() public {
        registry = new ProtocolRegistry(address(this));
        caps = new CapabilityRegistry420();
        splitter = new FoundingDeveloperCompensationSplitter420(ADMIN, ANDREW, JANET);
        vault = new DevelopmentCompensationVault420(address(caps), address(splitter));
        splitter.bindCompensationVault(address(vault));
        registry.publishRegisteredService(SERVICE, address(vault), keccak256("local metadata"), 1, true,
            ProtocolRegistry.ComponentType.PROTOCOL, keccak256("local manifest"),
            keccak256("local dependencies"), keccak256("local interface"));
        source = new DevCompApplication420(registry, APP);
        bytes32 component = DevelopmentCompensationIds420.COMPONENT_DEVELOPMENT_COMPENSATION;
        caps.registerProtocolComponent(component, address(this));
        caps.createGrant(keccak256("local app grant"), address(source), component,
            DevelopmentCompensationIds420.ACTION_CONTRIBUTE_REVENUE,
            DevelopmentCompensationIds420.scopeSource(APP), 100, 0, 0, 0, 0);
        vm.deal(address(this), 100);
    }

    function testRegistryResolvedNativeAndTokenReceiptLifecycle() public {
        (address target, uint32 version) = registry.resolveActive(SERVICE);
        require(target == address(vault) && version == 1, "registry resolution");
        require(registry.getService(SERVICE).codeHash == address(vault).codehash, "runtime identity");
        require(vault.beneficiary() == address(splitter) && splitter.compensationVault() == target, "binding");
        FounderCompensationTestToken420 token = new FounderCompensationTestToken420();
        token.mint(address(source), 100);
        vm.recordLogs();
        source.payNative{value: 100}(REF, 1000);
        checkReceipt(vm.getRecordedLogs(), address(0), REF);
        bytes32 tokenRef = keccak256("token receipt");
        vm.recordLogs();
        source.payToken(token, tokenRef, 1000);
        checkReceipt(vm.getRecordedLogs(), address(token), tokenRef);
        address[3] memory founders = [ADMIN, ANDREW, JANET];
        uint256[3] memory amounts = [uint256(50), 25, 25];
        for (uint256 i; i < 3; ++i) {
            vm.recordLogs();
            vm.prank(founders[i]); splitter.claimNative();
            checkClaim(vm.getRecordedLogs(), founders[i], address(0), amounts[i]);
            vm.recordLogs();
            vm.prank(founders[i]); splitter.claimToken(address(token));
            checkClaim(vm.getRecordedLogs(), founders[i], address(token), amounts[i]);
            require(token.balanceOf(founders[i]) == amounts[i], "recipient token balance");
        }
        require(splitter.totalNativeCredited() == 100 && splitter.totalNativeClaimed() == 100
            && splitter.totalTokenCredited(address(token)) == 100 && splitter.totalTokenClaimed(address(token)) == 100,
            "receipt reconciliation");
        require(address(vault).balance == 0 && address(splitter).balance == 0
            && token.balanceOf(address(vault)) == 0 && token.balanceOf(address(splitter)) == 0
            && token.balanceOf(address(source)) == 0, "residual custody");
    }

    function checkReceipt(VmDevCompEcosystem420.Log[] memory logs, address asset, bytes32 ref) private view {
        bytes32 id = vault.contributionId(address(source), APP, ref);
        uint256 forwarded;
        uint256 credited;
        for (uint256 i; i < logs.length; ++i) {
            VmDevCompEcosystem420.Log memory l = logs[i];
            if (l.emitter == address(vault) && l.topics[0] == keccak256(
                "DevelopmentCompensationForwarded(bytes32,bytes32,bytes32,address,address,address,uint256,uint16,uint256,bytes32)")) {
                require(l.topics.length == 4 && l.topics[1] == id && l.topics[2] == APP && l.topics[3] == ref, "receipt topics");
                require(keccak256(l.data) == keccak256(abi.encode(address(source), asset, address(splitter),
                    uint256(1000), uint16(1000), uint256(100), vault.policyId())), "receipt data");
                ++forwarded;
            }
            if (l.emitter != address(splitter)) continue;
            if (asset == address(0) && l.topics[0] == keccak256("FounderCompensationDeposited(address,uint256)")) {
                require(l.topics.length == 2 && l.topics[1] == bytes32(uint256(uint160(address(vault))))
                    && keccak256(l.data) == keccak256(abi.encode(uint256(100))), "native credit log");
                ++credited;
            } else if (asset != address(0) && l.topics[0] == keccak256("FounderTokenCompensationCredited(address,address,bytes32,uint256)")) {
                require(l.topics.length == 4 && l.topics[1] == bytes32(uint256(uint160(address(vault))))
                    && l.topics[2] == bytes32(uint256(uint160(asset))) && l.topics[3] == id
                    && keccak256(l.data) == keccak256(abi.encode(uint256(100))), "token credit log");
                ++credited;
            }
        }
        require(forwarded == 1 && credited == 1 && vault.consumedRevenueContribution(id), "exact receipt count");
    }

    function checkClaim(VmDevCompEcosystem420.Log[] memory logs, address founder, address asset, uint256 amount) private view {
        uint256 count;
        for (uint256 i; i < logs.length; ++i) {
            VmDevCompEcosystem420.Log memory l = logs[i];
            if (l.emitter != address(splitter) || l.topics[0] != keccak256("FounderCompensationClaimed(address,address,uint256)")) continue;
            require(l.topics.length == 3 && l.topics[1] == bytes32(uint256(uint160(founder)))
                && l.topics[2] == bytes32(uint256(uint160(asset)))
                && keccak256(l.data) == keccak256(abi.encode(amount)), "claim receipt");
            ++count;
        }
        require(count == 1, "exact claim count");
    }

    function testDiscoveryDoesNotGrantAuthorityAndDeprecationStopsResolvedSource() public {
        DevCompApplication420 unauthorized = new DevCompApplication420(registry, APP);
        (bool ok,) = address(unauthorized).call{value: 10}(abi.encodeCall(unauthorized.payNative, (REF, 100)));
        require(!ok && splitter.totalNativeCredited() == 0, "discovery granted authority");
        registry.deprecateService(SERVICE);
        (ok,) = address(source).call{value: 10}(abi.encodeCall(source.payNative, (REF, 100)));
        require(!ok && splitter.totalNativeCredited() == 0, "deprecated discovery accepted");
        require(!vault.consumedRevenueContribution(vault.contributionId(address(source), APP, REF)), "failed reference consumed");
    }
}

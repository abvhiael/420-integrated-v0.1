// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/bridge/BridgeAccountingRegistry.sol";
import "../src/interfaces/genesis/Types420.sol";

contract AccountingProtocolRegistryMock420 {
    mapping(bytes32 => Types420.ContractRef) private refs;

    function set(bytes32 id, address implementation) external {
        refs[id] = Types420.ContractRef({
            componentId: id,
            implementation: implementation,
            runtimeCodeHash: implementation.codehash,
            version: Types420.Version({major: 1, minor: 0, patch: 0}),
            lifecycle: Types420.Lifecycle.ACTIVE
        });
    }

    function component(bytes32 id) external view returns (Types420.ContractRef memory) { return refs[id]; }
    function supportsVersion(bytes32 id, Types420.Version calldata version_) external view returns (bool) {
        return refs[id].implementation != address(0) && version_.major == 1;
    }
}

contract AccountingGovernanceAuthorityMock420 {
    bool public authorized = true;
    bool public timelockOk = true;
    function setAuthorized(bool value) external { authorized = value; }
    function setTimelock(bool value) external { timelockOk = value; }
    function isAuthorized(address, bytes32) external view returns (bool) { return authorized; }
    function timelockSatisfied(bytes32) external view returns (bool) { return timelockOk; }
}

contract AccountingSystemSafetyMock420 {
    bool public allowed = true;
    function setAllowed(bool value) external { allowed = value; }
    function actionAllowed(bytes32, bytes32, uint8) external view returns (bool) { return allowed; }
}

contract AccountingChainContextMock420 {
    function chainId() external view returns (uint256) { return block.chainid; }
    function protocolVersion() external pure returns (Types420.Version memory) {
        return Types420.Version({major: 1, minor: 0, patch: 0});
    }
}

contract AccountingCanonicalAssetsMock420 {
    mapping(bytes32 => bool) public canonical;
    function setCanonical(bytes32 assetId, bool value) external { canonical[assetId] = value; }
    function isCanonical(bytes32 assetId) external view returns (bool) { return canonical[assetId]; }
    function isUsable(bytes32 assetId) external view returns (bool) { return canonical[assetId]; }
    function assetIdOf(address) external pure returns (bytes32) { return bytes32(0); }
}

contract UnauthorizedAccountingCaller420 {
    function reconcile(
        BridgeAccountingRegistry accounting,
        bytes32 assetId,
        uint256 authorizedSupply,
        uint256 observedSupply,
        uint64 observedAt,
        bytes32 evidenceHash
    ) external {
        accounting.applyReconciliation(assetId, authorizedSupply, observedSupply, observedAt, evidenceHash);
    }
}

/// @notice V12.6.7 governance, accounting, registry and recovery hardening.
contract GovernanceAccountingRecoveryHardening420Test {
    bytes32 private constant ACCOUNTING_ID = keccak256("420/APP/420BRIDGE/ACCOUNTING_REGISTRY");
    bytes32 private constant GOV_ID = keccak256("420/APP/GOVERNANCE_AUTHORITY");
    bytes32 private constant ASSETS_ID = keccak256("420/APP/CANONICAL_ASSET_REGISTRY");
    bytes32 private constant SAFETY_ID = keccak256("420/APP/SYSTEM_SAFETY");
    bytes32 private constant CHAIN_ID = keccak256("420/APP/CHAIN_CONTEXT");
    bytes32 private constant ASSET = keccak256("420/BRIDGE/ASSET/V12.6.7");

    AccountingProtocolRegistryMock420 private registry;
    AccountingGovernanceAuthorityMock420 private governance;
    AccountingSystemSafetyMock420 private safety;
    AccountingChainContextMock420 private chainContext;
    AccountingCanonicalAssetsMock420 private assets;
    BridgeAccountingRegistry private accounting;
    UnauthorizedAccountingCaller420 private attacker;

    constructor() {
        registry = new AccountingProtocolRegistryMock420();
        governance = new AccountingGovernanceAuthorityMock420();
        safety = new AccountingSystemSafetyMock420();
        chainContext = new AccountingChainContextMock420();
        assets = new AccountingCanonicalAssetsMock420();
        attacker = new UnauthorizedAccountingCaller420();

        accounting = new BridgeAccountingRegistry(address(this), address(registry), keccak256("genesis-v12.6.7"));
        registry.set(ACCOUNTING_ID, address(accounting));
        registry.set(GOV_ID, address(governance));
        registry.set(ASSETS_ID, address(assets));
        registry.set(SAFETY_ID, address(safety));
        registry.set(CHAIN_ID, address(chainContext));
        assets.setCanonical(ASSET, true);
    }

    function testUnauthorizedReconciliationRejected() public {
        uint64 observedAt = uint64(block.timestamp);
        (bool ok,) = address(attacker).call(
            abi.encodeCall(attacker.reconcile, (accounting, ASSET, 420, 420, observedAt, keccak256("unauthorized")))
        );
        require(!ok, "unauthorized reconciliation accepted");
        (,,,, bool healthy) = accounting.reconciliations(ASSET);
        require(!healthy, "unauthorized mutation changed health");
    }

    function testNoncanonicalAssetRejected() public {
        bytes32 unknown = keccak256("unknown-asset");
        (bool ok,) = address(accounting).call(
            abi.encodeCall(accounting.applyReconciliation, (unknown, 420, 420, uint64(block.timestamp), keccak256("unknown")))
        );
        require(!ok, "noncanonical reconciliation accepted");
    }

    function testMismatchRecordedUnhealthyWithoutRepairAuthority() public {
        bytes32 evidence = keccak256("mismatch-evidence");
        accounting.applyReconciliation(ASSET, 1_000, 999, uint64(block.timestamp), evidence);
        (uint256 authorizedSupply, uint256 observedSupply,, bytes32 storedEvidence, bool healthy) = accounting.reconciliations(ASSET);
        require(authorizedSupply == 1_000 && observedSupply == 999, "supply evidence altered");
        require(storedEvidence == evidence, "evidence missing");
        require(!healthy, "mismatch marked healthy");
    }

    function testStaleOrDuplicateObservationCannotOverwriteNewerEvidence() public {
        uint64 nowTs = uint64(block.timestamp);
        accounting.applyReconciliation(ASSET, 420, 419, nowTs, keccak256("newer"));

        (bool duplicateOk,) = address(accounting).call(
            abi.encodeCall(accounting.applyReconciliation, (ASSET, 420, 420, nowTs, keccak256("duplicate")))
        );
        require(!duplicateOk, "duplicate observation overwrote evidence");

        if (nowTs > 1) {
            (bool staleOk,) = address(accounting).call(
                abi.encodeCall(accounting.applyReconciliation, (ASSET, 420, 420, nowTs - 1, keccak256("stale")))
            );
            require(!staleOk, "stale observation overwrote evidence");
        }

        (uint256 authorizedSupply, uint256 observedSupply, uint64 observedAt, bytes32 evidence, bool healthy) = accounting.reconciliations(ASSET);
        require(authorizedSupply == 420 && observedSupply == 419, "newer evidence replaced");
        require(observedAt == nowTs && evidence == keccak256("newer") && !healthy, "state drifted");
    }

    function testNewerEvidenceRecoversUnhealthyState() public {
        uint64 first = uint64(block.timestamp > 1 ? block.timestamp - 1 : block.timestamp);
        accounting.applyReconciliation(ASSET, 4_200, 4_199, first, keccak256("unhealthy"));
        (,,,, bool initialHealthy) = accounting.reconciliations(ASSET);
        require(!initialHealthy, "initial mismatch healthy");

        uint64 second = first + 1;
        if (second > block.timestamp) second = uint64(block.timestamp);
        require(second > first, "test requires newer timestamp");
        bytes32 recoveryEvidence = keccak256("recovery");
        accounting.applyReconciliation(ASSET, 4_200, 4_200, second, recoveryEvidence);

        (uint256 authorizedSupply, uint256 observedSupply, uint64 observedAt, bytes32 evidence, bool healthy) = accounting.reconciliations(ASSET);
        require(authorizedSupply == 4_200 && observedSupply == 4_200, "recovery supply wrong");
        require(observedAt == second && evidence == recoveryEvidence, "recovery evidence wrong");
        require(healthy, "newer healthy evidence did not recover");
    }
}

// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../../src/libraries/AppDependencyIds420.sol";

import "../../src/interfaces/genesis/Types420.sol";
import "../../src/interfaces/genesis/IProtocolRegistry420.sol";
import "../../src/interfaces/genesis/IGovernanceAuthority420.sol";
import "../../src/interfaces/genesis/IPauseRegistry420.sol";
import "../../src/interfaces/genesis/ISystemSafety420.sol";
import "../../src/interfaces/genesis/IChainContext420.sol";
import "../../src/interfaces/genesis/ICanonicalAssetRegistry420.sol";
import "../../src/interfaces/genesis/IAssetCapabilities420.sol";
import "../../src/interfaces/genesis/ISettlementHealth420.sol";
import "../../src/interfaces/genesis/IFeeQuote420.sol";
import "../../src/interfaces/genesis/IReplayProtection420.sol";
import "../../src/interfaces/genesis/IMetadataCommitment420.sol";
import "../../src/interfaces/genesis/IRiskLimits420.sol";
import "../../src/libraries/GenesisInterfaceIds420.sol";

contract MockProtocolRegistryV1 is IProtocolRegistry420 {
    mapping(bytes32 => Types420.ContractRef) internal refs;

    function set(bytes32 id, address implementation) external {
        refs[id] = Types420.ContractRef({
            componentId: id,
            implementation: implementation,
            runtimeCodeHash: implementation.codehash,
            version: Types420.Version({ major: 1, minor: 0, patch: 0 }),
            lifecycle: Types420.Lifecycle.ACTIVE
        });
    }

    function setLifecycle(bytes32 id, Types420.Lifecycle lifecycle_) external { refs[id].lifecycle = lifecycle_; }
    function setCodeHash(bytes32 id, bytes32 codeHash) external { refs[id].runtimeCodeHash = codeHash; }
    function component(bytes32 id) external view returns (Types420.ContractRef memory) { return refs[id]; }
    function isActive(bytes32 id) external view returns (bool) { return refs[id].lifecycle == Types420.Lifecycle.ACTIVE; }
    function resolve(bytes32 id) external view returns (address) { return refs[id].implementation; }
    function runtimeCodeHash(bytes32 id) external view returns (bytes32) { return refs[id].runtimeCodeHash; }
    function supportsVersion(bytes32 id, Types420.Version calldata version) external view returns (bool) {
        Types420.ContractRef memory ref = refs[id];
        return ref.lifecycle == Types420.Lifecycle.ACTIVE
            && version.major == ref.version.major
            && version.minor == ref.version.minor
            && version.patch == ref.version.patch;
    }
}

contract MockGovernanceAuthorityV1 is IGovernanceAuthority420 {
    bool public authorized = true;
    bool public timelockOk = true;
    function set(bool authorized_, bool timelockOk_) external { authorized = authorized_; timelockOk = timelockOk_; }
    function governanceClass(bytes32) external pure returns (Types420.GovernanceClass) { return Types420.GovernanceClass.G2_PARAMETER; }
    function isAuthorized(address, bytes32) external view returns (bool) { return authorized; }
    function timelockSatisfied(bytes32) external view returns (bool) { return timelockOk; }
    function emergencyCouncilAuthorized(address, bytes32) external pure returns (bool) { return false; }
}

contract MockPauseRegistryV1 is IPauseRegistry420 {
    bool public paused;
    function setPaused(bool paused_) external { paused = paused_; }
    function isPaused(bytes32, Types420.Direction) external view returns (bool) { return paused; }
    function requireNotPaused(bytes32 scopeId, Types420.Direction) external view {
        if (paused) revert(string(abi.encodePacked("paused:", scopeId)));
    }
}

contract MockSystemSafetyV1 is ISystemSafety420 {
    bool public allowed = true;
    SafetyState public override safetyState = SafetyState.NORMAL;
    bytes32 public override recoveryReference;
    function setAllowed(bool allowed_) external { allowed = allowed_; }
    function setState(SafetyState state_) external { safetyState = state_; }
    function actionAllowed(bytes32, bytes32, ActionClass actionClass) external view returns (bool) {
        if (!allowed) return false;
        if (safetyState == SafetyState.NORMAL) return true;
        if (actionClass == ActionClass.SAFE_WHEN_PAUSED) return safetyState != SafetyState.RECOVERY;
        if (actionClass == ActionClass.WITHDRAWAL_ONLY) return safetyState != SafetyState.NORMAL || allowed;
        return actionClass == ActionClass.RECOVERY_ONLY && safetyState == SafetyState.RECOVERY;
    }
}

contract MockChainContextV1 is IChainContext420 {
    uint256 public override networkId = 420;
    bytes32 public override genesisHash = keccak256("420-test-genesis");
    function chainId() external view returns (uint256) { return block.chainid; }
    function protocolVersion() external pure returns (Types420.Version memory) {
        return Types420.Version({ major: 1, minor: 0, patch: 0 });
    }
}

contract MockCanonicalAssetRegistryV1 is ICanonicalAssetRegistry420 {
    mapping(address => bytes32) public ids;
    mapping(bytes32 => Types420.AssetRef) internal refs;
    mapping(bytes32 => Types420.Lifecycle) internal states;
    function setAsset(address token, bytes32 id) external {
        ids[token] = id;
        refs[id] = Types420.AssetRef({ assetId: id, token: token, decimals: 18, currency: bytes3("CAD"), canonical: true });
        states[id] = Types420.Lifecycle.ACTIVE;
    }
    function asset(bytes32 id) external view returns (Types420.AssetRef memory) { return refs[id]; }
    function lifecycle(bytes32 id) external view returns (Types420.Lifecycle) { return states[id]; }
    function assetIdOf(address token) external view returns (bytes32) { return ids[token]; }
    function isCanonical(bytes32 id) external view returns (bool) { return refs[id].canonical; }
    function isUsable(bytes32 id) external view returns (bool) { return states[id] == Types420.Lifecycle.ACTIVE; }
}

contract MockAssetCapabilitiesV1 is IAssetCapabilities420 {
    mapping(bytes32 => bool) public eligible;
    function setEligible(bytes32 id, bool value) external { eligible[id] = value; }
    function capabilities(bytes32 id) external view returns (Capabilities memory) {
        return Capabilities({
            nativeAsset: false,
            transferExact: eligible[id],
            mintBurn: false,
            pausable: false,
            freezable: false,
            rebasing: false,
            feeOnTransfer: false,
            callbacks: false
        });
    }
    function eligibleForCanonicalSettlement(bytes32 id) external view returns (bool) { return eligible[id]; }
}

contract MockSettlementHealthV1 is ISettlementHealth420 {
    mapping(bytes32 => bool) public assetHealth;
    mapping(bytes32 => bool) public marketHealth;
    mapping(bytes32 => bool) public routeHealth;
    function setAsset(bytes32 id, bool value) external { assetHealth[id] = value; }
    function setMarket(bytes32 id, bool value) external { marketHealth[id] = value; }
    function setRoute(bytes32 id, bool value) external { routeHealth[id] = value; }
    function settlementAssetHealthy(bytes32 id) external view returns (bool) { return assetHealth[id]; }
    function marketHealthy(bytes32 id) external view returns (bool) { return marketHealth[id]; }
    function routeHealthy(bytes32 id) external view returns (bool) { return routeHealth[id]; }
}

contract MockFeeQuoteV1 is IFeeQuote420 {
    uint256 public conversionFee;
    uint256 public protocolFee;
    bool public stale;
    function set(uint256 conversionFee_, uint256 protocolFee_, bool stale_) external {
        conversionFee = conversionFee_; protocolFee = protocolFee_; stale = stale_;
    }
    function feeQuote(bytes32 contextId, bytes calldata) external view returns (FeeQuote memory) {
        uint64 nowTs = uint64(block.timestamp);
        return FeeQuote({
            quoteId: contextId,
            protocolFee: protocolFee,
            networkFee: 0,
            providerFee: 0,
            conversionFee: conversionFee,
            slippageAmount: 0,
            quotedAt: nowTs,
            expiresAt: stale ? nowTs - 1 : nowTs + 42
        });
    }
}

contract MockReplayProtectionV1 is IReplayProtection420 {
    mapping(bytes32 => bool) public consumed;
    function setConsumed(bytes32 id, bool value) external { consumed[id] = value; }
    function nonce(address, bytes32) external pure returns (uint256) { return 0; }
    function isConsumed(bytes32 id) external view returns (bool) { return consumed[id]; }
    function objectDomain(bytes32) external pure returns (bytes32) { return bytes32(0); }
}


contract MockRiskLimitsV1 is IRiskLimits420 {
    uint256 public maximum = type(uint128).max;
    uint256 public used;
    function set(uint256 maximum_, uint256 used_) external { maximum = maximum_; used = used_; }
    function limit(bytes32 subjectId, bytes32 limitType) external view returns (LimitView memory) {
        uint256 remaining = used >= maximum ? 0 : maximum - used;
        return LimitView({
            subjectId: subjectId, limitType: limitType, windowSeconds: 3600,
            maximum: maximum, used: used, remaining: remaining
        });
    }
}

contract MockMetadataCommitmentV1 is IMetadataCommitment420 {
    mapping(bytes32 => MetadataCommitment) internal entries;
    function set(bytes32 id, bytes32 contentHash) external {
        entries[id] = MetadataCommitment({
            schemaId: keccak256("420/test/metadata"),
            contentHash: contentHash,
            encryptionOrReferenceHash: bytes32(0),
            version: 1
        });
    }
    function metadataCommitment(bytes32 id) external view returns (MetadataCommitment memory) { return entries[id]; }
}

contract GenesisMockEnvironment420 {
    MockProtocolRegistryV1 public registry;
    MockGovernanceAuthorityV1 public governance;
    MockPauseRegistryV1 public pause;
    MockSystemSafetyV1 public safety;
    MockChainContextV1 public chain;
    MockCanonicalAssetRegistryV1 public assets;
    MockAssetCapabilitiesV1 public capabilities;
    MockSettlementHealthV1 public health;
    MockFeeQuoteV1 public fees;
    MockReplayProtectionV1 public replay;
    MockMetadataCommitmentV1 public metadata;
    MockRiskLimitsV1 public risk;

    constructor() {
        registry = new MockProtocolRegistryV1();
        governance = new MockGovernanceAuthorityV1();
        pause = new MockPauseRegistryV1();
        safety = new MockSystemSafetyV1();
        chain = new MockChainContextV1();
        assets = new MockCanonicalAssetRegistryV1();
        capabilities = new MockAssetCapabilitiesV1();
        health = new MockSettlementHealthV1();
        fees = new MockFeeQuoteV1();
        replay = new MockReplayProtectionV1();
        metadata = new MockMetadataCommitmentV1();
        risk = new MockRiskLimitsV1();

        registry.set(GenesisInterfaceIds420.GOVERNANCE_AUTHORITY, address(governance));
        registry.set(GenesisInterfaceIds420.PAUSE_REGISTRY, address(pause));
        registry.set(AppDependencyIds420.SYSTEM_SAFETY, address(safety));
        registry.set(AppDependencyIds420.CHAIN_CONTEXT, address(chain));
        registry.set(GenesisInterfaceIds420.CANONICAL_ASSET_REGISTRY, address(assets));
        registry.set(AppDependencyIds420.ASSET_CAPABILITIES, address(capabilities));
        registry.set(GenesisInterfaceIds420.SETTLEMENT_HEALTH, address(health));
        registry.set(AppDependencyIds420.FEE_QUOTE, address(fees));
        registry.set(AppDependencyIds420.REPLAY_PROTECTION, address(replay));
        registry.set(AppDependencyIds420.METADATA_COMMITMENT, address(metadata));
        registry.set(AppDependencyIds420.RISK_LIMITS, address(risk));
    }

    function registerResident(address resident, bytes32 componentId) external { registry.set(componentId, resident); }

    function setSettlementAsset(address token, bytes32 assetId, bool healthy_) external {
        assets.setAsset(token, assetId);
        capabilities.setEligible(assetId, true);
        health.setAsset(assetId, healthy_);
    }
}

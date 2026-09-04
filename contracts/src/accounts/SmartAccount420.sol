// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./ECDSA420.sol";
import "./IEntryPoint420.sol";
import "./SmartAccountScopes420.sol";
import "../interfaces/genesis/ICapabilityRegistry420.sol";
import "../interfaces/genesis/ICapabilityRegistryExtended420.sol";

contract SmartAccount420 {
    bytes4 public constant ERC1271_MAGICVALUE = 0x1626ba7e;
    bytes4 public constant ERC1271_INVALID = 0xffffffff;
    uint48 public constant RECOVERY_DELAY = 2 days;

    bytes4 private constant _ERC20_TRANSFER = 0xa9059cbb;
    bytes4 private constant _ERC20_APPROVE = 0x095ea7b3;
    bytes4 private constant _ERC20_TRANSFER_FROM = 0x23b872dd;

    struct Call {
        address target;
        uint256 value;
        bytes data;
    }

    struct CallAuthorization {
        bytes32 grantId;
        uint256 amount;
        uint48 validAfter;
        uint48 validUntil;
    }

    address public immutable entryPoint;
    ICapabilityRegistryExtended420 public immutable capabilityRegistry;
    bytes32 public immutable accountComponentId;

    address public owner;
    address public recoveryAuthority;
    uint64 public authorizationEpoch = 1;
    uint32 public authorizationPolicyVersion = 1;
    uint64 public grantSequence;

    address public pendingRecoveryOwner;
    uint48 public recoveryExecutableAt;

    mapping(address => uint64) public sessionEpoch;

    event OwnerChanged(address indexed previousOwner, address indexed newOwner);
    event RecoveryAuthorityChanged(address indexed previousAuthority, address indexed newAuthority);
    event RecoveryProposed(address indexed recoveryAuthority, address indexed newOwner, uint48 executableAt);
    event RecoveryCancelled();
    event AuthorizationEpochAdvanced(uint64 indexed newEpoch);
    event AuthorizationPolicyVersionChanged(uint32 indexed previousVersion, uint32 indexed newVersion);
    event SessionKeyEnabled(address indexed key, uint64 indexed epoch);
    event SessionKeyRevoked(address indexed key);
    event SessionGrantCreated(
        bytes32 indexed grantId,
        address indexed key,
        address indexed target,
        bytes4 selector,
        bytes32 scopeHash
    );
    event SponsorGrantCreated(
        bytes32 indexed grantId,
        address indexed sponsor,
        bytes32 indexed operation,
        bytes32 scopeHash
    );
    event Executed(address indexed target, uint256 value, bytes4 selector);

    error NotOwner();
    error NotRecoveryAuthority();
    error NotEntryPoint();
    error NotEntryPointOrOwner();
    error InvalidAddress();
    error InvalidPolicyVersion();
    error InvalidSessionKey();
    error SessionAuthorizationFailed();
    error RecoveryNotReady();
    error CallFailed(bytes returnData);

    constructor(address entryPoint_, address capabilityRegistry_, address owner_, address recoveryAuthority_) payable {
        if (entryPoint_ == address(0) || capabilityRegistry_ == address(0) || owner_ == address(0)) {
            revert InvalidAddress();
        }
        entryPoint = entryPoint_;
        capabilityRegistry = ICapabilityRegistryExtended420(capabilityRegistry_);
        owner = owner_;
        recoveryAuthority = recoveryAuthority_;
        accountComponentId = SmartAccountScopes420.accountComponentId(address(this));
        bytes32 registered = ICapabilityRegistryExtended420(capabilityRegistry_).registerSmartAccount(address(this));
        if (registered != accountComponentId) revert InvalidAddress();
    }

    receive() external payable {}

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyRecoveryAuthority() {
        if (msg.sender != recoveryAuthority || recoveryAuthority == address(0)) revert NotRecoveryAuthority();
        _;
    }

    modifier onlyEntryPoint() {
        if (msg.sender != entryPoint) revert NotEntryPoint();
        _;
    }

    modifier onlyEntryPointOrOwner() {
        if (msg.sender != entryPoint && msg.sender != owner) revert NotEntryPointOrOwner();
        _;
    }

    function execute(address target, uint256 value, bytes calldata data)
        external
        payable
        onlyEntryPointOrOwner
        returns (bytes memory result)
    {
        result = _call(target, value, data);
    }

    function executeBatch(Call[] calldata calls)
        external
        payable
        onlyEntryPointOrOwner
        returns (bytes[] memory results)
    {
        results = new bytes[](calls.length);
        for (uint256 i = 0; i < calls.length; ++i) {
            results[i] = _call(calls[i].target, calls[i].value, calls[i].data);
        }
    }

    /// @notice EntryPoint-only execution envelope for session-key UserOperations.
    /// @dev Validation is intentionally read-only with respect to capability usage.
    ///      Grant consumption occurs here and therefore rolls back atomically if any
    ///      target call reverts. The signer is part of the signed UserOperation calldata
    ///      and is checked against the recovered signer during validateUserOp().
    function executeSession(address signer, Call[] calldata calls)
        external
        payable
        onlyEntryPoint
        returns (bytes[] memory results)
    {
        if (sessionEpoch[signer] != authorizationEpoch) revert InvalidSessionKey();

        Call[] memory callSet = calls;
        (bool ok,,) = _authorizeCallSet(signer, callSet);
        if (!ok) revert SessionAuthorizationFailed();

        for (uint256 i = 0; i < callSet.length; ++i) {
            (bool callOk, CallAuthorization memory authorization) = _resolveCallAuthorization(signer, callSet[i]);
            if (!callOk) revert SessionAuthorizationFailed();
            capabilityRegistry.consume(authorization.grantId, authorization.amount);
        }

        results = new bytes[](callSet.length);
        for (uint256 i = 0; i < callSet.length; ++i) {
            results[i] = _call(callSet[i].target, callSet[i].value, callSet[i].data);
        }
    }

    function enableSessionKey(address key) external onlyOwner {
        if (key == address(0) || key == owner || key == recoveryAuthority) revert InvalidSessionKey();
        sessionEpoch[key] = authorizationEpoch;
        emit SessionKeyEnabled(key, authorizationEpoch);
    }

    function revokeKey(address key) external onlyOwner {
        delete sessionEpoch[key];
        emit SessionKeyRevoked(key);
    }

    function createSessionGrant(
        address key,
        address target,
        bytes4 selector,
        uint256 perCallLimit,
        uint256 periodLimit,
        uint64 periodSeconds,
        uint64 validFrom,
        uint64 validUntil
    ) external onlyOwner returns (bytes32 grantId) {
        if (sessionEpoch[key] != authorizationEpoch || target == address(0) || target == address(this) || target == entryPoint) {
            revert InvalidSessionKey();
        }

        bytes32 scopeHash = SmartAccountScopes420.sessionCallScope(
            address(this), accountComponentId, authorizationEpoch, target, selector
        );
        uint64 sequence = ++grantSequence;
        grantId = SmartAccountScopes420.grantId(address(this), key, scopeHash, sequence);

        capabilityRegistry.createGrant(
            grantId,
            key,
            accountComponentId,
            SmartAccountScopes420.sessionExecuteCapability(),
            scopeHash,
            perCallLimit,
            periodLimit,
            periodSeconds,
            validFrom,
            validUntil
        );
        emit SessionGrantCreated(grantId, key, target, selector, scopeHash);
    }

    function createGasSponsorGrant(
        address sponsor,
        bytes32 operation,
        uint256 perCallLimit,
        uint256 periodLimit,
        uint64 periodSeconds,
        uint64 validFrom,
        uint64 validUntil
    ) external onlyOwner returns (bytes32 grantId) {
        if (sponsor == address(0) || operation == bytes32(0)) revert InvalidAddress();
        bytes32 scopeHash = SmartAccountScopes420.sponsorScope(address(this), operation);
        uint64 sequence = ++grantSequence;
        grantId = SmartAccountScopes420.grantId(address(this), sponsor, scopeHash, sequence);
        capabilityRegistry.createGrant(
            grantId,
            sponsor,
            accountComponentId,
            SmartAccountScopes420.gasSponsorCapability(),
            scopeHash,
            perCallLimit,
            periodLimit,
            periodSeconds,
            validFrom,
            validUntil
        );
        emit SponsorGrantCreated(grantId, sponsor, operation, scopeHash);
    }

    function revokeCapabilityGrant(bytes32 grantId) external onlyOwner {
        capabilityRegistry.revokeGrant(grantId);
    }

    function sessionScope(address target, bytes4 selector) public view returns (bytes32) {
        return SmartAccountScopes420.sessionCallScope(
            address(this), accountComponentId, authorizationEpoch, target, selector
        );
    }

    function isGasSponsorAuthorized(address sponsor, bytes32 operation, uint256 amount) external view returns (bool) {
        return capabilityRegistry.isAuthorized(
            sponsor,
            accountComponentId,
            SmartAccountScopes420.gasSponsorCapability(),
            SmartAccountScopes420.sponsorScope(address(this), operation),
            amount
        );
    }

    function revokeAllAuthorizations() external onlyOwner {
        _advanceAuthorizationEpoch();
    }

    function setAuthorizationPolicyVersion(uint32 newVersion) external onlyOwner {
        if (newVersion <= authorizationPolicyVersion) revert InvalidPolicyVersion();
        uint32 previous = authorizationPolicyVersion;
        authorizationPolicyVersion = newVersion;
        _advanceAuthorizationEpoch();
        emit AuthorizationPolicyVersionChanged(previous, newVersion);
    }

    function setRecoveryAuthority(address newAuthority) external onlyOwner {
        address previous = recoveryAuthority;
        recoveryAuthority = newAuthority;
        pendingRecoveryOwner = address(0);
        recoveryExecutableAt = 0;
        emit RecoveryAuthorityChanged(previous, newAuthority);
    }

    function proposeRecovery(address newOwner) external onlyRecoveryAuthority {
        if (newOwner == address(0) || newOwner == owner) revert InvalidAddress();
        pendingRecoveryOwner = newOwner;
        recoveryExecutableAt = uint48(block.timestamp) + RECOVERY_DELAY;
        emit RecoveryProposed(msg.sender, newOwner, recoveryExecutableAt);
    }

    function cancelRecovery() external onlyOwner {
        pendingRecoveryOwner = address(0);
        recoveryExecutableAt = 0;
        emit RecoveryCancelled();
    }

    function finalizeRecovery() external onlyRecoveryAuthority {
        address newOwner = pendingRecoveryOwner;
        if (newOwner == address(0) || block.timestamp < recoveryExecutableAt) revert RecoveryNotReady();

        address previous = owner;
        owner = newOwner;
        pendingRecoveryOwner = address(0);
        recoveryExecutableAt = 0;
        _advanceAuthorizationEpoch();
        emit OwnerChanged(previous, newOwner);
    }

    function validateUserOp(PackedUserOperation420 calldata userOp, bytes32 userOpHash, uint256 missingAccountFunds)
        external
        returns (uint256 validationData)
    {
        if (msg.sender != entryPoint || userOp.sender != address(this)) return 1;

        address signer = ECDSA420.tryRecover(ECDSA420.toEthSignedMessageHash(userOpHash), userOp.signature);
        if (signer == address(0)) return 1;

        if (signer == owner) {
            if (uint192(userOp.nonce >> 64) != 0) return 1;
            validationData = 0;
        } else {
            if (sessionEpoch[signer] != authorizationEpoch) return 1;
            if (uint192(userOp.nonce >> 64) != uint192(uint160(signer))) return 1;
            (bool ok, uint48 validAfter, uint48 validUntil) = _authorizeSessionCalls(signer, userOp.callData);
            if (!ok) return 1;
            validationData = _packValidationData(validUntil, validAfter);
        }

        if (missingAccountFunds != 0) {
            (bool ok,) = payable(msg.sender).call{value: missingAccountFunds}("");
            ok;
        }
    }

    function isValidSignature(bytes32 hash, bytes calldata signature) external view returns (bytes4) {
        address signer = ECDSA420.tryRecover(ECDSA420.toEthSignedMessageHash(hash), signature);
        return signer == owner ? ERC1271_MAGICVALUE : ERC1271_INVALID;
    }

    function nonce(uint192 key) external view returns (uint256) {
        return IEntryPoint420(entryPoint).getNonce(address(this), key);
    }

    function _authorizeSessionCalls(address signer, bytes calldata callData)
        internal
        view
        returns (bool ok, uint48 validAfter, uint48 validUntil)
    {
        if (callData.length < 4) return (false, 0, 0);
        bytes4 selector = bytes4(callData[:4]);
        if (selector != this.executeSession.selector) return (false, 0, 0);

        (address encodedSigner, Call[] memory calls) = abi.decode(callData[4:], (address, Call[]));
        if (encodedSigner != signer) return (false, 0, 0);
        return _authorizeCallSet(signer, calls);
    }

    function _authorizeCallSet(address signer, Call[] memory calls)
        internal
        view
        returns (bool ok, uint48 validAfter, uint48 validUntil)
    {
        if (calls.length == 0) return (false, 0, 0);

        bytes32[] memory uniqueGrantIds = new bytes32[](calls.length);
        uint256[] memory totals = new uint256[](calls.length);
        uint256 uniqueCount;

        for (uint256 i = 0; i < calls.length; ++i) {
            (bool callOk, CallAuthorization memory authorization) = _resolveCallAuthorization(signer, calls[i]);
            if (!callOk) return (false, 0, 0);

            if (authorization.validAfter > validAfter) validAfter = authorization.validAfter;
            if (authorization.validUntil != 0 && (validUntil == 0 || authorization.validUntil < validUntil)) {
                validUntil = authorization.validUntil;
            }

            uniqueCount = _accumulateGrant(
                uniqueGrantIds,
                totals,
                uniqueCount,
                authorization.grantId,
                authorization.amount
            );
        }

        for (uint256 i = 0; i < uniqueCount; ++i) {
            if (!_aggregateWithinPeriodLimit(uniqueGrantIds[i], totals[i])) return (false, 0, 0);
        }

        return (true, validAfter, validUntil);
    }

    function _resolveCallAuthorization(address signer, Call memory call_)
        private
        view
        returns (bool ok, CallAuthorization memory authorization)
    {
        if (call_.target == address(0) || call_.target == address(this) || call_.target == entryPoint) {
            return (false, authorization);
        }

        bytes4 targetSelector = _selector(call_.data);
        uint256 tokenAmount = _tokenSpend(targetSelector, call_.data);
        if (tokenAmount == type(uint256).max || (tokenAmount != 0 && call_.value != 0)) {
            return (false, authorization);
        }

        authorization.amount = tokenAmount != 0 ? tokenAmount : call_.value;
        bytes32 scopeHash = SmartAccountScopes420.sessionCallScope(
            address(this), accountComponentId, authorizationEpoch, call_.target, targetSelector
        );
        bytes32 capabilityId = SmartAccountScopes420.sessionExecuteCapability();
        authorization.grantId = capabilityRegistry.activeGrantId(
            signer, accountComponentId, capabilityId, scopeHash
        );
        if (authorization.grantId == bytes32(0)) return (false, authorization);
        if (!capabilityRegistry.isAuthorized(
            signer,
            accountComponentId,
            capabilityId,
            scopeHash,
            authorization.amount
        )) {
            return (false, authorization);
        }

        ICapabilityRegistry420.CapabilityGrant memory grant_ = capabilityRegistry.grant(authorization.grantId);
        authorization.validAfter = uint48(grant_.validFrom);
        authorization.validUntil = uint48(grant_.validUntil);
        return (true, authorization);
    }

    function _accumulateGrant(
        bytes32[] memory uniqueGrantIds,
        uint256[] memory totals,
        uint256 uniqueCount,
        bytes32 grantId,
        uint256 amount
    ) private pure returns (uint256) {
        for (uint256 i = 0; i < uniqueCount; ++i) {
            if (uniqueGrantIds[i] == grantId) {
                totals[i] += amount;
                return uniqueCount;
            }
        }
        uniqueGrantIds[uniqueCount] = grantId;
        totals[uniqueCount] = amount;
        return uniqueCount + 1;
    }

    function _aggregateWithinPeriodLimit(bytes32 grantId, uint256 total) private view returns (bool) {
        ICapabilityRegistry420.CapabilityGrant memory grant_ = capabilityRegistry.grant(grantId);
        if (grant_.periodLimit == 0) return true;
        ICapabilityRegistryExtended420.UsageView memory usage_ = capabilityRegistry.usage(grantId);
        if (usage_.used > grant_.periodLimit) return false;
        return total <= grant_.periodLimit - usage_.used;
    }

    function _advanceAuthorizationEpoch() internal {
        unchecked { ++authorizationEpoch; }
        if (authorizationEpoch == 0) authorizationEpoch = 1;
        emit AuthorizationEpochAdvanced(authorizationEpoch);
    }

    function _selector(bytes memory data) internal pure returns (bytes4 selector) {
        if (data.length >= 4) {
            assembly { selector := mload(add(data, 32)) }
        }
    }

    function _tokenSpend(bytes4 selector, bytes memory data) internal pure returns (uint256 amount) {
        if (selector == _ERC20_TRANSFER || selector == _ERC20_APPROVE) {
            if (data.length < 68) return type(uint256).max;
            assembly { amount := mload(add(data, 68)) }
        } else if (selector == _ERC20_TRANSFER_FROM) {
            if (data.length < 100) return type(uint256).max;
            assembly { amount := mload(add(data, 100)) }
        }
    }

    function _packValidationData(uint48 validUntil, uint48 validAfter) internal pure returns (uint256) {
        return (uint256(validUntil) << 160) | (uint256(validAfter) << 208);
    }

    function _call(address target, uint256 value, bytes memory data) internal returns (bytes memory result) {
        if (target == address(0)) revert InvalidAddress();
        (bool ok, bytes memory returnData) = target.call{value: value}(data);
        if (!ok) revert CallFailed(returnData);
        emit Executed(target, value, _selector(data));
        return returnData;
    }
}

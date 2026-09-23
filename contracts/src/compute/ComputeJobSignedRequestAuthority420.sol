// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./ComputeJobRegistry420.sol";

/// @notice EIP-712 requester AND payer consent for an immutable compute manifest.
/// @dev This authenticates a funding ceiling, NOT actual payment or an escrow reservation.
/// Deploy this authority as the ComputeJobRegistry420 requestEvidence endpoint for signed jobs.
contract ComputeJobSignedRequestAuthority420 is IComputeJobRequestEvidence420 {
    bytes32 public constant DOMAIN_TYPEHASH = keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 public constant REQUEST_TYPEHASH = keccak256("ComputeRequest(address owner,address payer,bytes32 manifestHash,bytes32 workloadType,bytes32 inputCommitment,bytes32 outputSchemaCommitment,uint64 deadline,uint64 authorizationExpiry,uint256 maxSpend,uint256 nonce)");
    bytes32 private constant NAME_HASH = keccak256("420 Compute Request");
    bytes32 private constant VERSION_HASH = keccak256("1");
    bytes4 private constant ERC1271_MAGIC = 0x1626ba7e;
    uint256 private constant SECP256K1_HALF_N = 0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0;

    struct Authorization {
        address owner;
        address payer;
        bytes32 manifestHash;
        bytes32 workloadType;
        bytes32 inputCommitment;
        bytes32 outputSchemaCommitment;
        uint64 deadline;
        uint64 authorizationExpiry;
        uint256 maxSpend;
        uint256 nonce;
    }
    struct Request {
        address owner;
        address payer;
        bytes32 requestCommitment;
        bytes32 manifestHash;
        bytes32 workloadType;
        bytes32 inputCommitment;
        bytes32 outputSchemaCommitment;
        uint64 deadline;
        uint64 authorizationExpiry;
        uint256 maxSpend;
        uint256 nonce;
        bool exists;
    }

    mapping(address => mapping(uint256 => bool)) public usedNonce;
    mapping(bytes32 => Request) private _requests;

    error InvalidAuthorization();
    error InvalidSignature();
    error AuthorizationReplayed();
    event RequestAuthorized(bytes32 indexed requestId, address indexed owner, address indexed payer,
        bytes32 requestCommitment, uint256 maxSpend, uint64 authorizationExpiry, uint256 nonce);

    function domainSeparator() public view returns (bytes32) {
        return keccak256(abi.encode(DOMAIN_TYPEHASH, NAME_HASH, VERSION_HASH, block.chainid, address(this)));
    }

    function authorizationDigest(Authorization calldata a) public view returns (bytes32) {
        bytes32 structHash = keccak256(abi.encode(REQUEST_TYPEHASH, a.owner, a.payer,
            a.manifestHash, a.workloadType, a.inputCommitment, a.outputSchemaCommitment,
            a.deadline, a.authorizationExpiry, a.maxSpend, a.nonce));
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator(), structHash));
    }

    /// @notice Both the creator and payer explicitly authorize the same immutable terms.
    /// @dev EOA signatures use canonical low-s ECDSA; contract accounts use ERC-1271.
    function registerSignedRequest(Authorization calldata a, bytes calldata ownerSignature,
        bytes calldata payerSignature) external returns (bytes32 requestId) {
        if (a.owner == address(0) || a.payer == address(0) || msg.sender != a.owner
            || a.manifestHash == bytes32(0) || a.workloadType == bytes32(0)
            || a.inputCommitment == bytes32(0) || a.outputSchemaCommitment == bytes32(0)
            || a.maxSpend == 0 || a.deadline <= block.timestamp
            || a.authorizationExpiry < block.timestamp || a.authorizationExpiry < a.deadline)
            revert InvalidAuthorization();
        if (usedNonce[a.owner][a.nonce]) revert AuthorizationReplayed();
        bytes32 digest = authorizationDigest(a);
        if (!_validSignature(a.owner, digest, ownerSignature)
            || !_validSignature(a.payer, digest, payerSignature)) revert InvalidSignature();
        requestId = digest;
        if (_requests[requestId].exists) revert AuthorizationReplayed();
        usedNonce[a.owner][a.nonce] = true;
        _requests[requestId] = Request(a.owner, a.payer, digest, a.manifestHash, a.workloadType,
            a.inputCommitment, a.outputSchemaCommitment, a.deadline, a.authorizationExpiry,
            a.maxSpend, a.nonce, true);
        emit RequestAuthorized(requestId, a.owner, a.payer, digest, a.maxSpend, a.authorizationExpiry, a.nonce);
    }

    function getRequest(bytes32 requestId) external view returns (Request memory r) {
        r = _requests[requestId];
        if (!r.exists) revert InvalidAuthorization();
    }

    /// @notice Separate payer and authorized maximum for canonical future escrow admission.
    function fundingTerms(bytes32 requestId) external view returns (address payer, uint256 maxSpend) {
        Request storage r = _requests[requestId];
        if (!r.exists || block.timestamp > r.authorizationExpiry) revert InvalidAuthorization();
        return (r.payer, r.maxSpend);
    }

    function validRequest(bytes32 requestId, address owner, bytes32 requestCommitment,
        bytes32 manifestHash, bytes32 workloadType, bytes32 inputCommitment,
        bytes32 outputSchemaCommitment, uint64 deadline) external view returns (bool) {
        Request storage r = _requests[requestId];
        return r.exists && requestId != bytes32(0) && r.owner == owner && owner != address(0)
            && r.requestCommitment == requestCommitment && r.manifestHash == manifestHash
            && r.workloadType == workloadType && r.inputCommitment == inputCommitment
            && r.outputSchemaCommitment == outputSchemaCommitment && r.deadline == deadline
            && r.maxSpend > 0 && r.payer != address(0) && block.timestamp <= r.authorizationExpiry
            && block.timestamp < r.deadline;
    }

    function _validSignature(address signer, bytes32 digest, bytes calldata signature) private view returns (bool) {
        if (signer.code.length != 0) {
            (bool success, bytes memory result) = signer.staticcall(
                abi.encodeWithSelector(ERC1271_MAGIC, digest, signature));
            return success && result.length >= 32 && abi.decode(result, (bytes4)) == ERC1271_MAGIC;
        }
        if (signature.length != 65) return false;
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }
        if (v != 27 && v != 28) return false;
        if (uint256(s) == 0 || uint256(s) > SECP256K1_HALF_N || r == bytes32(0)) return false;
        return ecrecover(digest, v, r, s) == signer;
    }
}

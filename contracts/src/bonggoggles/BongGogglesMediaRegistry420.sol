// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./BongGogglesAuthorization420.sol";
import "./BongGogglesProfileRegistry420.sol";
import "./BongGogglesIds420.sol";

contract BongGogglesMediaRegistry420 {
    struct MediaManifest {
        bytes32 mediaRoot;
        address owner;
        BongGogglesTypes420.MediaType mediaType;
        bytes32 manifestHash;
        uint32 itemCount;
        uint64 createdAt;
        bool exists;
    }

    BongGogglesAuthorization420 public immutable authorization;
    BongGogglesProfileRegistry420 public immutable profiles;

    mapping(bytes32 => MediaManifest) private _manifests;
    mapping(address => uint256) public ownerNonce;

    error Unauthorized();
    error ZeroAddress();
    error ProfileInactive();
    error InvalidManifest();
    error ManifestMissing();

    event MediaManifestRegistered(
        bytes32 indexed mediaRoot,
        address indexed owner,
        BongGogglesTypes420.MediaType mediaType,
        bytes32 manifestHash,
        uint32 itemCount,
        address operator
    );

    constructor(address authorization_, address profiles_) {
        if (authorization_ == address(0) || profiles_ == address(0)) revert ZeroAddress();
        authorization = BongGogglesAuthorization420(authorization_);
        profiles = BongGogglesProfileRegistry420(profiles_);
    }

    function mediaManifest(bytes32 mediaRoot) external view returns (MediaManifest memory) {
        return _manifests[mediaRoot];
    }

    function registerManifest(
        address owner,
        BongGogglesTypes420.MediaType mediaType,
        bytes32 manifestHash,
        uint32 itemCount
    ) external returns (bytes32 mediaRoot) {
        if (owner == address(0)) revert ZeroAddress();
        if (!profiles.isActive(owner)) revert ProfileInactive();
        if (!authorization.canActFor(msg.sender, owner, BongGogglesIds420.ACTION_MEDIA_REGISTER)) revert Unauthorized();
        if (manifestHash == bytes32(0) || itemCount == 0) revert InvalidManifest();

        uint256 nonce = ++ownerNonce[owner];
        mediaRoot = keccak256(
            abi.encode(
                "420/BONG_GOGGLES/MEDIA_MANIFEST/V1",
                block.chainid,
                owner,
                nonce,
                mediaType,
                manifestHash,
                itemCount
            )
        );
        _manifests[mediaRoot] = MediaManifest(
            mediaRoot,
            owner,
            mediaType,
            manifestHash,
            itemCount,
            uint64(block.timestamp),
            true
        );
        emit MediaManifestRegistered(mediaRoot, owner, mediaType, manifestHash, itemCount, msg.sender);
    }

    function isValidManifest(bytes32 mediaRoot, address expectedOwner) external view returns (bool) {
        MediaManifest storage m = _manifests[mediaRoot];
        return m.exists && m.owner == expectedOwner;
    }
}

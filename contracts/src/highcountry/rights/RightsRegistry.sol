// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import {R04EmergencyConsumer} from "../security/R04EmergencyConsumer.sol";
import {EmergencyDomains} from "../constants/EmergencyDomains.sol";

/// @notice R04.9 immutable parcel/asset rights authority: no wallet entitlement, treasury or token custody.
/// @dev Licensed scopes are bitmasks; rights are bounded by term and owner consent.
contract RightsRegistry is R04EmergencyConsumer {
    error Unauthorized();
    error Invalid();
    error Inactive();

    struct Asset {
        address owner;
        bool exists;
        bool frozen;
    }

    struct Grant {
        bytes32 asset;
        address issuer;
        address holder;
        uint256 scopes;
        uint64 start;
        uint64 end;
        bool revoked;
    }
    address public immutable administrator;
    mapping(bytes32 => Asset) public assets;
    mapping(bytes32 => Grant) public grants;
    event AssetRegistered(bytes32 indexed asset, address indexed owner);
    event AssetFrozen(bytes32 indexed asset, bool frozen);
    event RightsGranted(
        bytes32 indexed grantId, bytes32 indexed asset, address indexed holder, uint256 scopes, uint64 start, uint64 end
    );
    event RightsRevoked(bytes32 indexed grantId);
    event AssetTransferred(bytes32 indexed asset, address indexed oldOwner, address indexed newOwner);

    constructor() {
        administrator = msg.sender;
    }

    function registerAsset(
        bytes32 asset,
        address owner
    ) external  r04Unrestricted(EmergencyDomains.RIGHTS) {
        if (msg.sender != administrator || asset == bytes32(0) || owner == address(0) || assets[asset].exists) {
            revert Invalid();
        }
        assets[asset] = Asset(owner, true, false);
        emit AssetRegistered(asset, owner);
    }

    function freeze(
        bytes32 asset,
        bool frozen
    ) external {
        if (!frozen && !r04DomainOpen(EmergencyDomains.RIGHTS)) revert R04Restricted(EmergencyDomains.RIGHTS);
        if (msg.sender != administrator || !assets[asset].exists) revert Unauthorized();
        assets[asset].frozen = frozen;
        emit AssetFrozen(asset, frozen);
    }

    function transferAsset(
        bytes32 asset,
        address to
    ) external  r04Unrestricted(EmergencyDomains.RIGHTS) {
        Asset storage a = assets[asset];
        if (!a.exists || a.frozen || a.owner != msg.sender || to == address(0) || to == msg.sender) {
            revert Unauthorized();
        }
        address previous = a.owner;
        a.owner = to;
        emit AssetTransferred(asset, previous, to);
    }

    function grant(
        bytes32 grantId,
        bytes32 asset,
        address holder,
        uint256 scopes,
        uint64 start,
        uint64 end
    ) external  r04Unrestricted(EmergencyDomains.RIGHTS) {
        Asset memory a = assets[asset];
        if (
            grantId == bytes32(0) || grants[grantId].holder != address(0) || !a.exists || a.frozen
                || msg.sender != a.owner || holder == address(0) || scopes == 0 || end <= start
                || end <= block.timestamp
        ) revert Invalid();
        grants[grantId] = Grant(asset, msg.sender, holder, scopes, start, end, false);
        emit RightsGranted(grantId, asset, holder, scopes, start, end);
    }

    function revoke(
        bytes32 grantId
    ) external {
        Grant storage g = grants[grantId];
        if (g.holder == address(0) || g.revoked || msg.sender != assets[g.asset].owner) revert Unauthorized();
        g.revoked = true;
        emit RightsRevoked(grantId);
    }

    function hasRight(
        bytes32 grantId,
        address holder,
        uint256 scope
    ) external view returns (bool) {
        if (!r04DomainOpen(EmergencyDomains.RIGHTS)) return false;
        Grant memory g = grants[grantId];
        Asset memory a = assets[g.asset];
        return a.exists && !a.frozen && a.owner == g.issuer && !g.revoked && g.holder == holder && scope != 0
            && (g.scopes & scope) == scope && block.timestamp >= g.start && block.timestamp < g.end;
    }
}


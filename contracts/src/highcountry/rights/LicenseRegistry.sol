// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import { RightsRegistry } from "./RightsRegistry.sol";

/// @notice R04.9 bounded and revocable access licenses; no payment settlement or statutory licensing claims.
contract LicenseRegistry {
    error InvalidLicense();

    struct License {
        bytes32 asset;
        address issuer;
        address licensee;
        uint256 scopes;
        uint64 start;
        uint64 end;
        uint256 feeUnits;
        bool revoked;
    }
    RightsRegistry public immutable rights;
    mapping(bytes32 => License) public licenses;
    event Issued(
        bytes32 indexed id,
        bytes32 indexed asset,
        address indexed licensee,
        uint256 scopes,
        uint64 end,
        uint256 feeUnits
    );
    event Revoked(bytes32 indexed id);
    event Transferred(bytes32 indexed id, address indexed from, address indexed to);

    constructor(
        address rights_
    ) {
        if (rights_ == address(0) || rights_.code.length == 0) revert InvalidLicense();
        rights = RightsRegistry(rights_);
    }

    function issue(
        bytes32 id,
        bytes32 asset,
        address licensee,
        uint256 scopes,
        uint64 start,
        uint64 end,
        uint256 feeUnits
    ) external {
        (address owner, bool exists, bool frozen) = rights.assets(asset);
        if (
            id == bytes32(0) || licenses[id].issuer != address(0) || !exists || frozen || owner != msg.sender
                || licensee == address(0) || scopes == 0 || end <= start || end <= block.timestamp
        ) revert InvalidLicense();
        licenses[id] = License(asset, msg.sender, licensee, scopes, start, end, feeUnits, false);
        emit Issued(id, asset, licensee, scopes, end, feeUnits);
    }

    function usable(
        bytes32 id,
        address who,
        uint256 required
    ) external view returns (bool) {
        License memory l = licenses[id];
        (address owner, bool exists, bool frozen) = rights.assets(l.asset);
        return l.issuer != address(0) && !l.revoked && exists && !frozen && owner == l.issuer && l.licensee == who
            && required != 0 && (l.scopes & required) == required && block.timestamp >= l.start
            && block.timestamp < l.end;
    }

    function revoke(
        bytes32 id
    ) external {
        License storage l = licenses[id];
        if (l.issuer != msg.sender || l.revoked) revert InvalidLicense();
        l.revoked = true;
        emit Revoked(id);
    }

    function transfer(
        bytes32 id,
        address to
    ) external {
        License storage l = licenses[id];
        (address owner, bool exists, bool frozen) = rights.assets(l.asset);
        if (
            l.licensee != msg.sender || l.revoked || !exists || frozen || owner != l.issuer || to == address(0)
                || to == msg.sender || block.timestamp >= l.end
        ) revert InvalidLicense();
        address from = l.licensee;
        l.licensee = to;
        emit Transferred(id, from, to);
    }
}

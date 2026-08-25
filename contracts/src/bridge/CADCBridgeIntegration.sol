// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/GenesisResidentAccess420.sol";
import "../interfaces/genesis/Types420.sol";
import "../interfaces/genesis/ISystemSafety420.sol";
import "./BridgeIds420.sol";

/// @notice Registry/guard for an issuer-approved CADC LayerZero pathway on 420.
/// @dev It never mints, burns, custodies, wraps, or impersonates CADC.
contract CADCBridgeIntegration is GenesisResidentAccess420 {
    address public cadc;
    address public layerZeroEndpoint;
    address public issuerOFT;
    bool public active;
    bytes32 public securityConfigHash;
    bytes32 public peerConfigHash;

    event CADCPathConfigured(
        address indexed cadc,
        address indexed endpoint,
        address indexed issuerOFT,
        bytes32 securityConfigHash,
        bytes32 peerConfigHash
    );
    event CADCPathActive(bool active);

    constructor(address timelock_, address registry_, bytes32 genesisConfigHash_)
        GenesisResidentAccess420(timelock_, registry_, genesisConfigHash_)
    {}

    function componentId() public pure override returns (bytes32) { return BridgeIds420.CADC_INTEGRATION; }

    function configure(
        address cadc_,
        address endpoint_,
        address issuerOFT_,
        bytes32 securityConfigHash_,
        bytes32 peerConfigHash_
    ) external {
        _requireGenesisGovernance(BridgeIds420.ACTION_CONFIGURE);
        require(!active, "deactivate first");
        require(cadc_ != address(0) && endpoint_ != address(0) && issuerOFT_ != address(0), "zero");
        require(cadc_.code.length != 0 && endpoint_.code.length != 0 && issuerOFT_.code.length != 0, "code");
        require(securityConfigHash_ != bytes32(0) && peerConfigHash_ != bytes32(0), "config hash");
        cadc = cadc_;
        layerZeroEndpoint = endpoint_;
        issuerOFT = issuerOFT_;
        securityConfigHash = securityConfigHash_;
        peerConfigHash = peerConfigHash_;
        emit CADCPathConfigured(cadc_, endpoint_, issuerOFT_, securityConfigHash_, peerConfigHash_);
    }

    function setActive(bool active_) external {
        _requireGenesisGovernance(BridgeIds420.ACTION_CONFIGURE);
        if (active_) {
            _requireOperational(
                BridgeIds420.ACTION_INBOUND,
                ISystemSafety420.ActionClass.NORMAL_ONLY,
                Types420.Direction.INBOUND
            );
            require(cadc != address(0) && layerZeroEndpoint != address(0) && issuerOFT != address(0), "unconfigured");
            require(securityConfigHash != bytes32(0) && peerConfigHash != bytes32(0), "unverified");
        }
        active = active_;
        emit CADCPathActive(active_);
    }
}

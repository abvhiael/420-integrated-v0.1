// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

struct CADCOrigin420 {
    uint32 srcEid;
    bytes32 sender;
    uint64 nonce;
}

struct CADCUln420 {
    uint64 confirmations;
    uint8 requiredDVNCount;
    uint8 optionalDVNCount;
    uint8 optionalDVNThreshold;
    address[] requiredDVNs;
    address[] optionalDVNs;
}

struct CADCSend420 {
    uint32 dstEid;
    bytes32 to;
    uint256 amountLD;
    uint256 minAmountLD;
    bytes extraOptions;
    bytes composeMsg;
    bytes oftCmd;
}

struct CADCFee420 {
    uint256 nativeFee;
    uint256 lzTokenFee;
}

struct CADCReceipt420 {
    bytes32 guid;
    uint64 nonce;
    CADCFee420 fee;
}

struct CADCAmounts420 {
    uint256 amountSentLD;
    uint256 amountReceivedLD;
}

interface ICADCEndpoint420 {
    function eid() external view returns (uint32);
    function getReceiveLibrary(address, uint32) external view returns (address, bool);
    function getSendLibrary(address, uint32) external view returns (address);
    function lzReceive(CADCOrigin420 calldata, address, bytes32, bytes calldata, bytes calldata) external payable;
}

interface ICADCUln420 {
    function getUlnConfig(address, uint32) external view returns (CADCUln420 memory);
    function commitVerification(bytes calldata, bytes32) external;
}

interface ICADCOFT420 {
    function endpoint() external view returns (address);
    function peers(uint32) external view returns (bytes32);
    function token() external view returns (address);
    function decimalConversionRate() external view returns (uint256);
    function approvalRequired() external view returns (bool);
    function send(CADCSend420 calldata, CADCFee420 calldata, address)
        external
        payable
        returns (CADCReceipt420 memory, CADCAmounts420 memory);
}

interface ICADCToken420 {
    function balanceOf(address) external view returns (uint256);
    function transferFrom(address, address, uint256) external returns (bool);
    function approve(address, uint256) external returns (bool);
}

interface ICADCIntegration420 {
    function requireActive() external view;
    function active() external view returns (bool);
    function cadc() external view returns (address);
    function layerZeroEndpoint() external view returns (address);
    function issuerOFT() external view returns (address);
    function securityConfigHash() external view returns (bytes32);
    function peerConfigHash() external view returns (bytes32);
}

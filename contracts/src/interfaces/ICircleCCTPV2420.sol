// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
interface ICircleCCTPProxy420 {function implementation() external view returns(address);}
interface ICircleMessageTransmitterV2420 {
    function localDomain() external view returns(uint32);
    function version() external view returns(uint32);
    function receiveMessage(bytes calldata,bytes calldata) external returns(bool);
    function usedNonces(bytes32) external view returns(uint256);
    function signatureThreshold() external view returns(uint256);
    function isEnabledAttester(address) external view returns(bool);
}
interface ICircleTokenMessengerV2420 {
    function localMessageTransmitter() external view returns(address);
    function messageBodyVersion() external view returns(uint32);
    function localMinter() external view returns(address);
    function remoteTokenMessengers(uint32) external view returns(bytes32);
    function feeRecipient() external view returns(address);
    function depositForBurn(uint256,uint32,bytes32,address,bytes32,uint256,uint32) external;
    function depositForBurnWithHook(uint256,uint32,bytes32,address,bytes32,uint256,uint32,bytes calldata) external;
}
interface ICircleTokenMinterV2420 {function getLocalToken(uint32,bytes32) external view returns(address);}
interface ICCTPUSDC420 {
    function decimals() external view returns(uint8);
    function balanceOf(address) external view returns(uint256);
    function allowance(address,address) external view returns(uint256);
    function transferFrom(address,address,uint256) external returns(bool);
    function approve(address,uint256) external returns(bool);
}

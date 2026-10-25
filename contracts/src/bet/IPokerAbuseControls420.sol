// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
interface IPokerAbuseControls420 {
    function ledgerAddress() external view returns(address);
    function dealsAddress() external view returns(address);
    function policyHash(bytes32 tableId) external view returns(bytes32);
    function checkDeposit(bytes32 tableId,address player,uint8 seat) external view;
    function checkReturn(bytes32 tableId,address player) external view;
    function checkParticipants(bytes32 tableId,uint16 mask) external view;
    function noteDealRequested(bytes32 tableId,bytes32 handId) external;
    function admitHand(bytes32 tableId,bytes32 handId,uint16 mask) external returns(bytes32);
}

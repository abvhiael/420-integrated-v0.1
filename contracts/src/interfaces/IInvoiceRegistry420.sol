
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface IInvoiceRegistry420 {
    function merchantOf(bytes32 invoiceId) external view returns(address);
    function amountOf(bytes32 invoiceId) external view returns(uint256);
    function expiresAtOf(bytes32 invoiceId) external view returns(uint64);
    function isClosed(bytes32 invoiceId) external view returns(bool);
    function markPaid(bytes32 invoiceId,uint256 amount) external;
}

// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./LaunchpadSaleRegistry420.sol";
import "./LaunchpadAllocationRegistry420.sol";

contract LaunchpadRouter420 {
    LaunchpadSaleRegistry420 public immutable sales; LaunchpadAllocationRegistry420 public immutable allocations;
    constructor(address sales_,address allocations_){require(sales_!=address(0)&&allocations_!=address(0),"dependency");sales=LaunchpadSaleRegistry420(sales_);allocations=LaunchpadAllocationRegistry420(allocations_);}
    function remainingSaleCapacity(bytes32 saleId) external view returns(uint256){ LaunchpadSaleRegistry420.Sale memory s=sales.sale(saleId); return uint256(s.hardCap)-s.raised; }
    function remainingWalletCapacity(bytes32 saleId,address participant) external view returns(uint256){ LaunchpadSaleRegistry420.Sale memory s=sales.sale(saleId); uint256 used=allocations.contributed(saleId,participant); return used>=s.perWalletCap?0:uint256(s.perWalletCap)-used; }
}

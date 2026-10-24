// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./PokerNLHEModules420.sol";

// Linked deployment libraries keep each module's creation code out of the
// engine initcode, enforcing both EIP-170 and EIP-3860 deployment limits.
library PokerNLHEAdmissionFactory420 {
    function deploy(address d,address s,address k,address c,address host) external returns(address){
        return address(new PokerNLHEAdmissionModule420(d,s,k,c,host));
    }
}
library PokerNLHEPlayFactory420 {
    function deploy(address d,address s,address k,address c,address host) external returns(address){
        return address(new PokerNLHEPlayModule420(d,s,k,c,host));
    }
}
library PokerNLHECustodyFactory420 {
    function deploy(address d,address s,address k,address c,address host) external returns(address){
        return address(new PokerNLHECustodyModule420(d,s,k,c,host));
    }
}
library PokerNLHESettlementFactory420 {
    function deploy(address d,address s,address k,address c,address host) external returns(address){
        return address(new PokerNLHESettlementModule420(d,s,k,c,host));
    }
}

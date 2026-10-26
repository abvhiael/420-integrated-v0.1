// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./PokerTournamentPurchasePaymentModule420.sol";
library PokerTournamentPurchasePaymentFactory420 {function deploy(address p,address i,bytes32 issuer_,bytes32 type_,address d,address b)external returns(address){return address(new PokerTournamentPurchasePaymentModule420(p,i,issuer_,type_,d,b));}}

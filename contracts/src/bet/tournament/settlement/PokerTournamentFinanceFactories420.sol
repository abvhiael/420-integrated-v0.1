// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./PokerTournamentPrizeModule420.sol";
import "./PokerTournamentRefundModule420.sol";
library PokerTournamentPrizeFactory420 {function deploy(address p,address i,bytes32 issuer_,bytes32 type_,address d,address f,address bank)external returns(address){return address(new PokerTournamentPrizeModule420(p,i,issuer_,type_,d,f,bank));}}
library PokerTournamentRefundFactory420 {function deploy(address p,address i,bytes32 issuer_,bytes32 type_,address d,address f,address bank)external returns(address){return address(new PokerTournamentRefundModule420(p,i,issuer_,type_,d,f,bank));}}

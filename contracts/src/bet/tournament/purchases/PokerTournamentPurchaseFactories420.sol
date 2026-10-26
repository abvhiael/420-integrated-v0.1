// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../PokerTournamentHostFactories420.sol";
import "./PokerTournamentPurchasesConfiguration420.sol";
import "./PokerTournamentQueuedAdmissions420.sol";
import "./PokerTournamentChipPurchases420.sol";
import "./PokerTournamentPurchaseRounds420.sol";
import "./PokerTournamentPurchaseClosure420.sol";
library PokerTournamentPurchasesConfigurationFactory420 {function deploy(address e,address b,address x,address h)external returns(address){return address(new PokerTournamentPurchasesConfiguration420(e,b,x,h));}}
library PokerTournamentQueuedAdmissionsFactory420 {function deploy(address e,address b,address x,address h)external returns(address){return address(new PokerTournamentQueuedAdmissions420(e,b,x,h));}}
library PokerTournamentChipPurchasesFactory420 {function deploy(address e,address b,address x,address h)external returns(address){return address(new PokerTournamentChipPurchases420(e,b,x,h));}}
library PokerTournamentPurchaseRoundsFactory420 {function deploy(address e,address b,address x,address h)external returns(address){return address(new PokerTournamentPurchaseRounds420(e,b,x,h));}}
library PokerTournamentPurchaseClosureFactory420 {function deploy(address e,address b,address x,address h)external returns(address){return address(new PokerTournamentPurchaseClosure420(e,b,x,h));}}

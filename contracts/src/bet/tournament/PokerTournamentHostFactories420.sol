// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./PokerTournamentHostConfiguration420.sol";
import "./PokerTournamentHostAdmission420.sol";
import "./PokerTournamentHostLedger420.sol";
import "./PokerTournamentHostRounds420.sol";
import "./PokerTournamentHostBalance420.sol";
library PokerTournamentHostConfigurationFactory420 {function deploy(address e,address b,address x,address h)external returns(address){return address(new PokerTournamentHostConfiguration420(e,b,x,h));}}
library PokerTournamentHostAdmissionFactory420 {function deploy(address e,address b,address x,address h)external returns(address){return address(new PokerTournamentHostAdmission420(e,b,x,h));}}
library PokerTournamentHostLedgerFactory420 {function deploy(address e,address b,address x,address h)external returns(address){return address(new PokerTournamentHostLedger420(e,b,x,h));}}
library PokerTournamentHostRoundsFactory420 {function deploy(address e,address b,address x,address h)external returns(address){return address(new PokerTournamentHostRounds420(e,b,x,h));}}
library PokerTournamentHostBalanceFactory420 {function deploy(address e,address b,address x,address h)external returns(address){return address(new PokerTournamentHostBalance420(e,b,x,h));}}

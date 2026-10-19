#!/usr/bin/env node
// Scoped architectural acceptance only: does not qualify runtime poker transactions.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const doc = readFileSync('docs/bet/BET-AUDIT-5A.1-POKER-ARCHITECTURE.md', 'utf8');
const ids = readFileSync('contracts/src/bet/BetIds420.sol', 'utf8');
const auth = readFileSync('contracts/src/bet/BetAuthorization420.sol', 'utf8');
const types = readFileSync('contracts/src/bet/BetTypes420.sol', 'utf8');
const required = [
  'no-limit Texas Hold', '2–9 seats', 'small/big blinds', 'hand rank',
  'single-writer', 'scopeForTable', 'POKER_NEW_TABLES', 'POKER_NEW_HANDS',
  'private hole cards', 'chain ID', 'table ID/version', 'hand nonce',
  'action nonce', 'side pots', 'rake', 'odd chips', 'chip',
  'replay', 'dispute', 'refund', 'collusion', 'jurisdiction',
  'independent', 'disabled', 'VideoPokerV1420', 'Level',
];
for (const marker of required) assert(doc.toLowerCase().includes(marker.toLowerCase()), 'missing policy marker: ' + marker);
for (const action of ['BUY_IN','TOP_UP','ACTION','SIT_OUT','LEAVE','WITHDRAW','TOURNAMENT_ENTER'])
  assert(ids.includes('ACTION_POKER_' + action), 'missing canonical action: ' + action);
assert(auth.includes('function scopeForTable(bytes32 tableId)'), 'table scope missing');
for (const emergency of ['POKER_NEW_TABLES','POKER_NEW_HANDS','POKER_TOURNAMENT_REGISTRATION'])
  assert(types.includes(emergency), 'missing emergency domain: ' + emergency);
assert(doc.includes('**disabled**'), 'missing fail-closed production gate');
console.log('BET-AUDIT-5A.1 scoped architecture/authority verifier PASS (requirements, existing authority constants and trust gates)');

import test from 'node:test';
import assert from 'node:assert/strict';
import type { JsonRpcProvider } from 'ethers';
import { qualifyVaultTestnet420 } from '../src/qualify-vault-testnet.js';
const rpc={async getBlockNumber(){throw new Error('RPC must not be reached for malformed fixtures');}} as unknown as JsonRpcProvider;
const id=(v:string)=>`0x${v.repeat(64)}`;
const fixture={
 deployment:{chainId:'420',confirmations:2,fromBlock:1,vaultRef:id('1'),escrowAddress:'0x1111111111111111111111111111111111111111',vaultAddress:'0x2222222222222222222222222222222222222222',accountingAddress:'0x3333333333333333333333333333333333333333',escrowCodeHash:id('4'),vaultCodeHash:id('5'),accountingCodeHash:id('6')},
 funding:{jobId:id('7'),payer:'0x4444444444444444444444444444444444444444',beneficiary:'0x5555555555555555555555555555555555555555',providerId:id('8'),vaultRef:id('1'),fundingRef:id('9'),fundingObligationId:id('a'),amount420:'42',asset:'0x0000000000000000000000000000000000000000'}
};
test('testnet runner fails closed on absent, fractional and unsafe decimal funding',async()=>{
 await assert.rejects(qualifyVaultTestnet420(rpc,{}),/invalid deployment/);
 await assert.rejects(qualifyVaultTestnet420(rpc,{...fixture,funding:{...fixture.funding,amount420:'0'}}),/invalid funding amount/);
 await assert.rejects(qualifyVaultTestnet420(rpc,{...fixture,funding:{...fixture.funding,amount420:'1.2'}}),/invalid funding amount/);
 await assert.rejects(qualifyVaultTestnet420(rpc,{...fixture,deployment:{...fixture.deployment,chainId:'0'}}),/invalid chainId/);
});
test('testnet runner rejects malformed settlement identifiers and payout kind',async()=>{
 await assert.rejects(qualifyVaultTestnet420(rpc,{...fixture,settlement:{operationId:id('b'),settlementRef:id('c'),kind:'withdraw'}}),/invalid settlement kind/);
 await assert.rejects(qualifyVaultTestnet420(rpc,{...fixture,settlement:{operationId:null,settlementRef:id('c'),kind:'release'}}),/invalid settlement identifiers/);
});

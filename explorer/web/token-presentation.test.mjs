import test from 'node:test';
import assert from 'node:assert/strict';
import {tokenPresentation420} from './static/token-presentation.mjs';
const a=n=>'0x'+n.toString(16).padStart(40,'0'),h=n=>'0x'+n.toString(16).padStart(64,'0');
const p={token:a(1),creator:a(2),factory:a(3),vault:a(4),accounting:a(5),chainId:'31337',blockNumber:'10',snapshotHeight:'11',blockHash:h(1),snapshotHash:h(2),genesisHash:h(3),configHash:h(4),transactionHash:h(5),templateId:h(6),template:'ERC20_FIXED',templateVersion:1,creationFeeWei:'42000000000000000000',transactionIndex:0,logIndex:1,accountingLogIndex:2,vaultLogIndex:3,feeLogIndex:4,evidenceKind:'factory-creation-and-fee-events',authoritative:false};
test('Token Explorer presentation derived provenance only',()=>{const v=tokenPresentation420(p,p.token);assert.equal(v.transactionPath,'#/transactions/'+p.transactionHash);assert.match(v.warning,/Not current ownership/);for(const change of [{authoritative:true},{token:a(7)},{creationFeeWei:'1'},{transactionHash:'javascript:alert(1)'},{feeLogIndex:1},{snapshotHeight:'9'}])assert.throws(()=>tokenPresentation420({...p,...change},p.token));});

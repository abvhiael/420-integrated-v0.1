import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createStakeExplorerClient420,
  STAKE_REWARD_CONTROLLER_420,
  STAKE_VALIDATOR_REGISTRY_420,
} from '../dist/index.js';

const validatorId = '0x' + 'aa'.repeat(32);
const owner = '0x1111111111111111111111111111111111111111';

function page(overrides = {}) {
  return {
    meta:{chainId:420,snapshotHeight:12,snapshotHash:'0x12',safeHeight:11,finalizedHeight:10,schemaVersion:'v1'},
    validatorId:'',
    address:'',
    records:[
      {chainId:420,blockNumber:12,blockHash:'0x12',transactionHash:'0xtx12',transactionIndex:0,logIndex:0,contractAddress:STAKE_REWARD_CONTROLLER_420,eventName:'RewardApplied',addresses:[owner],finality:'HEAD',topics:[],data:'0x'},
      {chainId:420,blockNumber:11,blockHash:'0x11',transactionHash:'0xtx11',transactionIndex:0,logIndex:0,contractAddress:STAKE_VALIDATOR_REGISTRY_420,eventName:'SlashApplied',validatorId,finality:'SAFE',topics:[],data:'0x'},
      {chainId:420,blockNumber:10,blockHash:'0x10',transactionHash:'0xtx10',transactionIndex:0,logIndex:0,contractAddress:STAKE_VALIDATOR_REGISTRY_420,eventName:'ValidatorRegistered',validatorId,addresses:[owner],finality:'FINALIZED',topics:[],data:'0x'},
    ],
    canonicalAuthority:false,
    ...overrides,
  };
}

function fetcher(body, seen = []) {
  return async (url) => {
    seen.push(String(url));
    return {
      ok:true,
      status:200,
      async json(){ return structuredClone(body); },
    };
  };
}

test('Stake SDK client preserves filters and validates exact finality/canonical contracts', async () => {
  const seen=[];
  const client=createStakeExplorerClient420({baseUrl:'https://explorer.example.test',chainId:420n,fetchImpl:fetcher(page(),seen)});
  const result=await client.activity({validatorId,address:owner,limit:25});
  assert.equal(result.records.length,3);
  const url=new URL(seen[0]);
  assert.equal(url.pathname,'/v1/stake/activity');
  assert.equal(url.searchParams.get('validatorId'),validatorId);
  assert.equal(url.searchParams.get('address'),owner);
  assert.equal(url.searchParams.get('limit'),'25');
});

test('Stake SDK client fails closed on authority, chain, contract, event and finality drift', async () => {
  const variants=[
    page({canonicalAuthority:true}),
    page({meta:{...page().meta,chainId:421}}),
    page({records:[{...page().records[0],contractAddress:STAKE_VALIDATOR_REGISTRY_420}]}),
    page({records:[{...page().records[1],eventName:'SyntheticValidatorActivated'}]}),
    page({records:[{...page().records[1],finality:'HEAD'}]}),
  ];
  for (const body of variants) {
    const client=createStakeExplorerClient420({baseUrl:'https://explorer.example.test',chainId:420n,fetchImpl:fetcher(body)});
    await assert.rejects(() => client.activity());
  }
});

test('Stake SDK client validates input and refuses insecure public endpoints', async () => {
  assert.throws(() => createStakeExplorerClient420({baseUrl:'http://explorer.example.test',chainId:420n,fetchImpl:fetcher(page())}), /HTTPS/);
  const client=createStakeExplorerClient420({baseUrl:'http://127.0.0.1:8080',chainId:420n,fetchImpl:fetcher(page())});
  await assert.rejects(() => client.activity({validatorId:'0x1234'}), /bytes32/);
  await assert.rejects(() => client.activity({address:'0x1234'}), /EVM address/);
  await assert.rejects(() => client.activity({limit:251}), /1\.\.250/);
});

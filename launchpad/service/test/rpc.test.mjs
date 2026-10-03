import test from 'node:test';import assert from 'node:assert/strict';import {resolveLaunchpad} from '../core/rpc.mjs';import {wordAddress,wordUint} from '../core/abi.mjs';
const A={registry:'0x0000000000000000000000000000000000000434',router:'0x0000000000000000000000000000000000001001',sales:'0x0000000000000000000000000000000000001002',alloc:'0x0000000000000000000000000000000000001003',crowd:'0x0000000000000000000000000000000000001004',projects:'0x0000000000000000000000000000000000001005'};
class FakeRpc{
 constructor(){this.sel=new Map([['resolveActive(bytes32)','0x11111111'],['sales()','0x22222222'],['allocations()','0x33333333'],['crowdfundingIntegration()','0x44444444'],['projects()','0x55555555']]);}
 async call(method){if(method==='web3_sha3')return '0x'+'ab'.repeat(32);throw Error('unexpected call');}
 async selector(sig){return this.sel.get(sig);}
 async ethCall(to,data){const s=data.slice(0,10);if(s==='0x11111111')return '0x'+wordAddress(A.router)+wordUint(1);if(to===A.router&&s==='0x22222222')return '0x'+wordAddress(A.sales);if(to===A.router&&s==='0x33333333')return '0x'+wordAddress(A.alloc);if(to===A.alloc&&s==='0x44444444')return '0x'+wordAddress(A.crowd);if(to===A.sales&&s==='0x55555555')return '0x'+wordAddress(A.projects);throw Error('unexpected eth_call');}
}
test('canonical Registry resolution derives Launchpad contract graph',async()=>{const r=await resolveLaunchpad(new FakeRpc(),{registryAddress:A.registry});assert.deepEqual(r,{serviceId:'420/service/launchpad/v1',version:1,launchpadRouterAddress:A.router,saleRegistryAddress:A.sales,allocationRegistryAddress:A.alloc,crowdfundingIntegrationAddress:A.crowd,projectRegistryAddress:A.projects});});

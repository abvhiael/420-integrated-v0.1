// Independent Foundry Cast oracle. No RPC, deployment, compile or signing.
// Existing contract qualification covers actual EVM behavior. This checks
// selector, each ABI byte, configHash and calldataHash against independent tooling.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {TOKEN_TEMPLATES_420,encodeTokenCreation420,decodeTokenCreation420} from '../core/token-sdk.js';
const cast=(...args)=>execFileSync('cast',args,{encoding:'utf8',maxBuffer:2**20}).trim().toLowerCase();
const hash=x=>cast('keccak',x);
const config=JSON.parse(readFileSync(new URL('../../../contracts/config/420token-genesis.json',import.meta.url),'utf8'));
assert.deepEqual(TOKEN_TEMPLATES_420.map(p=>p.key),config.templates);
const factory=readFileSync(new URL('../../../contracts/src/token/TokenFactory420.sol',import.meta.url),'utf8');
for(const pattern of [/keccak256\(abi.encode\(name, symbol, initialSupply, effectiveCap\)\)/,
  /keccak256\(abi.encode\(name, symbol, baseURI\)\)/,/keccak256\(abi.encode\(uri_\)\)/])assert.match(factory,pattern);
const results=[];
for(const [i,p] of TOKEN_TEMPLATES_420.entries()){
  const id=hash('0x'+Buffer.from('420/token/template/'+p.slug+'/v1','utf8').toString('hex'));
  assert.equal(id,p.id);
  const limit=p.votes?(1n<<208n)-1n:(1n<<256n)-1n;
  const cases=[
    {name:'Rehearsal',symbol:'RHR',uri:'ipfs://{id}',supply:'100',cap:p.capped?'200':'0'},
    {name:'A🌿é',symbol:'S'.repeat(32),uri:'ipfs://example/{id}.json',supply:limit.toString(),cap:p.capped?limit.toString():'0'},
    {name:'',symbol:'',uri:'',supply:'0',cap:p.capped?'1':'0'},
    {name:'n'.repeat(33),symbol:'B'.repeat(31),uri:'https://example.org/'+ 'x'.repeat(65),supply:'900719925474099312345',cap:p.capped?'900719925474099312346':'0'},
  ];
  for(const [j,v] of cases.entries()){
    const salt='0x'+(BigInt(i*4+j)).toString(16).padStart(64,'0');
    let d,args,signature,configArgs,configSignature;
    if(p.standard==='ERC20'){
      d={template:p.key,userSalt:salt,name:v.name,symbol:v.symbol,initialSupply:v.supply,cap:v.cap};
      signature='createERC20(bytes32,string,string,uint256,uint256,bytes32)';
      configSignature='f(string,string,uint256,uint256)';configArgs=[v.name,v.symbol,v.supply,v.cap];
      args=[id,...configArgs,salt];
    }else if(p.standard==='ERC721'){
      d={template:p.key,userSalt:salt,name:v.name,symbol:v.symbol,baseURI:v.uri};
      signature='createERC721(string,string,string,bytes32)';configSignature='f(string,string,string)';
      configArgs=[v.name,v.symbol,v.uri];args=[...configArgs,salt];
    }else{
      d={template:p.key,userSalt:salt,uri:v.uri};
      signature='createERC1155(string,bytes32)';configSignature='f(string)';
      configArgs=[v.uri];args=[v.uri,salt];
    }
    const actual=encodeTokenCreation420(d),expected=cast('calldata',signature,...args);
    const configHash=hash(cast('abi-encode',configSignature,...configArgs)),calldataHash=hash(expected);
    assert.equal(actual.data,expected,p.key+' calldata '+j);
    assert.equal(actual.configHash,configHash,p.key+' config hash '+j);
    assert.equal(actual.calldataHash,calldataHash,p.key+' calldata hash '+j);
    assert.deepEqual(decodeTokenCreation420(expected),actual);
    results.push({template:p.key,vector:j,selector:expected.slice(0,10),bytes:(expected.length-2)/2,configHash,calldataHash});
  }
}
assert.equal(results.length,32);
console.log(JSON.stringify({status:'PASS',oracle:'Foundry Cast',profiles:8,vectors:results.length,results}));

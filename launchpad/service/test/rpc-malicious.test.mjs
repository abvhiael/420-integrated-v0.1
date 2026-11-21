import test from 'node:test';
import assert from 'node:assert/strict';
import {Rpc} from '../core/rpc.mjs';
const URL='https://rpc.example.net/jsonrpc';
function rpcWith(respond,opts={}){
  return new Rpc(URL,async (_url,{body})=>{
    const req=JSON.parse(body);
    return Response.json(respond(req),{status:200});
  },opts);
}
test('RPC validates JSON-RPC version, id, envelope and result type',async()=>{
  const good=rpcWith(r=>({jsonrpc:'2.0',id:r.id,result:'0x1a4'}));
  assert.equal(await good.call('eth_chainId',[]),'0x1a4');
  for(const respond of [
    r=>({jsonrpc:'2.0',id:r.id+1,result:'0x1a4'}),
    r=>({jsonrpc:'1.0',id:r.id,result:'0x1a4'}),
    r=>({jsonrpc:'2.0',id:r.id,result:'420'}),
    r=>({jsonrpc:'2.0',id:r.id,result:'0x1a4',error:{message:'conflict'}}),
    r=>[{jsonrpc:'2.0',id:r.id,result:'0x1a4'}],
    r=>({jsonrpc:'2.0',id:r.id})
  ]){
    await assert.rejects(()=>rpcWith(respond).call('eth_chainId',[]),/invalid RPC|malformed RPC/);
  }
  await assert.rejects(()=>good.call('eth_sendTransaction',[]),/unsupported RPC method/);
  assert.throws(()=>new Rpc('http'+':'+'//external.example'),/untrusted Launchpad RPC/);
  assert.throws(()=>new Rpc('https://name:password@rpc.example.net'),/untrusted Launchpad RPC/);
});
test('RPC bounds responses and rejects dangerous content types and malformed bodies',async()=>{
  const huge=rpcWith(r=>({jsonrpc:'2.0',id:r.id,result:'x'.repeat(12000)}),{maxBytes:1024});
  await assert.rejects(()=>huge.call('eth_call',[]),/response exceeds limit/);
  const html=new Rpc(URL,async()=>new Response('<html>bad gateway</html>',{headers:{'content-type':'text/html'}}));
  await assert.rejects(()=>html.call('eth_chainId',[]),/unexpected content type/);
  const malformed=new Rpc(URL,async()=>new Response('{not-json}',{headers:{'content-type':'application/json'}}));
  await assert.rejects(()=>malformed.call('eth_chainId',[]),/malformed RPC JSON/);
  const injected=rpcWith(r=>({jsonrpc:'2.0',id:r.id,result:'0x12345z'}));
  await assert.rejects(()=>injected.call('web3_sha3',[]),/malformed RPC result/);
});

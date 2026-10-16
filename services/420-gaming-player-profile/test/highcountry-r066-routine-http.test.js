import test from 'node:test';import assert from 'node:assert/strict';
import {highCountryRoutineHttpServer420} from '../src/highcountry-r066-routine-http.js';
test('real HTTP origin/auth/shape boundary never invokes routine authority for bad callers',async()=>{
 let executions=0;
 const server=highCountryRoutineHttpServer420({invoke:async x=>{executions++;assert.equal(x.token,'issuer');return {status:'ok'};}},{origin:'https://game.example'});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+server.address().port+'/v1/routine/execute';
 try{
  const pre=await fetch(url,{method:'OPTIONS',headers:{origin:'https://game.example'}});
  assert.equal(pre.status,204);assert.equal(pre.headers.get('access-control-allow-origin'),'https://game.example');
  const body={sessionId:'s1',action:'routine',operation:'op1',body:{},escalation:null};
  const foreign=await fetch(url,{method:'POST',headers:{origin:'https://foreign.example',authorization:'Bearer issuer',
   'content-type':'application/json'},body:JSON.stringify(body)});
  assert.equal(foreign.status,403);assert.equal(foreign.headers.get('access-control-allow-origin'),null);
  const unauthorized=await fetch(url,{method:'POST',headers:{origin:'https://game.example',
   'content-type':'application/json'},body:JSON.stringify(body)});
  assert.equal(unauthorized.status,403);
  const extra=await fetch(url,{method:'POST',headers:{origin:'https://game.example',
   authorization:'Bearer issuer','content-type':'application/json'},body:JSON.stringify({...body,principal:'victim'})});
  assert.equal(extra.status,403);
  assert.equal(executions,0);
  const accepted=await fetch(url,{method:'POST',headers:{origin:'https://game.example',
   authorization:'Bearer issuer','content-type':'application/json'},body:JSON.stringify(body)});
  assert.equal(accepted.status,200);assert.equal((await accepted.json()).result.status,'ok');assert.equal(executions,1);
 }finally{await new Promise(resolve=>server.close(resolve));}
});

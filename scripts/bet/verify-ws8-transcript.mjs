import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {verifyBettingTranscript,verifyShowdownSettlement} from '../../clients/420bet-poker/crypto/nlhe-independent-verifier.mjs';

const [logPath,output]=process.argv.slice(2);
assert(logPath&&output,'usage: verify-ws8-transcript.mjs executed-forge.log report.json');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const log=readFileSync(logPath,'utf8');
assert(log.includes('[PASS] testLegitimateFundedHandSettlement()'),'actual passing legitimate funded-hand execution required');
const actions=[],cards=new Map(),owners=new Map(),statements=[];
const streetNames={1:['AWAIT_FLOP','FLOP'],2:['AWAIT_TURN','TURN'],3:['AWAIT_RIVER','RIVER']};
for(const line of log.split('\n')) {
 let m;
 if((m=line.match(/emit WS8ActionRecord\(nonce: (\d+), seat: (\d+), move: (\d+), amount: (\d+)\)/))) {
  const [,nonce,seat,move,amount]=m.map(Number);
  actions.push({nonce,seat,type:['fold','check','call','raise'][move],amount,
   epochCurrent:true,stateRootMatched:true,signed:true,signatureMatchesSeat:true,expiry:1700000050,timestamp:1700000000});
 } else if((m=line.match(/emit WS8StreetRecord\(street: (\d+)\)/))) {
  const [from,to]=streetNames[m[1]];actions.push({type:'reveal',from,to,accepted:true,finalRootMatched:true});
 } else if((m=line.match(/emit CanonicalCardRevealed\(handId: (0x[0-9a-f]+), position: (\d+), street: (\d+), card: (\d+)\)/i))) {
  assert(!cards.has(Number(m[2])),'duplicate physical reveal');cards.set(Number(m[2]),Number(m[4]));
 } else if((m=line.match(/emit WS8HoleOwner\(position: (\d+), seat: (\d+)\)/))) {
  owners.set(Number(m[1]),Number(m[2]));
 } else if((m=line.match(/emit WS8VerifiedPublicStatement\(label: "([^"]+)", proofAndPublicInputs: (0x[0-9a-f]+)\)/i))) {
  const alias={initial:'WS8Initial',shuffle1:'WS8Shuffle1',shuffle2:'WS8Shuffle2',recipient0:'WS8Recipient0',recipient1:'WS8Recipient1',aggregate:'WS8Aggregate'};
  const name=alias[m[1]]??m[1],bytes=Buffer.from(m[2].slice(2),'hex');
  assert.deepEqual(bytes,readFileSync(path.join(root,'clients/420bet-poker/zkshuffle/fixtures/ws8/proofs',name+'.abi')),'executed proof bytes differ from evidence');
  assert((bytes.length-256)%32===0,'invalid public statement ABI');
  const publicInputs=[];for(let i=256;i<bytes.length;i+=32)publicInputs.push(BigInt('0x'+bytes.subarray(i,i+32).toString('hex')).toString());
  statements.push({name,publicInputs,proofAndStatementSHA256:createHash('sha256').update(bytes).digest('hex')});
 }
}
assert.equal(statements.length,41,'all actual accepted public statements must be exported');
assert.equal(new Set(statements.map(x=>x.name)).size,41,'duplicate proof statement');
assert.equal(owners.size,4);assert.equal(cards.size,9);
const replay=verifyBettingTranscript({stacks:[400,400],button:0,smallBlind:10,bigBlind:20,actions});
assert.equal(replay.phase,'SHOWDOWN');assert.equal(replay.nonce,8);assert.equal(replay.pot,40);
const board=[5,6,7,9,11].map(p=>cards.get(p));
const holeCards=[[],[]];for(let pos=0;pos<4;pos++)holeCards[owners.get(pos)].push(cards.get(pos));
const fee=Math.min(Math.floor(replay.pot*500/10000),20);
const result=verifyShowdownSettlement({contributions:replay.seats.map(s=>s.contributed),folded:replay.seats.map(s=>s.folded),holeCards,board,button:0,rake:fee});
const balances=replay.seats.map((s,i)=>s.stack+result.payouts[i]);
const settled=[...log.matchAll(/emit WS8QualifiedSettlement\(handId: (0x[0-9a-f]+), terminalTranscript: (0x[0-9a-f]+), player0: (\d+), player1: (\d+), rake: (\d+)\)/gi)];
assert.equal(settled.length,1,'one actual native settlement required');
const [,handId,terminalTranscript,a,b,rake]=settled[0];
assert.deepEqual(balances,[Number(a),Number(b)]);assert.equal(result.fee,Number(rake));
assert.equal(balances.reduce((x,y)=>x+y,0)+fee,800);
const gitConfig=['-c','safe.directory='+root.replaceAll('\\','/')];
const dirty=spawnSync('git',[...gitConfig,'diff','--quiet','HEAD'],{cwd:root}).status!==0;
const report={trackedWorkingTreeDirty:dirty,qualifiedSHA:dirty?null:execFileSync('git',['-c','safe.directory='+root.replaceAll('\\','/'),'rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),handId,terminalTranscript,
 inputAuthentication:'Accepted production engine action, reveal and proof-book events from the executed Foundry test; independent replay does not manufacture authentication',
 actions:replay.record,board,holeCards,balances,fee,statements};
writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log('Independent executed-hand replay matched native settlement:',JSON.stringify({balances,fee,proofStatements:statements.length}));

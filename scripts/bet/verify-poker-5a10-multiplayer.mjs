import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {verifyBettingTranscript,verifyShowdownSettlement} from '../../clients/420bet-poker/crypto/nlhe-independent-verifier.mjs';
const [trace,output]=process.argv.slice(2);assert(trace&&output,'executed trace and output required');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),raw=readFileSync(trace),log=raw.toString('utf8').replace(/(\d+) \[[0-9.e+-]+\]/gi,'$1').replace(/\b[A-Za-z_][A-Za-z0-9_]*: \[(0x[0-9a-f]{40})\]/gi,'$1');
assert(log.includes('[PASS] test610GenuineNinePlayerAllInSidePotsAndSettlement()'),'actual nine-player execution required');
const folder=path.join(root,'clients/420bet-poker/zkshuffle/fixtures/ws8/multiplayer'),manifest=JSON.parse(readFileSync(path.join(folder,'manifest.json'),'utf8'));
assert.equal(manifest.proofs.length,118);const expected=new Set(manifest.proofs.map(x=>x.name));
const actions=[],cards=new Map(),owners=new Map(),statements=[];
for(const line of log.split('\n')){
 let m;
 if((m=line.match(/emit WS8ActionRecord\(nonce: (\d+), seat: (\d+), move: (\d+), amount: (\d+)\)/))){const [,nonce,seat,move,amount]=m.map(Number);actions.push({nonce,seat,type:['fold','check','call','raise'][move],amount,epochCurrent:true,stateRootMatched:true,signed:true,signatureMatchesSeat:true,actionAuthorized:true,expiry:1700000050,timestamp:1700000000});}
 else if((m=line.match(/emit WS8StreetRecord\(street: (\d+)\)/))){const [from,to]=({1:['AWAIT_FLOP','FLOP'],2:['AWAIT_TURN','TURN'],3:['AWAIT_RIVER','RIVER']})[m[1]];actions.push({type:'reveal',from,to,accepted:true,finalRootMatched:true});}
 else if((m=line.match(/emit CanonicalCardRevealed\(handId: (0x[0-9a-f]+), position: (\d+), street: (\d+), card: (\d+)\)/i))){assert(!cards.has(Number(m[2])),'duplicate canonical reveal');cards.set(Number(m[2]),Number(m[4]));}
 else if((m=line.match(/emit WS8VerifiedPublicStatement\(label: "([^"]+)", proofAndPublicInputs: (0x[0-9a-f]+)\)/i))){
  const name=({initial:'WS8Initial',shuffle1:'WS8Shuffle1',shuffle2:'WS8Shuffle2',aggregate:'WS8Aggregate'})[m[1]]??(m[1].startsWith('recipient')?'WS8Recipient'+m[1].slice(9):m[1]);assert(expected.delete(name),'unknown or duplicate statement');
  const bytes=Buffer.from(m[2].slice(2),'hex');assert.deepEqual(bytes,readFileSync(path.join(folder,'proofs',name+'.abi')),'executed proof differs from genuine committed evidence');assert((bytes.length-256)%32===0,'invalid statement ABI');const inputs=[];for(let i=256;i<bytes.length;i+=32)inputs.push(BigInt('0x'+bytes.subarray(i,i+32).toString('hex')).toString());
  statements.push({name,publicInputs:inputs,proofAndStatementSHA256:createHash('sha256').update(bytes).digest('hex')});
  if(name.startsWith('WS8Delivery')){const pos=Number(inputs[2]),seat=Number(inputs[3]);assert(pos>=0&&pos<18&&seat===(pos%9+1)%9,'wrong encrypted recipient');if(owners.has(pos))assert.equal(owners.get(pos),seat);owners.set(pos,seat);}
 }
}
assert.equal(expected.size,0,'missing accepted statements');assert.equal(statements.length,118);assert.equal(owners.size,18);assert.equal(cards.size,23);
const stacks=Array.from({length:9},(_,i)=>400+50*i),replay=verifyBettingTranscript({stacks,button:0,smallBlind:10,bigBlind:20,actions});assert.equal(replay.phase,'SHOWDOWN');assert.equal(replay.nonce,9);assert.equal(replay.pot,5400);assert(replay.seats.every((p,i)=>p.allIn&&p.stack===0&&p.contributed===stacks[i]),'wrong all-in accounting');
const board=[19,20,21,23,25].map(p=>cards.get(p)),holeCards=Array.from({length:9},()=>[]);for(let p=0;p<18;p++)holeCards[owners.get(p)].push(cards.get(p));
assert.deepEqual(holeCards[1],[24,9]);assert.deepEqual(board,[19,20,21,23,25]);
const fee=20,result=verifyShowdownSettlement({contributions:replay.seats.map(p=>p.contributed),folded:replay.seats.map(p=>p.folded),holeCards,board,button:0,rake:fee});assert.equal(result.refund,50);assert.equal(result.tiers.length,8);assert(result.payouts[1]>3000&&result.payouts[8]>=50,'distinct main-pot winner and uncalled refund required');
const seats=[...log.matchAll(/emit MultiplayerSeat610\(seat: (\d+), player: (0x[0-9a-f]+), starting: (\d+), contribution: (\d+), finalChips: (\d+)\)/gi)];assert.equal(seats.length,9);assert.equal(new Set(seats.map(x=>x[1])).size,9);for(const [,i,,starting,contribution,final] of seats){assert.equal(Number(starting),stacks[Number(i)]);assert.equal(Number(contribution),stacks[Number(i)]);assert.equal(Number(final),result.payouts[Number(i)]);}
const settlements=[...log.matchAll(/emit MultiplayerSettlement610\(handId: (0x[0-9a-f]+), admissionRoot: (0x[0-9a-f]+), terminalTranscript: (0x[0-9a-f]+), fee: (\d+), escrow: (\d+), providerCollateral: (\d+)\)/gi)];assert.equal(settlements.length,1);const [,handId,admissionRoot,terminalTranscript,rake,escrow,collateral]=settlements[0];assert(!/^0x0+$/.test(admissionRoot));assert.equal(Number(rake),20);assert.equal(Number(escrow),5380);assert.equal(Number(collateral),10800);
const admissions=[...log.matchAll(/emit HandAbuseAdmissionRecorded\(tableId: (0x[0-9a-f]+), handId: (0x[0-9a-f]+), admissionRoot: (0x[0-9a-f]+)\)/gi)];assert.equal(admissions.length,1);assert.equal(admissions[0][2],handId);assert.equal(admissions[0][3],admissionRoot);
const acknowledgments=[...log.matchAll(/emit EnvelopeAcknowledged\(handId: (0x[0-9a-f]+), seat: (\d+), receipt: (0x[0-9a-f]+)\)/gi)];assert.equal(acknowledgments.length,9);assert.deepEqual(acknowledgments.map(x=>Number(x[2])).sort((a,b)=>a-b),[0,1,2,3,4,5,6,7,8]);assert(acknowledgments.every(x=>x[1]===handId&&!/^0x0+$/.test(x[3])),'wrong owner receipt context');
const locks=[...log.matchAll(/emit ProviderBondLocked\(handId: (0x[0-9a-f]+), perProvider: (\d+), asset: (0x[0-9a-f]+)\)/gi)];assert.equal(locks.length,1);assert.equal(locks[0][1],handId);assert.equal(Number(locks[0][2]),5400);
const receipts=[...log.matchAll(/emit SettlementReceiptRecorded\(handId: (0x[0-9a-f]+), transcript: (0x[0-9a-f]+), finalChips: \[([^\]]+)\], rake: (\d+)\)/gi)];assert.equal(receipts.length,1);assert.equal(receipts[0][1],handId);assert.equal(receipts[0][2],terminalTranscript);assert.deepEqual(receipts[0][3].split(',').map(x=>Number(x.trim())),result.payouts);assert.equal(Number(receipts[0][4]),fee);
const config=['-c','safe.directory='+root.replaceAll('\\','/')],dirty=spawnSync('git',[...config,'diff','--quiet','HEAD'],{cwd:root}).status!==0,sha=execFileSync('git',[...config,'rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const report={qualifiedSHA:dirty?null:sha,trackedWorkingTreeDirty:dirty,handId,admissionRoot,terminalTranscript,players:9,startingEscrow:5400,providerCollateral:10800,publicStatementsVerified:118,ownerReceiptsVerified:9,providerBondVerified:true,settlementReceiptVerified:true,inputAuthentication:'Accepted production engine signatures and verified proof/reveal events; independent replay does not manufacture authentication',balances:result.payouts,fee,uncalledRefund:result.refund,sidePotTiers:result.tiers,board,holeCards,actions:replay.record,statements,traceSHA256:createHash('sha256').update(raw).digest('hex')};
writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({players:9,statements:118,balances:result.payouts,fee,uncalledRefund:result.refund}));

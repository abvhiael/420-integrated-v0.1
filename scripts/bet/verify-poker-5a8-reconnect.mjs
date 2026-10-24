import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const [trace,output]=process.argv.slice(2);assert(trace&&output,'executed trace and report required');
// Foundry appends a scientific-notation annotation to large decimal values.
// Preserve the exact integer and remove only that display annotation.
const log=readFileSync(trace,'utf8').replace(/(\d+) \[[0-9.e+-]+\]/gi,'$1')
 .replace(/\b[A-Za-z_][A-Za-z0-9_]*: \[(0x[0-9a-f]{40})\]/gi,'$1');
assert(log.includes('[PASS] test58DisconnectedTurnReconnectionAndTimeoutEvidence()'),'passing actual lifecycle execution required');
const records=[...log.matchAll(/emit LifecycleReconnectRecord\(stage: "([^"]+)", handId: (0x[0-9a-f]+), stateRoot: (0x[0-9a-f]+), actionNonce: (\d+), deadline: (\d+), lifecycleNonce: (\d+), sittingOut: (true|false), disconnected: (true|false), leaveRequested: (true|false), chips: (\d+), total: (\d+)\)/gi)].map(m=>({
 stage:m[1],handId:m[2],root:m[3],nonce:Number(m[4]),deadline:Number(m[5]),lifecycle:Number(m[6]),
 sittingOut:m[7]==='true',disconnected:m[8]==='true',leaving:m[9]==='true',chips:Number(m[10]),total:Number(m[11])}));
assert.deepEqual(records.map(r=>r.stage),['before','disconnected','reconnected','timedout','settled']);
const [before,disconnected,reconnected,timedout,settled]=records;
const identities=[...log.matchAll(/emit LifecycleComponentIdentity\(projection: (0x[0-9a-f]+), projectionCodeHash: (0x[0-9a-f]+), projectionBytes: (\d+), seatLedger: (0x[0-9a-f]+), ledgerCodeHash: (0x[0-9a-f]+), ledgerBytes: (\d+)\)/gi)];
assert.equal(identities.length,1,'actual deployed projection and custody identities required');
const [,projection,projectionCodeHash,projectionBytes,seatLedger,ledgerCodeHash,ledgerBytes]=identities[0];
assert(Number(projectionBytes)>0&&Number(projectionBytes)<=24576&&Number(ledgerBytes)>0&&Number(ledgerBytes)<=24576,'runtime deployment budget');
for(const r of records){assert.equal(r.handId,before.handId);assert.equal(r.total,800);assert(!r.leaving);}
for(const r of [before,disconnected,reconnected]){assert.equal(r.root,before.root);assert.equal(r.deadline,before.deadline);assert.equal(r.nonce,0);assert.equal(r.chips,400);assert(!r.sittingOut);}
assert.deepEqual(records.map(r=>r.lifecycle),[0,1,3,4,4]);
assert(disconnected.disconnected&&!reconnected.disconnected);
assert.equal(timedout.nonce,1);assert.notEqual(timedout.root,before.root);assert.equal(timedout.deadline,0);
assert(!timedout.sittingOut&&timedout.chips===400,'pending intent changed funded escrow');
assert(settled.sittingOut&&settled.chips===390&&settled.root===timedout.root&&settled.nonce===1);
assert(/emit NLHETimeout\([^\n]*seat: 0, nonce: 1, autoAction: 0/.test(log),'actual deterministic timeout fold required');
assert(/emit SettlementReceiptRecorded\([^\n]*finalChips: \[390, 410, 0, 0, 0, 0, 0, 0, 0\], rake: 0/.test(log),'actual canonical timeout settlement required');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const git=['-c','safe.directory='+root.replaceAll('\\','/')];
const dirty=spawnSync('git',[...git,'diff','--quiet','HEAD'],{cwd:root}).status!==0;
const report={qualifiedSHA:dirty?null:execFileSync('git',[...git,'rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),trackedWorkingTreeDirty:dirty,
 clockPreservedAcrossReconnect:true,pendingIntentPreservedFundedSnapshot:true,timeoutFoldAndSitOutVerified:true,
 canonicalPayouts:[390,410],rake:0,records,traceSHA256:createHash('sha256').update(readFileSync(trace)).digest('hex')};
report.projectionIdentity={address:projection,runtimeCodeHash:projectionCodeHash,runtimeBytes:Number(projectionBytes)};
report.ledgerIdentity={address:seatLedger,runtimeCodeHash:ledgerCodeHash,runtimeBytes:Number(ledgerBytes)};
writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log('Actual lifecycle trace independently verified: unchanged reconnect clock; timeout fold; 390/410 settlement; next-hand sit-out');

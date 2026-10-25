import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {reviewPokerAbuse} from '../../clients/420bet-poker/crypto/nlhe-abuse-monitor.mjs';
const [tracePath,replayPath,output]=process.argv.slice(2);assert(tracePath&&replayPath&&output,'actual trace, independent replay and report required');
const raw=readFileSync(tracePath),log=raw.toString('utf8').replace(/(\d+) \[[0-9.e+-]+\]/gi,'$1').replace(/\b[A-Za-z_][A-Za-z0-9_]*: \[(0x[0-9a-f]{40})\]/gi,'$1');
assert(log.includes('[PASS] test59LegitimateProtectedFundedHandAndGovernedRestriction()'),'actual protected-hand execution required');
const replay=jsonParse(replayPath);assert(replay.qualifiedSHA&&replay.trackedWorkingTreeDirty===false&&replay.settlementReceiptVerified,'clean-source independently verified settlement required');
assert.deepEqual(replay.balances,[399,399]);assert.equal(replay.fee,2);assert.equal(replay.statements.length,41);
function one(pattern,label){const rows=[...log.matchAll(pattern)];assert.equal(rows.length,1,'one actual '+label+' required');return rows[0].slice(1);}
function jsonParse(p){return JSON.parse(readFileSync(p,'utf8'));}
const [controls,codeHash,size,policyHash]=one(/emit AbuseQualificationIdentity\(controls: (0x[0-9a-f]+), codeHash: (0x[0-9a-f]+), runtimeBytes: (\d+), policyHash: (0x[0-9a-f]+)\)/gi,'policy identity');
assert(Number(size)>0&&Number(size)<=24576,'actual controls runtime exceeds deployment limit');
const [chainId,blockNumber,timestamp,engine,ledger,tableId,player0,player1,controller,providerA,providerB]=one(/emit AbuseQualificationPublicContext\(chainId: (\d+), blockNumber: (\d+), timestamp: (\d+), engine: (0x[0-9a-f]+), seatLedger: (0x[0-9a-f]+), tableId: (0x[0-9a-f]+), player0: (0x[0-9a-f]+), player1: (0x[0-9a-f]+), controller: (0x[0-9a-f]+), providerA: (0x[0-9a-f]+), providerB: (0x[0-9a-f]+)\)/gi,'canonical public context');
const [admittedId,admittedTable,root,mask,admittedPolicy]=one(/emit AbuseHandAdmitted\(handId: (0x[0-9a-f]+), tableId: (0x[0-9a-f]+), root: (0x[0-9a-f]+), mask: (\d+), policyHash: (0x[0-9a-f]+)\)/gi,'policy-admitted hand');
const [boundTable,boundControls,boundPolicy,boundHash]=one(/emit AbuseControlsBound\(tableId: (0x[0-9a-f]+), controls: (0x[0-9a-f]+), policyHash: (0x[0-9a-f]+), codeHash: (0x[0-9a-f]+)\)/gi,'immutable policy binding');
assert.equal(boundTable,tableId);assert.equal(boundControls.toLowerCase(),controls.toLowerCase());assert.equal(boundPolicy,policyHash);assert.equal(boundHash,codeHash);
assert.equal(admittedTable,tableId);assert.equal(admittedId,replay.handId);assert.equal(admittedPolicy,policyHash);assert.equal(Number(mask),3);assert(!/^0x0+$/.test(root));
const [recordTable,recordHand,recordRoot]=one(/emit HandAbuseAdmissionRecorded\(tableId: (0x[0-9a-f]+), handId: (0x[0-9a-f]+), admissionRoot: (0x[0-9a-f]+)\)/gi,'frozen ledger admission');
assert.deepEqual([recordTable,recordHand,recordRoot],[tableId,replay.handId,root]);
const [caseId,caseHand,reporter,target,,evidence]=one(/emit AbuseCaseReported\(caseId: (0x[0-9a-f]+), handId: (0x[0-9a-f]+), reporter: (0x[0-9a-f]+), target: (0x[0-9a-f]+), category: (\d+), evidence: (0x[0-9a-f]+)\)/gi,'bounded evidence report');
assert.equal(caseHand,replay.handId);assert.equal(reporter.toLowerCase(),player1.toLowerCase());assert.equal(target.toLowerCase(),player0.toLowerCase());assert(!/^0x0+$/.test(evidence));
const [proposedId,digest,proposer,executableAfter,duration]=one(/emit RestrictionProposed\(caseId: (0x[0-9a-f]+), digest: (0x[0-9a-f]+), proposer: (0x[0-9a-f]+), executableAfter: (\d+), duration: (\d+), reason: 0x[0-9a-f]+\)/gi,'independent proposal');
const [confirmedId,confirmer,confirmedDigest]=one(/emit RestrictionConfirmed\(caseId: (0x[0-9a-f]+), confirmer: (0x[0-9a-f]+), digest: (0x[0-9a-f]+)\)/gi,'independent approval');
assert.equal(proposedId,caseId);assert.equal(confirmedId,caseId);assert.equal(digest,confirmedDigest);assert.notEqual(proposer.toLowerCase(),confirmer.toLowerCase());
for(const actor of [proposer,confirmer])assert(![player0,player1,controller,providerA,providerB].some(x=>x.toLowerCase()===actor.toLowerCase()),'conflicted reviewer');
const [closedId,restricted,closedTarget,until,revision]=one(/emit AbuseCaseClosed\(caseId: (0x[0-9a-f]+), restricted: (true|false), target: (0x[0-9a-f]+), until: (\d+), revision: (\d+)\)/gi,'reviewed prospective restriction');
assert.equal(closedId,caseId);assert.equal(restricted,'true');assert.equal(closedTarget.toLowerCase(),target.toLowerCase());assert.equal(Number(revision),1);
assert(BigInt(until)-BigInt(duration)>=BigInt(executableAfter)&&BigInt(executableAfter)>BigInt(timestamp),'review delay bypass');
const [preservedHand,preservedRoot,terminal,a,b,fee]=one(/emit AbuseQualificationPreserved\(handId: (0x[0-9a-f]+), admissionRoot: (0x[0-9a-f]+), terminalTranscript: (0x[0-9a-f]+), player0: (\d+), player1: (\d+), rake: (\d+)\)/gi,'unchanged canonical settlement');
assert.deepEqual([preservedHand,preservedRoot,terminal],[replay.handId,root,replay.terminalTranscript]);assert.deepEqual([Number(a),Number(b),Number(fee)],[399,399,2]);
const observation={source:'native-execution',chainId,engine,ledger,tableId,handId:replay.handId,admissionRoot:root,terminalTranscript:terminal,blockNumber,
 players:[player0,player1],startingChips:[400,400],finalChips:replay.balances,contributed:[20,20],folded:[false,false],rake:2,bigBlind:20,phase:'SHOWDOWN',actionTimings:[]};
const monitoring=reviewPokerAbuse([observation]);assert.deepEqual(monitoring.signals,[]);assert.equal(monitoring.automatedSanction,false);
const report={qualifiedSHA:replay.qualifiedSHA,trackedWorkingTreeDirty:false,protectedHand:replay.handId,admissionRoot:root,
 controlsIdentity:{address:controls,runtimeCodeHash:codeHash,runtimeBytes:Number(size),policyHash},independentQuorumVerified:true,reviewDelayVerified:true,
 canonicalOutcomePreserved:true,proofStatementsVerified:41,balances:replay.balances,rake:replay.fee,monitoring,
 traceSHA256:createHash('sha256').update(raw).digest('hex'),independentReplaySHA256:createHash('sha256').update(readFileSync(replayPath)).digest('hex')};
writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log('Actual protected hand, frozen admission, independent timed review and unchanged canonical settlement verified');

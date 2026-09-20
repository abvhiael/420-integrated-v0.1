import fs from 'node:fs';
import path from 'node:path';
import {assessGenesisCloseout} from '../core/genesis-closeout.js';
const web=path.resolve(import.meta.dirname,'..');
const repo=path.resolve(web,'..','..');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const manifest=read(process.env.EXCHANGE_GENESIS_MANIFEST??path.join(repo,'deployments/exchange/testnet.runtime.json'));
const qualifications={v156:read(path.join(web,'v15.6-qualification.json')),v157:read(path.join(web,'v15.7-qualification.json')),v158:read(path.join(web,'v15.8-qualification.json')),v159:read(path.join(web,'v15.9-qualification.json'))};
// Evidence inputs must be supplied explicitly. Never infer success from local mocks or a green PR.
const bundle=process.env.EXCHANGE_GENESIS_EVIDENCE_BUNDLE?read(process.env.EXCHANGE_GENESIS_EVIDENCE_BUNDLE):{};
const assessment=assessGenesisCloseout({manifest,qualifications:{...qualifications,v159:bundle.browserQualification??qualifications.v159},evidence:bundle.evidence??{},review:bundle.review??{}});
const report={...assessment,assessedAt:new Date().toISOString(),sourceSha:process.env.GITHUB_SHA??null};
if(process.env.EXCHANGE_GENESIS_REPORT) fs.writeFileSync(process.env.EXCHANGE_GENESIS_REPORT,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(assessment.status!=='QUALIFIED') process.exitCode=1;

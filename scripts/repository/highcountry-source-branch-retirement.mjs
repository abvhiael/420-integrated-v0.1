import {writeFile,appendFile} from 'node:fs/promises';
const repo=process.env.GITHUB_REPOSITORY,token=process.env.GH_TOKEN;
if(repo!=='abvhiael/420-integrated-v0.1'||!token)throw Error('wrong source repository or missing GitHub token');
const ids=[932,931,930,929,928,917,913,909,900,896,895,893,891,890,885,881,879,878,877,872,859,856,855,853,852,851,849,845,843,839,833,811,803,643,642,641,640,639,638,637,636,635];
const base='https://api.github.com/repos/'+repo;
const headers={authorization:'Bearer '+token,accept:'application/vnd.github+json','x-github-api-version':'2022-11-28'};
async function api(url,init={}){
 const response=await fetch(base+url,{...init,headers});
 if(response.status===404)return {status:404,data:null};
 if(!response.ok)throw Error((init.method||'GET')+' '+url+' returned '+response.status+' '+(await response.text()).slice(0,350));
 return {status:response.status,data:response.status===204?null:await response.json()};
}
const openHeads=new Set();
for(let page=1;page<=30;page++){
 const {data}=await api('/pulls?state=open&per_page=100&page='+page);
 for(const p of data)if(p.head?.repo?.full_name===repo)openHeads.add(p.head.ref);
 if(data.length<100)break;
 if(page===30)throw Error('Open PR enumeration incomplete; refuse branch deletion');
}
const seen=new Set(),result=[];
for(const n of ids){
 const record={pr:n,result:'skipped',branch:null,sha:null,reason:null};result.push(record);
 const {data:p}=await api('/pulls/'+n);
 if(!p||p.state!=='closed'||p.merged_at){record.reason='not closed and unmerged';continue;}
 const branch=p.head?.ref;record.branch=branch;record.sha=p.head?.sha;
 if(!branch||p.head?.repo?.full_name!==repo){record.reason='branch no longer in source repository';continue;}
 if(seen.has(branch)){record.reason='duplicate branch already reviewed';continue;}seen.add(branch);
 if(openHeads.has(branch)||['main','master','develop'].includes(branch)||branch.startsWith('release/')){record.reason='ref retained for open PR or protected namespace';continue;}
 const {data:comments}=await api('/issues/'+n+'/comments?per_page=100');
 if(!comments.some(c=>/github\.com\/abvhiael\/HighCountry/i.test(c.body||'')&&/migrat|supersed|preserv/i.test(c.body||''))){
   record.reason='missing destination migration evidence comment';continue;
 }
 const encoded=encodeURIComponent(branch);
 const {status,data:b}=await api('/branches/'+encoded);
 if(status===404){record.result='already absent';continue;}
 if(b.protected){record.reason='protected branch';continue;}
 if(b.commit?.sha!==record.sha){record.reason='source branch SHA moved since PR review';continue;}
 const del=await fetch(base+'/git/refs/heads/'+encoded,{method:'DELETE',headers});
 if(del.status!==204){record.reason='GitHub rejected deletion HTTP '+del.status+' '+(await del.text()).slice(0,200);continue;}
 const verify=await api('/git/ref/heads/'+encoded);
 if(verify.status!==404)throw Error('Branch deletion could not be independently verified: '+branch);
 record.result='deleted';record.reason='verified GitHub ref absent after deletion';
}
const summary={source:repo,date:new Date().toISOString(),target:ids.length,deleted:result.filter(r=>r.result==='deleted').length,alreadyAbsent:result.filter(r=>r.result==='already absent').length,skipped:result.filter(r=>r.result==='skipped').length,records:result};
await writeFile('highcountry-source-branch-retirement.json',JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({target:summary.target,deleted:summary.deleted,alreadyAbsent:summary.alreadyAbsent,skipped:summary.skipped},null,2));
for(const r of result)console.log(r.pr,r.result,r.branch||'',r.reason||'');
if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,'### HighCountry verified Genesis branch retirement\n\nTarget '+ids.length+'; deleted '+summary.deleted+'; already absent '+summary.alreadyAbsent+'; skipped '+summary.skipped+' (not treated as deleted). Full JSON retained as run artifact.\n');

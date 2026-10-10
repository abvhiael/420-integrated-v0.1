import {execFileSync} from 'node:child_process';
// PR: compare all accumulated app changes against GitHub's exact base SHA.
// Push: ordinary commits compare their parent; reconciliation merges compare
// the imported main parent, so unchanged main documentation is not an app patch.
let base=process.env.COMMERCE_PATCH_BASE;
if(base){
  if(!/^[a-f0-9]{40}$/.test(base))throw new Error('Invalid exact PR base SHA');
  execFileSync('git',['fetch','--no-tags','--depth=1','origin',base],{stdio:'inherit'});
}else{
  const parents=execFileSync('git',['show','-s','--format=%P','HEAD'],{encoding:'utf8'}).trim().split(/\s+/);
  if(!parents[0]||parents.length>2)throw new Error('Missing or unsupported patch parent');
  base=parents.length===2?parents[1]:parents[0];
}
execFileSync('git',['cat-file','-e',base+'^{commit}'],{stdio:'inherit'});
execFileSync('git',['diff','--check',base,'HEAD'],{stdio:'inherit'});
console.log('Commerce patch whitespace PASS against '+base);

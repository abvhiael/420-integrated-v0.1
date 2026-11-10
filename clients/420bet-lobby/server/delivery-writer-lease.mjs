// Strict local single-host multi-process fencing. A lock is never
// auto-broken; surviving processes stop writing if its inode/owner changes.
// Shared or multi-host volume use still requires a reviewed transactional DB.
import {mkdir,open,readFile,rm,rmdir,lstat} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {hostname} from 'node:os';
import {join} from 'node:path';

export async function acquireDeliveryWriterLease(path){
 const token=randomBytes(32).toString('hex');
 let root;
 await mkdir(path,{mode:0o700}); // EEXIST: active or orphaned, NEVER steal.
 const marker=join(path,'owner.json');
 let fd;
 try{
  root=await lstat(path);
  if(!root.isDirectory()||(root.mode&0o077)!==0)throw Error('unsafe lock directory');
  fd=await open(marker,'wx',0o600);
  const owner={schema:1,pid:process.pid,host:hostname(),token,createdAt:Date.now()};
  await fd.writeFile(JSON.stringify(owner));await fd.sync();await fd.close();fd=null;
  const dir=await open(path,'r');try{await dir.sync();}finally{await dir.close();}
  async function assertOwner(){
   const current=await lstat(path),file=await lstat(marker);
   if(current.dev!==root.dev||current.ino!==root.ino||!current.isDirectory()||
    !file.isFile()||(file.mode&0o077)!==0)throw Error('delivery writer lease lost');
   const raw=await readFile(marker,'utf8');
   if(raw.length>1024||JSON.parse(raw).token!==token)throw Error('delivery writer lease lost');
  }
  let closed=false;
  return Object.freeze({path,token,assertOwner,async release(){
   if(closed)return;
   await assertOwner(); // Refuse to remove another process's replacement.
   await rm(marker);
   await rmdir(path); // Will fail rather than delete unknown contents.
   closed=true;
  }});
 }catch(e){
  if(fd)await fd.close().catch(()=>{});
  // Only the newly created lock directory may be cleaned during failure.
  // A changed/replaced lock must be investigated, never forcibly removed.
  const current=await lstat(path).catch(()=>null);
  if(current?.isDirectory()&&root&&current.dev===root.dev&&current.ino===root.ino){
   await rm(marker,{force:true}).catch(()=>{});
   await rmdir(path).catch(()=>{});
  }
  throw e;
 }
}

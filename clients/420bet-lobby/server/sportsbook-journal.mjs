// Private single-writer local sportsbook journal; strict deployment sandbox.
// The JSON accounting simulation is NOT a real-money vault/escrow.
import {mkdir,readFile,open,rename,rm,stat,chmod} from 'node:fs/promises';
import {dirname,basename,join,isAbsolute} from 'node:path';
import {randomBytes} from 'node:crypto';
import {acquireDeliveryWriterLease} from './delivery-writer-lease.mjs';
import {createLocalSportsbookEngine} from './sportsbook-engine.mjs';
const insist=(yes,why)=>{if(!yes)throw Error('420Bet sportsbook store: '+why);};
async function save(path,state){
 const dir=dirname(path),tmp=join(dir,'.'+basename(path)+'.'+randomBytes(8).toString('hex')+'.tmp');
 let fd;
 try{
  fd=await open(tmp,'wx',0o600);
  await fd.writeFile(JSON.stringify(state)+'\n','utf8');await fd.sync();
  await fd.close();fd=null;
  await rename(tmp,path);await chmod(path,0o600);
  const folder=await open(dir,'r');try{await folder.sync();}finally{await folder.close();}
 }finally{if(fd)await fd.close();await rm(tmp,{force:true});}
}
export async function openLocalSportsbookJournal({path,...config}={}){
 insist(isAbsolute(path)&&!path.includes('\0'),'absolute private path required');
 const dir=dirname(path);await mkdir(dir,{recursive:true,mode:0o700});
 insist(((await stat(dir)).mode&0o022)===0,'unsafe journal directory');
 const lease=await acquireDeliveryWriterLease(path+'.lock');
 let existing=null,closed=false;
 try{
  try{
   const file=await stat(path);
   insist(file.isFile()&&(file.mode&0o077)===0&&file.size<=15000000,
    'invalid persisted sportsbook journal');
   const raw=await readFile(path,'utf8');
   existing=JSON.parse(raw);
  }catch(e){if(e?.code!=='ENOENT')throw e;}
  const engine=createLocalSportsbookEngine({...config,preloaded:existing,
   persistState:async next=>{
    insist(!closed,'journal already closed');
    await lease.assertOwner();
    await save(path,next);
   }});
  if(!existing)await save(path,engine.view());
  return Object.freeze({...engine,async close(){
   closed=true;await lease.release();
  }});
 }catch(e){await lease.release().catch(()=>{});throw e;}
}

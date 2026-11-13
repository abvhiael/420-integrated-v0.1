// Node-only simulation of cross-window Web Locks, never loaded into the extension.
const queues=new Map();
export function installMockWebLocks420(){
 const locks={request:async(name,_options,action)=>{
  const previous=queues.get(name)||Promise.resolve();
  let release;
  const hold=new Promise(resolve=>{release=resolve;});
  queues.set(name,previous.then(()=>hold));
  await previous;
  try{return await action();}finally{release();}
 }};
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks}});
 return locks;
}

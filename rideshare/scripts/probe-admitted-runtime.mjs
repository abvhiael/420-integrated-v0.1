#!/usr/bin/env node
const mode=process.argv[2];
if(!['live','ready'].includes(mode))process.exit(2);
const endpoint=mode==='live'?'/internal/live':'/internal/ready';
try{
 const response=await fetch('http://127.0.0.1:8080'+endpoint,{signal:AbortSignal.timeout(2500),redirect:'error',cache:'no-store'});
 if(response.status!==200||response.headers.get('content-type')?.split(';')[0]!=='application/json')process.exitCode=1;
 else{
  const body=await response.json();
  if((mode==='live'&&body?.live!==true)||(mode==='ready'&&(body?.ready!==true||!/^[a-f0-9]{40}$/.test(body.releaseSha))))process.exitCode=1;
 }
}catch{process.exitCode=1}

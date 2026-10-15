import {createServer} from 'node:http';

// A deployment probe only. This process does not expose any LIFTd booking,
// driver onboarding, authority credentials, messaging or payment operation.
export function readinessPayload(){
 return Object.freeze({application:'LIFTd',environment:'isolated-testnet-readiness',
  productionBookingEnabled:false,dispatchEnabled:false,paymentsEnabled:false,
  acceptance:{identity:'NOT_ACCEPTED',transport:'NOT_ACCEPTED',privateVault:'NOT_ACCEPTED',
    messaging:'NOT_ACCEPTED',accessibility:'NOT_ACCEPTED'}});
}
export function buildReadinessServer(){
 return createServer((req,res)=>{
   const ok=req.method==='GET'&&req.url==='/health';
   const readiness=req.method==='GET'&&req.url==='/readiness';
   res.writeHead(ok?200:readiness?503:404,{'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store','x-content-type-options':'nosniff',
    'content-security-policy':"default-src 'none'",'referrer-policy':'no-referrer'});
   res.end(JSON.stringify(ok?{service:'liftd-testnet-readiness',alive:true}:readiness?readinessPayload():{error:'NOT_FOUND'}));
 });
}
if(process.argv[1]&&new URL(import.meta.url).pathname===process.argv[1]){
 const port=Number(process.env.PORT??10000);
 if(!Number.isInteger(port)||port<1||port>65535)throw Error('INVALID_PORT');
 buildReadinessServer().listen(port,'0.0.0.0');
}

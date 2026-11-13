// Strict, chain-scoped WalletConnect v2 WalletKit namespace and request validation.
const ADDRESS=/^0x[0-9a-fA-F]{40}$/;
const METHOD=new Set(['eth_sendTransaction','personal_sign','eth_signTypedData_v4']);
const EVENTS=['accountsChanged','chainChanged'];
function check(c,msg){if(!c)throw new Error(msg)}
export function walletConnectProject420(projectId){
 check(typeof projectId==='string'&&/^[0-9a-fA-F]{32}$/.test(projectId),'WalletConnect requires a configured 32-byte-hex relay project identifier');
 return projectId.toLowerCase();
}
export function walletConnectProposal420(proposal,{chainId,account}){
 check(proposal&&Number.isSafeInteger(proposal.id),'Invalid WalletConnect proposal');
 check(typeof chainId==='string'&&/^0x[0-9a-fA-F]+$/.test(chainId)&&BigInt(chainId)>0n,'Invalid wallet chain');
 check(typeof account==='string'&&ADDRESS.test(account),'Invalid selected wallet account');
 const network='eip155:'+BigInt(chainId).toString(10);
 const required=proposal.params?.requiredNamespaces?.eip155;
 const optional=proposal.params?.optionalNamespaces?.eip155;
 check(required||optional,'WalletConnect proposal must request EVM namespace');
 const chains=[...(required?.chains||[]),...(optional?.chains||[])];
 check(chains.length&&chains.every(x=>x===network),'WalletConnect proposal requests an unapproved chain');
 const methods=[...(required?.methods||[]),...(optional?.methods||[])];
 check(methods.length&&methods.every(x=>METHOD.has(x)),'Unsupported WalletConnect method or implicit authority');
 const events=[...(required?.events||[]),...(optional?.events||[])];
 check(events.every(x=>EVENTS.includes(x)),'Unsupported WalletConnect session event');
 const metadata=proposal.params?.proposer?.metadata;
 const url=new URL(metadata?.url||'invalid');
 check(url.protocol==='https:'&&!url.username&&!url.password,'WalletConnect session proposer must identify an HTTPS origin');
 return {id:proposal.id,origin:url.origin,name:String(metadata?.name||'Unknown dApp').slice(0,90),
   network,account:account.toLowerCase(),methods:[...new Set(methods)],
   events:[...new Set(events)],namespaces:{eip155:{chains:[network],
     accounts:[network+':'+account.toLowerCase()],methods:[...new Set(methods)],events:EVENTS}}};
}
export function walletConnectRequest420(session,event,selected){
 check(session?.topic===event?.topic&&typeof session.topic==='string','Invalid WalletConnect session topic');
 const request=event.params?.request,chain=event.params?.chainId;
 check(request&&Number.isSafeInteger(event.id)&&METHOD.has(request.method),'Unsupported WalletConnect signing method');
 check(typeof chain==='string'&&chain===selected.network,'WalletConnect request chain changed');
 check(session.namespaces?.eip155?.accounts?.includes(selected.network+':'+selected.account),'Selected address was never shared with this session');
 check(session.namespaces.eip155.methods.includes(request.method),'WalletConnect request method not granted');
 check(Array.isArray(request.params)&&JSON.stringify(request.params).length<131072,'Oversized or malformed WalletConnect request');
 const account=selected.account;
 if(request.method==='eth_sendTransaction')
   check(request.params[0]?.from?.toLowerCase()===account,'WalletConnect transaction signer mismatch');
 if(request.method==='personal_sign')
   check(request.params[1]?.toLowerCase()===account,'WalletConnect message signer mismatch');
 if(request.method==='eth_signTypedData_v4')
   check(request.params[0]?.toLowerCase()===account,'WalletConnect EIP-712 signer mismatch');
 return {method:request.method,params:request.params,origin:selected.origin,account};
}
export const walletConnectError420=(id,error)=>({id,jsonrpc:'2.0',error:{
 code:Number.isInteger(error?.code)?error.code:4001,message:String(error?.message||'Wallet denied signing').slice(0,300)
}});
export const walletConnectResult420=(id,result)=>({id,jsonrpc:'2.0',result});

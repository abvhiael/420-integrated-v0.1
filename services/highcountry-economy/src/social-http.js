// Mounted inside the existing authenticated runtime server.
// No alternate bearer-token parser, CORS policy, or unprivileged write path.
export async function dispatchSocialGateway(gateway,path,session,body){
 if(!gateway)throw new Error('canonical social gateway not configured');
 if(!body||typeof body!=='object'||Array.isArray(body))throw new Error('invalid social gateway body');
 switch(path){
  case '/social/authenticate':
   if(Object.keys(body).length)throw new Error('unexpected body');
   return gateway.authenticate(session);
  case '/social/snapshot':
   return gateway.snapshot({session,...body});
  case '/social/authorize':
   return gateway.authorize({...body,session});
  case '/social/submit':
   return gateway.submit({...body,session});
  case '/social/receipt':
   return gateway.receipt({...body,session});
  case '/social/history':
   return gateway.history({...body,session});
  default:throw new Error('unsupported social route');
 }
}

import {signExtensionEoa420} from './core/eoa-local-signer.js';
import { createExtensionLocalAuthority420 } from './core/extension-local-authority.js';

const AUTHORITY_KEY = '420-wallet-pending-authority-v1';
const BINDINGS_KEY = '420-wallet-passkey-bindings-v1';
const CONFIG_KEY = '420-wallet-extension-config-v1';
const LOCAL_AUTHORITY_SOURCE = '420-wallet-local-authority';
const authorityRequestId = new URLSearchParams(location.search).get('request');
const $ = (id) => document.getElementById(id);

function serializeError(error) {
  return {
    code: Number.isInteger(error?.code) ? error.code : -32603,
    message: error?.message || '420 Wallet local authority failed',
    ...('data' in (error ?? {}) ? { data: error.data } : {}),
  };
}

function provider() {
  return {
    async request(methodOrRequest, maybeParams) {
      const request = typeof methodOrRequest === 'string'
        ? { method: methodOrRequest, params: maybeParams ?? [] }
        : methodOrRequest;
      const response = await chrome.runtime.sendMessage({
        source: '420-wallet-authority-ui',
        kind: 'authority-rpc',
        request,
      });
      if (!response) throw new Error('extension authority RPC bridge returned no response');
      if (response.error) throw Object.assign(new Error(response.error.message), response.error);
      return response.result;
    },
  };
}

async function readState() {
  const stored = await chrome.storage.local.get([AUTHORITY_KEY, BINDINGS_KEY, CONFIG_KEY]);
  const pending = stored?.[AUTHORITY_KEY]?.[authorityRequestId];
  if (!pending) throw Object.assign(new Error('local authority request is no longer available'), { code: 4001 });
  return {
    pending,
    bindings: stored?.[BINDINGS_KEY] ?? {},
    config: stored?.[CONFIG_KEY] ?? {},
  };
}

async function complete(payload) {
  await chrome.runtime.sendMessage({
    source: LOCAL_AUTHORITY_SOURCE,
    kind: 'authority-result',
    authorityRequestId,
    ...payload,
  });
  window.close();
}

async function run() {
  if (!authorityRequestId) throw new Error('authority request ID required');
  const { pending, bindings, config } = await readState();
  $('request').hidden = false;
  $('kind').textContent = pending.request.method;
  $('origin').textContent = pending.context.origin;
  $('details').textContent = pending.request.method === 'eth_sendTransaction'
    ? JSON.stringify(pending.request.params?.[0] ?? {}, null, 2)
    : 'This request requires a configured local signing authority.';

  if(pending.request.method==='eth_sendTransaction'&&
     pending.request.params?.[0]?.executionModel==='eoa'){
    $('status').textContent='Verify the recipient, amount, chain, nonce and fee caps. Your wallet password authorizes this transaction only.';
    const form=$('eoa-authority');form.hidden=false;
    let signing=false;
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(signing)return;
      signing=true;$('eoa-authorize').disabled=true;
      const password=$('eoa-password').value;
      $('eoa-password').value='';
      let signed=null;
      try{
        const vault=(await chrome.storage.local.get('420-wallet-encrypted-vault-v1'))['420-wallet-encrypted-vault-v1'];
        if(!vault)throw new Error('Encrypted local vault unavailable');
        const tx=pending.request.params[0];
        if(tx.from?.toLowerCase()!==pending.context.accounts?.[0]||
           tx.chainId!==pending.context.chainId)
          throw new Error('Approved account or EOA chain changed');
        signed=await signExtensionEoa420({vaultRecord:vault,password,
          account:tx.from,transaction:tx,chainId:tx.chainId});
        const observed=await provider().request('eth_chainId',[]);
        if(BigInt(observed)!==BigInt(signed.chainId))
          throw new Error('EOA signing network changed');
        const latest=await provider().request('eth_getTransactionCount',[signed.from,'latest']);
        if(BigInt(latest)>BigInt(signed.nonce))
          throw new Error('EOA nonce has already been confirmed; replacement is unsafe');
        const head=await provider().request('eth_getBlockByNumber',['latest',false]);
        if(!head?.baseFeePerGas||
           BigInt(signed.maxFeePerGas)<BigInt(head.baseFeePerGas)+BigInt(signed.maxPriorityFeePerGas))
          throw new Error('Fee cap no longer covers confirmed base fee; review transaction again');
        const response=await chrome.runtime.sendMessage({
          source:'420-wallet-authority-ui',kind:'authority-eoa-signed',
          authorityRequestId,submission:Object.fromEntries(
            Object.entries(signed).filter(([key])=>key!=='raw')),
        });
        if(response?.error)throw new Error(response.error.message);
        if(response?.result!==true)throw new Error('Signed transaction activity could not be preserved');
        const broadcast=await provider().request('eth_sendRawTransaction',[signed.raw]);
        if(typeof broadcast!=='string'||broadcast.toLowerCase()!==signed.hash)
          throw new Error('RPC transaction hash differs from locally signed raw transaction');
        await complete({result:signed.hash});
      }catch(error){
        $('status').textContent=error?.message||'EOA signature failed';
        if(signed?.hash){
          await complete({error:{code:4900,
            message:'EOA signed transaction '+signed.hash+' may already be broadcast. Do not resend until chain status is checked.',
            data:{hash:signed.hash,pending:true}}});
        }else{
          signing=false;$('eoa-authorize').disabled=false;
        }
      }finally{signed=null;}
    });
    return;
  }

  const execute = createExtensionLocalAuthority420({
    provider: provider(),
    navigatorLike: navigator,
    smartAccountConfig: config.smartAccountConfig,
    // Return a pending UserOperation identity before the worker's 120s approval timeout.
    receiptOptions: {timeoutMs:90000,pollMs:1500},
    onUserOperationSubmitted:async (submission,context)=>{
      const response=await chrome.runtime.sendMessage({
        source:'420-wallet-authority-ui',kind:'authority-submitted',
        authorityRequestId,submission,
      });
      if(response?.error)throw Object.assign(new Error(response.error.message),response.error);
      if(response?.result!==true)throw new Error('Unable to preserve pending UserOperation identity');
    },
    loadPasskeyBinding: async ({ account, smartAccount }) => {
      return bindings[smartAccount.toLowerCase()] ?? bindings[account.toLowerCase()] ?? null;
    },
    persistPasskeyBinding: async (binding, { account }) => {
      const current = await chrome.storage.local.get(BINDINGS_KEY);
      const next = current?.[BINDINGS_KEY] ?? {};
      next[binding.smartAccount.toLowerCase()] = binding;
      next[account.toLowerCase()] = binding;
      await chrome.storage.local.set({ [BINDINGS_KEY]: next });
    },
  });

  $('status').textContent = pending.request.method === 'eth_sendTransaction'
    ? 'Confirm this SmartAccount420 transaction with your passkey.'
    : 'Checking local signing authority…';
  const result = await execute(pending.request, pending.context);
  await complete({ result });
}

run().catch(async (error) => {
  $('status').textContent = error?.message || 'Local wallet authority failed.';
  try { await complete({ error: serializeError(error) }); } catch {}
});

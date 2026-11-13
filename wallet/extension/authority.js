import {ledgerOpen420} from './core/hardware-ledger.js';
import {createTrezorConnect420} from './core/hardware-trezor.js';
import {hardwarePath420,assertHardwareAccount420,prepareHardwareTransaction420,acceptHardwareTxSignature420,
 prepareHardwareTypedData420,acceptHardwareTypedSignature420,acceptHardwarePersonalSignature420,preBroadcastHardware420} from './core/hardware-signing.js';
import {resolveExtensionRecipient420,assertExtensionRecipientSnapshot420} from './core/extension-recipient-resolver.js';
import {signExtensionEoa420,signExtensionEoaMessage420} from './core/eoa-local-signer.js';
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


async function executeHardware420(pending,config) {
  const request=pending.request,account=pending.context.accounts?.[0];
  const meta=config?.accountMeta?.[account];
  const selected=assertHardwareAccount420(meta,account);
  const tx=request.method==='eth_sendTransaction'?request.params?.[0]:null;
  if(tx&&tx.executionModel!=='hardware')throw new Error('Hardware transaction approval model changed');
  if(!['eth_sendTransaction','eth_signTypedData_v4','personal_sign'].includes(request.method))
    throw new Error('Unsupported hardware authority request');
  $('hardware-authority').hidden=false;
  const typed=request.method==='eth_signTypedData_v4'
    ?prepareHardwareTypedData420(request.params,pending.context.chainId,account):null;
  const prepared=tx?prepareHardwareTransaction420(tx,pending.context.chainId,account):null;
  $('details').textContent=JSON.stringify({
    method:request.method,origin:pending.context.origin,signer:account,
    chainId:pending.context.chainId,path:selected.path,
    ...(prepared?{to:prepared.to,value:prepared.value,nonce:prepared.nonce,
      gasLimit:prepared.gasLimit,maxFeePerGas:prepared.maxFeePerGas,
      maxPriorityFeePerGas:prepared.maxPriorityFeePerGas,calldata:prepared.data}:{}),
    ...(typed?{typedData:typed.payload,digest:typed.digest}:{}),
    ...(request.method==='personal_sign'?{message:request.params?.[0]}:{})
  },null,2);
  $('status').textContent='Verify the device, account, chain and exact request before approving. Device approval is required.';
  const hashed=selected.provider==='ledger'&&!!typed;
  $('hardware-hash-label').hidden=!hashed;
  $('hardware-device-hint').textContent=selected.provider==='ledger'?
    'Connect your Ledger with Ethereum app open and approve on its screen.':
    'Approve via the official Trezor Suite Connect 10 interface on your device.';
  let working=false;
  $('hardware-authority').addEventListener('submit',async event=>{
    event.preventDefault();if(working)return;
    if(hashed&&!$('hardware-hash-ack').checked){
      $('status').textContent='Explicit acknowledgment of hash-only EIP-712 display is required.';
      return;
    }
    working=true;$('hardware-authorize').disabled=true;
    let signed=null,ledger=null;
    try{
      const current=(await chrome.storage.local.get(CONFIG_KEY))?.[CONFIG_KEY]?.accountMeta?.[account];
      if(!current||JSON.stringify(current)!==JSON.stringify(meta))
        throw new Error('Hardware account or derivation changed during review');
      const observed=await provider().request('eth_chainId',[]);
      if(BigInt(observed)!==BigInt(pending.context.chainId))
        throw new Error('Hardware signing chain changed');
      const trezorCall=async(method,params)=>{
        const response=await chrome.runtime.sendMessage({
          source:'420-wallet-authority-ui',kind:'authority-trezor',
          authorityRequestId,method,params});
        if(response?.error)throw new Error(response.error.message);
        if(!response||!('result'in response))throw new Error('Trezor bridge did not return a result');
        return response.result;
      };
      let device;
      if(selected.provider==='ledger'){
        ledger=await ledgerOpen420();
        device={
          address:async()=>ledger.address(selected.index,selected.account),
          signTransaction:async(prep)=>ledger.signTransaction(selected,prep.unsignedSerialized),
          signTypedData:async(prep)=>ledger.signTypedDataHash(selected,prep.domainHash,prep.messageHash)
        };
      }else{
        const bridge=createTrezorConnect420({
          ethereumGetAddress:p=>trezorCall('ethereumGetAddress',p),
          ethereumSignTransaction:p=>trezorCall('ethereumSignTransaction',p),
          ethereumSignTypedData:p=>trezorCall('ethereumSignTypedData',p),
          ethereumSignMessage:p=>trezorCall('ethereumSignMessage',p),
        });
        device={
          address:async()=>bridge.address(selected.path),
          signTransaction:async prep=>bridge.signTransaction(selected.path,prep),
          signTypedData:async prep=>bridge.signTypedData(selected.path,prep),
          signPersonalMessage:async data=>bridge.signPersonalMessage(selected.path,data),
        };
      }
      const proof=await device.address();
      if(proof.address.toLowerCase()!==account.toLowerCase()||proof.path!==selected.path)
        throw new Error('Connected hardware address/path does not match reviewed account');
      const assertRecipient=async()=>{
        if(!tx?.recipientSnapshot)return;
        if(tx.recipientSnapshot.recipient!==tx.to?.toLowerCase())
          throw new Error('Reviewed name and transaction target disagree');
        const resolved=await resolveExtensionRecipient420(provider(),{
          input:tx.recipientSnapshot.input,chainId:tx.chainId,
          qualifiedNamesConfig:config.qualifiedNamesRuntime??null,
        });
        assertExtensionRecipientSnapshot420(tx.recipientSnapshot,resolved);
      };
      if(prepared){
        await preBroadcastHardware420(provider(),prepared,assertRecipient);
        signed=acceptHardwareTxSignature420(prepared,await device.signTransaction(prepared));
        await preBroadcastHardware420(provider(),prepared,assertRecipient);
        const response=await chrome.runtime.sendMessage({
          source:'420-wallet-authority-ui',kind:'authority-eoa-signed',
          authorityRequestId,submission:Object.fromEntries(Object.entries(signed).filter(([k])=>k!=='raw'))
        });
        if(response?.error||response?.result!==true)throw new Error(response?.error?.message||'Hardware activity record rejected');
        const broadcast=await provider().request('eth_sendRawTransaction',[signed.raw]);
        if(typeof broadcast!=='string'||broadcast.toLowerCase()!==signed.hash)
          throw new Error('Broadcast hash disagrees with device-signed transaction');
        await complete({result:signed.hash});
      }else if(typed){
        const signature=acceptHardwareTypedSignature420(typed,await device.signTypedData(typed));
        if(BigInt(await provider().request('eth_chainId',[]))!==BigInt(pending.context.chainId))
          throw new Error('Chain changed during typed-data signing');
        await complete({result:signature});
      }else{
        if(selected.provider==='ledger')throw new Error('Ledger personal message signing requires device signer support');
        const data=request.params?.[0];
        const signature=acceptHardwarePersonalSignature420(account,data,await device.signPersonalMessage(data));
        await complete({result:signature});
      }
    }catch(error){
      $('status').textContent=error?.message||'Hardware signing rejected';
      if(signed?.hash){
        await complete({error:{code:4900,message:'Hardware-signed transaction '+signed.hash+
          ' may already have been submitted. Check chain activity before retrying.',data:{hash:signed.hash,pending:true}}});
      }else{working=false;$('hardware-authorize').disabled=false;}
    }finally{await ledger?.close().catch(()=>{});}
  });
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

  const currentMeta=config?.accountMeta?.[pending.context.accounts?.[0]];
  if(currentMeta?.type==='hardware'){
    await executeHardware420(pending,config);
    return;
  }

  if(['personal_sign','eth_signTypedData_v4'].includes(pending.request.method) &&
     pending.request.executionModel==='eoa'){
    const request=pending.request,account=pending.context.accounts?.[0];
    const params=request.params;
    $('details').textContent=JSON.stringify({
      method:request.method,origin:pending.context.origin,chainId:pending.context.chainId,
      signer:account,request:params
    },null,2);
    $('status').textContent='Review the requesting site, chain, signer and full message. The wallet password signs only these exact bytes.';
    const form=$('eoa-authority');form.hidden=false;
    $('eoa-authorize').textContent='Sign reviewed message locally';
    let busy=false;
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(busy)return;
      busy=true;$('eoa-authorize').disabled=true;
      const password=$('eoa-password').value;$('eoa-password').value='';
      try{
        const observed=await provider().request('eth_chainId',[]);
        if(BigInt(observed)!==BigInt(pending.context.chainId))
          throw new Error('Network changed before message signing');
        const vault=(await chrome.storage.local.get('420-wallet-encrypted-vault-v1'))['420-wallet-encrypted-vault-v1'];
        if(!vault)throw new Error('Encrypted local vault unavailable');
        const signature=await signExtensionEoaMessage420({
          vaultRecord:vault,password,account,method:request.method,params,
          chainId:pending.context.chainId
        });
        const after=await provider().request('eth_chainId',[]);
        if(BigInt(after)!==BigInt(pending.context.chainId))
          throw new Error('Network changed during message signing');
        await complete({result:signature});
      }catch(error){
        $('status').textContent=error?.message||'Local message signature failed';
        busy=false;$('eoa-authorize').disabled=false;
      }
    });
    return;
  }

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
        const assertRecipient=async()=>{
          if(!tx.recipientSnapshot)return;
          if(tx.recipientSnapshot.recipient!==tx.to?.toLowerCase())
            throw new Error('Reviewed name no longer matches signed transaction target');
          const resolved=await resolveExtensionRecipient420(provider(),{
            input:tx.recipientSnapshot.input,chainId:tx.chainId,
            qualifiedNamesConfig:config.qualifiedNamesRuntime??null,
          });
          assertExtensionRecipientSnapshot420(tx.recipientSnapshot,resolved);
        };
        await assertRecipient();
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
        await assertRecipient();
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
    qualifiedNamesRuntime:config.qualifiedNamesRuntime??null,
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

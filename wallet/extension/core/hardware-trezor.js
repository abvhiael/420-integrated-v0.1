import {Signature} from '../vendor/ethers-6.17.0.min.js';
import {hardwarePath420} from './hardware-signing.js';
function check(ok,msg){if(!ok)throw new Error(msg);}
function unwrap(result,method){
  if(result?.success!==true||!result?.payload)throw new Error('Trezor '+method+' rejected: '+String(result?.payload?.error||'device unavailable'));
  return result.payload;
}
export function createTrezorConnect420(connect){
  check(connect&&typeof connect.ethereumGetAddress==='function'&&
    typeof connect.ethereumSignTransaction==='function'&&
    typeof connect.ethereumSignTypedData==='function','A verified Trezor Connect 10 extension bridge is required');
  return {
    async address(path){
      hardwarePath420(path);
      const result=unwrap(await connect.ethereumGetAddress({path,showOnTrezor:true}),'address discovery');
      check(typeof result.address==='string'&&/^0x[0-9a-fA-F]{40}$/.test(result.address),'Trezor returned invalid Ethereum address');
      return {address:result.address.toLowerCase(),path,provider:'trezor'};
    },
    async signTransaction(path,prepared){
      hardwarePath420(path);
      check(prepared?.tx?.type===2,'Trezor hardware signer only supports reviewed EIP-1559 transactions');
      const c=prepared.tx;
      check(Number.isSafeInteger(Number(c.chainId))&&Number(c.chainId)>0,'Unsupported Trezor chain ID');
      const response=unwrap(await connect.ethereumSignTransaction({
        path,
        transaction:{
          to:c.to,
          value:'0x'+c.value.toString(16),
          data:c.data,
          nonce:'0x'+BigInt(c.nonce).toString(16),
          gasLimit:'0x'+c.gasLimit.toString(16),
          maxFeePerGas:'0x'+c.maxFeePerGas.toString(16),
          maxPriorityFeePerGas:'0x'+c.maxPriorityFeePerGas.toString(16),
          chainId:Number(c.chainId),
          txType:2,
        }
      }),'transaction signing');
      const v=BigInt(response.v);
      const eip155=BigInt(c.chainId)*2n+35n;
      check(v===0n||v===1n||v===27n||v===28n||v===eip155||v===eip155+1n,'Unexpected Trezor signature parity or chain');
      const parity=v===27n||v===28n?v-27n:v===eip155||v===eip155+1n?v-eip155:v;
      return {r:response.r,s:response.s,yParity:Number(parity)};
    },
    async signTypedData(path,prepared){
      hardwarePath420(path);
      const response=unwrap(await connect.ethereumSignTypedData({
        path,data:prepared.payload,metamask_v4_compat:true
      }),'EIP-712 signing');
      check(typeof response.signature==='string','Trezor returned no EIP-712 signature');
      return Signature.from(response.signature);
    },
    async signPersonalMessage(path,data){
      hardwarePath420(path);
      check(typeof connect.ethereumSignMessage==='function','Trezor personal signing unsupported');
      const response=unwrap(await connect.ethereumSignMessage({path,message:data.slice(2),hex:true}),'personal message signing');
      return Signature.from(response.signature);
    }
  };
}
export async function loadTrezorExtension420(loader){
  check(typeof loader==='function','Trezor Connect 10 bridge loader unavailable');
  const module=await loader();
  return createTrezorConnect420(module?.default||module);
}

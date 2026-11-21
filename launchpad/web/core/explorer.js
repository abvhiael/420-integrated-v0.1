const HASH=/^0x[0-9a-fA-F]{64}$/;
const CHAIN=/^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/;

/**
 * 420Explorer is a non-authoritative indexed read-only handoff.
 * Only a network-configured HTTPS origin can host a transaction inspection link.
 * A link is never treated as confirmation of settlement or campaign authority.
 */
export function explorerTransactionLink420({config,wallet,txHash}={}){
  if(!HASH.test(txHash||'')||!CHAIN.test(wallet?.chainId||'')||
    !CHAIN.test(config?.network?.chainId||'')||
    BigInt(wallet.chainId)!==BigInt(config.network.chainId))
    throw new Error('Explorer transaction network or hash mismatch');
  const base=config.network.explorerUrl;
  if(typeof base!=='string')throw new Error('canonical 420Explorer not configured');
  let url;try{url=new URL(base);}catch{throw new Error('invalid 420Explorer origin');}
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||
    (url.pathname!=='/'&&url.pathname!==''))
    throw new Error('untrusted 420Explorer origin');
  url.hash='#/transactions/'+txHash.toLowerCase();
  return url.href;
}

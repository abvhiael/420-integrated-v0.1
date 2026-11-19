import { developerCheckout } from '../../../packages/420-pay-sdk/dist/index.js';
import { parsePayLink, paymentLink, recipientAddress } from '../../web/payment-intent.js';

globalThis.reviewPay420 = (input, host, chain) => {
  try {
    const base = new URL('https://' + host);
    const chainId = BigInt(chain);
    const entry = /^https:/i.test(input) ? parsePayLink(input, base, chainId) :
      { kind: 'address', recipient: recipientAddress(input) };
    return entry.kind === 'invoice' ? developerCheckout(base.origin, chainId, entry.id).hosted :
      paymentLink(base, chainId, entry);
  } catch {
    return null;
  }
};

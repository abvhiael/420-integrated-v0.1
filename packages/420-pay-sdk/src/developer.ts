import type { Hex } from './index.js';

export const PAY_API_VERSION = 'v1';

export function developerCheckout(origin: string, chainId: bigint, invoiceId: Hex) {
  const base = new URL(origin);
  if (base.protocol !== 'https:' || base.origin !== origin || chainId <= 0n ||
      !/^0x[0-9a-f]{64}$/.test(invoiceId) || /^0x0{64}$/.test(invoiceId)) {
    throw new TypeError('Invalid checkout deployment or invoice identifier');
  }
  const hosted = new URL('/', base);
  hosted.hash = 'pay?' + new URLSearchParams({ v: '1', chain: chainId.toString(), kind: 'invoice', id: invoiceId });
  const embedded = new URL('/checkout-embed.html', base);
  embedded.search = new URLSearchParams({ chain: chainId.toString(), invoice: invoiceId }).toString();
  return { hosted: hosted.href, embedded: embedded.href };
}

export function createPayDeveloperClient(endpoint: string, token: string, request: typeof fetch = fetch) {
  const base = new URL(endpoint);
  if (base.origin !== endpoint || base.protocol !== 'https:' || !/^pay_[0-9a-f]{64}$/.test(token)) {
    throw new TypeError('Invalid Pay API endpoint or credential');
  }
  return {
    async invoice(invoiceId: Hex) {
      if (!/^0x[0-9a-f]{64}$/.test(invoiceId)) throw new TypeError('Invalid invoice ID');
      const response = await request(new URL('/v1/invoices/' + invoiceId, base), {
        headers: { authorization: 'Bearer ' + token }, redirect: 'error', cache: 'no-store'
      });
      if (!response.ok) throw new Error('Pay API request failed (' + response.status + ')');
      return response.json();
    }
  };
}

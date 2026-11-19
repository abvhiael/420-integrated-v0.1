import { developerCheckout } from '../../packages/420-pay-sdk/dist/index.js';

const params = new URLSearchParams(location.search);
const chain = params.get('chain');
const invoice = params.get('invoice');
if (params.size === 2 && /^[1-9][0-9]{0,77}$/.test(chain ?? '') && invoice) {
  try {
    const { hosted } = developerCheckout(location.origin, BigInt(chain), invoice);
    const link = document.getElementById('hosted-checkout');
    link.href = hosted;
    link.hidden = false;
    document.getElementById('checkout-message').textContent = 'Open 420 Pay to verify the invoice and approve it in 420 Wallet.';
  } catch {}
}

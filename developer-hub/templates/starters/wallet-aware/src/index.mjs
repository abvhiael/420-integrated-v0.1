export function requireWalletRuntime420(walletRuntime) {
  if (!walletRuntime || typeof walletRuntime !== 'object') throw new Error('420 Wallet runtime is required');
  if (typeof walletRuntime.requestSignature !== 'function') throw new Error('wallet signer boundary unavailable');
  return walletRuntime;
}

// This starter deliberately does not accept private keys or seed phrases.

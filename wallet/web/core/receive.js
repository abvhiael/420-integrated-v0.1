/** Pure presentation gate: never expose an unverified or mismatched receiving address. */
export function getCanonicalReceiveAddress420({ smartAccount, network, expectedChainId } = {}) {
  const address = smartAccount?.smartAccount;
  if (typeof address !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(address)
      || /^0x0{40}$/i.test(address)) return null;
  if (!network?.healthy || network.chainMismatch || !expectedChainId) return null;
  let actual, expected;
  try {
    actual = BigInt(network.chainId);
    expected = BigInt(expectedChainId);
  } catch { return null; }
  if (actual !== expected) return null;
  if (smartAccount.expectedChainId) {
    try { if (BigInt(smartAccount.expectedChainId) !== expected) return null; }
    catch { return null; }
  }
  if (smartAccount.deployed !== true) return null;
  return address;
}

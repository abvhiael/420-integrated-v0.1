/** Read-only, identity-scoped portfolio selection. Never aggregate controller and Smart Account. */
export function selectNativeAccountBalance420(portfolio, accountAddress) {
  if (typeof accountAddress !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(accountAddress)) return null;
  const matches = (portfolio?.native || []).filter((balance) =>
    typeof balance?.address === 'string'
    && balance.address.toLowerCase() === accountAddress.toLowerCase()
    && balance.symbol === '420'
    && balance.decimals === 18
    && typeof balance.raw === 'bigint'
    && balance.raw >= 0n,
  );
  return matches.length === 1 ? matches[0] : null;
}

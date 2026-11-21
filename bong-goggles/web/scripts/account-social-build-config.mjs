// The Cloudflare Pages build can opt into the independent wallet-free
// BongGoggles account UI. This does not authorize wallet/on-chain features,
// production launch, or account monetization.
export const ACCOUNT_SOCIAL_BUILD_FLAG = 'BG_ACCOUNT_SOCIAL_ACTIVATION';

export function withAccountSocialBuildFlags(example, rawValue) {
  if (rawValue !== undefined && rawValue !== 'true' && rawValue !== 'false') {
    throw new Error('BG_ACCOUNT_SOCIAL_ACTIVATION must be exactly true or false');
  }
  if (!example || typeof example !== 'object' || Array.isArray(example) ||
      !example.features || typeof example.features !== 'object' ||
      Array.isArray(example.features)) {
    throw new Error('Full BongGoggles runtime config with features is required');
  }
  const enabled = rawValue === 'true';
  return {
    ...example,
    features: {
      ...example.features,
      accountSocial: enabled,
      accountMessaging: enabled,
      accountGames: enabled,
      accountXP: enabled,
      accountMonetization: false
    }
  };
}

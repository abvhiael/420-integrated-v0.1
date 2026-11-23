// The Cloudflare Pages build can opt into the independent wallet-free
// BongGoggles account UI. This does not authorize wallet/on-chain features,
// production launch, or account monetization.
export const ACCOUNT_SOCIAL_BUILD_FLAG = 'BG_ACCOUNT_SOCIAL_ACTIVATION';
export const CLASSIC_ROOMS_BUILD_FLAG = 'BG_CLASSIC_ROOMS_ACTIVATION';
export const CLASSIC_COMMUNICATIONS_BUILD_FLAG = 'BG_CLASSIC_COMMUNICATIONS_ACTIVATION';

export function withAccountSocialBuildFlags(example, rawValue, roomsValue, communicationsValue) {
  if (communicationsValue !== undefined && communicationsValue !== 'true' && communicationsValue !== 'false')
    throw new Error('BG_CLASSIC_COMMUNICATIONS_ACTIVATION must be exactly true or false');
  if (communicationsValue === 'true' && (rawValue !== 'true' || roomsValue !== 'true'))
    throw new Error('Classic communications require active 420ID rooms');
  if (roomsValue !== undefined && roomsValue !== 'true' && roomsValue !== 'false') {
    throw new Error('BG_CLASSIC_ROOMS_ACTIVATION must be exactly true or false');
  }
  if (roomsValue === 'true' && rawValue !== 'true') {
    throw new Error('Classic rooms require qualified account-social activation');
  }
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
      classicRooms: enabled && roomsValue === 'true',
      classicCommunications: enabled && roomsValue === 'true' && communicationsValue === 'true',
      accountXP: enabled,
      accountMonetization: false
    }
  };
}

// BC-1.8 explicit source-controlled activation for the production Pages
// branch only. Operator-supplied true/false always takes precedence; a
// preview build, missing account approval or ordinary npm build stays off.
export function resolveClassicBuildFlags({account,rooms,communications,pages,branch}={}){
 const approved=pages==='1'&&branch==='main'&&account==='true';
 const roomFlag=rooms??(approved?'true':undefined);
 const communicationFlag=communications??(approved&&roomFlag==='true'?'true':undefined);
 return Object.freeze({rooms:roomFlag,communications:communicationFlag});
}

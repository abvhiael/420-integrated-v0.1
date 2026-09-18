const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export const BONG_GOGGLES_REWARD_SCHEMA = 'bg-rewards-production-config-v1';
export const BONG_GOGGLES_APP_ID = Object.freeze({
  symbol: 'APP_ID_BONG_GOGGLES',
  preimage: '420/APP/BONG_GOGGLES/V1',
});

export const BONG_GOGGLES_CONTRIBUTION_TYPES = Object.freeze({
  POST: '420/BONG_GOGGLES/REWARD/POST/V1',
  PHOTO: '420/BONG_GOGGLES/REWARD/PHOTO/V1',
  STORY: '420/BONG_GOGGLES/REWARD/STORY/V1',
  DISCOVERY: '420/BONG_GOGGLES/REWARD/DISCOVERY/V1',
  REVIEW: '420/BONG_GOGGLES/REWARD/REVIEW/V1',
  CORRECTION: '420/BONG_GOGGLES/REWARD/CORRECTION/V1',
  VERIFICATION: '420/BONG_GOGGLES/REWARD/VERIFICATION/V1',
});

export const BONG_GOGGLES_REWARD_DEPENDENCIES = Object.freeze([
  'BongGogglesContributionVerifier420',
  'BongGogglesRewardsAdapter420',
  'ContributionRegistry420',
  'RewardCampaignRegistry420',
  'RewardDistributor420',
  'RewardPool420',
]);

const ENVIRONMENTS = new Set(['testnet', 'staging', 'production']);

function required(value, field) {
  if (value === undefined || value === null || value === '') throw new Error(`${field} is required`);
  return value;
}

function address(value, field, { optional = false } = {}) {
  if ((value === undefined || value === null || value === '') && optional) return null;
  const normalized = String(required(value, field));
  if (!ADDRESS_RE.test(normalized) || /^0x0{40}$/i.test(normalized)) throw new Error(`${field} must be a non-zero address`);
  return normalized.toLowerCase();
}

function uint(value, field, { positive = false } = {}) {
  const n = Number(required(value, field));
  if (!Number.isSafeInteger(n) || n < 0 || (positive && n === 0)) throw new Error(`${field} must be a ${positive ? 'positive' : 'non-negative'} safe integer`);
  return n;
}

function normalizeCampaign(campaign) {
  const contributionType = String(required(campaign?.contributionType, 'campaign.contributionType')).toUpperCase();
  if (!Object.hasOwn(BONG_GOGGLES_CONTRIBUTION_TYPES, contributionType)) {
    throw new Error(`unknown Bong Goggles contribution type: ${contributionType}`);
  }

  const enabled = campaign.enabled === true;
  const maxRewardPerContribution = uint(campaign.maxRewardPerContribution, 'campaign.maxRewardPerContribution', { positive: enabled });
  const maxRewardPerAccount = uint(campaign.maxRewardPerAccount, 'campaign.maxRewardPerAccount', { positive: enabled });
  const totalBudget = uint(campaign.totalBudget, 'campaign.totalBudget', { positive: enabled });
  const startsAt = uint(campaign.startsAt, 'campaign.startsAt');
  const endsAt = uint(campaign.endsAt, 'campaign.endsAt');

  if (enabled && maxRewardPerAccount < maxRewardPerContribution) {
    throw new Error('campaign maxRewardPerAccount cannot be below maxRewardPerContribution');
  }
  if (enabled && totalBudget < maxRewardPerContribution) {
    throw new Error('campaign totalBudget cannot be below maxRewardPerContribution');
  }
  if (enabled && endsAt <= startsAt) throw new Error('campaign endsAt must be after startsAt');

  return Object.freeze({
    contributionType,
    contributionIdPreimage: BONG_GOGGLES_CONTRIBUTION_TYPES[contributionType],
    enabled,
    scorer: address(campaign.scorer, 'campaign.scorer', { optional: !enabled }),
    policy: address(campaign.policy, 'campaign.policy', { optional: true }),
    maxRewardPerContribution,
    maxRewardPerAccount,
    totalBudget,
    startsAt,
    endsAt,
  });
}

export function validateBongGogglesRewardConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('reward config object required');
  if (config.schema !== BONG_GOGGLES_REWARD_SCHEMA) throw new Error('unsupported Bong Goggles reward config schema');

  const environment = String(required(config.environment, 'environment')).toLowerCase();
  if (!ENVIRONMENTS.has(environment)) throw new Error('environment must be testnet, staging or production');

  const contracts = {};
  for (const dependency of BONG_GOGGLES_REWARD_DEPENDENCIES) {
    contracts[dependency] = address(config.contracts?.[dependency], `contracts.${dependency}`);
  }

  if (!Array.isArray(config.campaigns)) throw new Error('campaigns must be an array');
  const seen = new Set();
  const campaigns = config.campaigns.map((campaign) => {
    const normalized = normalizeCampaign(campaign);
    if (seen.has(normalized.contributionType)) throw new Error(`duplicate campaign intent for ${normalized.contributionType}`);
    seen.add(normalized.contributionType);
    return normalized;
  }).sort((a, b) => a.contributionType.localeCompare(b.contributionType));

  return Object.freeze({
    schema: BONG_GOGGLES_REWARD_SCHEMA,
    environment,
    appId: BONG_GOGGLES_APP_ID,
    contracts: Object.freeze(contracts),
    campaigns: Object.freeze(campaigns),
    createsCampaigns: false,
    fundsCampaigns: false,
    activatesCampaigns: false,
    authoritative: false,
  });
}

export function rewardConfigInventory(config) {
  const validated = validateBongGogglesRewardConfig(config);
  return Object.freeze({
    schema: validated.schema,
    environment: validated.environment,
    appId: validated.appId,
    supportedContributionTypes: Object.freeze(Object.entries(BONG_GOGGLES_CONTRIBUTION_TYPES).map(([name, preimage]) => Object.freeze({ name, preimage }))),
    dependencies: BONG_GOGGLES_REWARD_DEPENDENCIES,
    configuredCampaignTypes: Object.freeze(validated.campaigns.map((campaign) => campaign.contributionType)),
    canonicalFlow: Object.freeze([
      'BongGogglesContributionVerifier420',
      'BongGogglesRewardsAdapter420',
      'ContributionRegistry420',
      'RewardCampaignRegistry420',
      'RewardDistributor420',
      'RewardPool420',
    ]),
    authoritative: false,
  });
}

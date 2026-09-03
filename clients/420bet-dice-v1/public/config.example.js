// Copy the promoted deployment values into config.js at deploy time.
// Do not ship placeholder addresses to production.
window.__420_DICE_CONFIG__ = {
  chainId: 420,
  chainName: '420 Integrated',
  rpcUrl: 'https://REPLACE_WITH_PROMOTED_RPC',
  nativeCurrency: {
    name: '420',
    symbol: '420',
    decimals: 18,
  },
  contracts: {
    dice: '0xREPLACE_DICE_V1',
    diceView: '0xREPLACE_DICE_VIEW',
    wagerRouter: '0xREPLACE_WAGER_ROUTER',
    vault: '0xREPLACE_BANKROLL_VAULT',
    asset: '0xREPLACE_STAKE_ASSET_OR_ZERO_ADDRESS',
    betAuthorization: '0xREPLACE_BET_AUTHORIZATION',
  },
  ids: {
    gameId: '0xREPLACE_GAME_ID',
    gameVersionId: '0xREPLACE_GAME_VERSION_ID',
    operatorId: '0xREPLACE_OPERATOR_ID',
  },
  deadlineSeconds: 300n,
  rootSelector: '#dice420',
};

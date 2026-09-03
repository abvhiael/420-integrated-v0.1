export const diceAbi = [
  {
    type: 'function',
    name: 'hashParams',
    stateMutability: 'view',
    inputs: [{ name: 'params', type: 'tuple', components: [
      { name: 'rollUnder', type: 'bool' },
      { name: 'threshold', type: 'uint16' },
      { name: 'winGrossPayout', type: 'uint256' }
    ]}],
    outputs: [{ name: '', type: 'bytes32' }]
  }
] as const;

export const wagerRouterAbi = [
  {
    type: 'function',
    name: 'placeWager',
    stateMutability: 'payable',
    inputs: [{ name: 'request', type: 'tuple', components: [
      { name: 'operatorId', type: 'bytes32' },
      { name: 'gameVersionId', type: 'bytes32' },
      { name: 'stake', type: 'uint256' },
      { name: 'maxGrossPayout', type: 'uint256' },
      { name: 'paramsHash', type: 'bytes32' },
      { name: 'correlationKey', type: 'bytes32' },
      { name: 'deadline', type: 'uint64' }
    ]}],
    outputs: [
      { name: 'wagerId', type: 'bytes32' },
      { name: 'reservedLiability', type: 'uint256' }
    ]
  },
  {
    type: 'event',
    name: 'WagerAcceptanceCompleted',
    anonymous: false,
    inputs: [
      { indexed: true, name: 'wagerId', type: 'bytes32' },
      { indexed: true, name: 'player', type: 'address' },
      { indexed: true, name: 'gameVersionId', type: 'bytes32' },
      { indexed: false, name: 'vaultId', type: 'bytes32' },
      { indexed: false, name: 'stake', type: 'uint256' },
      { indexed: false, name: 'maxGrossPayout', type: 'uint256' },
      { indexed: false, name: 'reservedLiability', type: 'uint256' },
      { indexed: false, name: 'nonce', type: 'uint256' }
    ]
  }
] as const;

export const diceViewAbi = [
  {
    type: 'function',
    name: 'snapshot',
    stateMutability: 'view',
    inputs: [
      { name: 'wagerId', type: 'bytes32' },
      { name: 'params', type: 'tuple', components: [
        { name: 'rollUnder', type: 'bool' },
        { name: 'threshold', type: 'uint16' },
        { name: 'winGrossPayout', type: 'uint256' }
      ]}
    ],
    outputs: [{ name: 's', type: 'tuple', components: [
      { name: 'wager', type: 'tuple', components: [
        { name: 'wagerId', type: 'bytes32' },
        { name: 'player', type: 'address' },
        { name: 'operatorId', type: 'bytes32' },
        { name: 'gameId', type: 'bytes32' },
        { name: 'gameVersionId', type: 'bytes32' },
        { name: 'asset', type: 'address' },
        { name: 'stake', type: 'uint256' },
        { name: 'maxGrossPayout', type: 'uint256' },
        { name: 'paramsHash', type: 'bytes32' },
        { name: 'vaultId', type: 'bytes32' },
        { name: 'randomnessProfileId', type: 'bytes32' },
        { name: 'riskProfileId', type: 'bytes32' },
        { name: 'settlementProfileId', type: 'bytes32' },
        { name: 'accessPolicyId', type: 'bytes32' },
        { name: 'rulesetId', type: 'bytes32' },
        { name: 'acceptedAt', type: 'uint64' },
        { name: 'deadline', type: 'uint64' },
        { name: 'status', type: 'uint8' }
      ]},
      { name: 'randomnessRequested', type: 'bool' },
      { name: 'randomness', type: 'tuple', components: [
        { name: 'wagerId', type: 'bytes32' },
        { name: 'profileId', type: 'bytes32' },
        { name: 'gameVersionId', type: 'bytes32' },
        { name: 'paramsHash', type: 'bytes32' },
        { name: 'contextHash', type: 'bytes32' },
        { name: 'requestedAt', type: 'uint64' },
        { name: 'fallbackAt', type: 'uint64' },
        { name: 'root', type: 'bytes32' },
        { name: 'proofHash', type: 'bytes32' },
        { name: 'entropyHash', type: 'bytes32' },
        { name: 'source', type: 'uint8' },
        { name: 'fulfilled', type: 'bool' }
      ]},
      { name: 'settlementExists', type: 'bool' },
      { name: 'settlement', type: 'tuple', components: [
        { name: 'wagerId', type: 'bytes32' },
        { name: 'outcome', type: 'uint8' },
        { name: 'grossPayout', type: 'uint256' },
        { name: 'settledAt', type: 'uint64' }
      ]},
      { name: 'paramsMatch', type: 'bool' },
      { name: 'resultAvailable', type: 'bool' },
      { name: 'result', type: 'tuple', components: [
        { name: 'wagerId', type: 'bytes32' },
        { name: 'roll', type: 'uint16' },
        { name: 'outcome', type: 'uint8' },
        { name: 'grossPayout', type: 'uint256' },
        { name: 'paramsHash', type: 'bytes32' },
        { name: 'randomnessRoot', type: 'bytes32' }
      ]}
    ]}]
  }
] as const;

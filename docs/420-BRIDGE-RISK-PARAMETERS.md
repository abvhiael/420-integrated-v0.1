# 420 Bridge — Genesis Risk Parameters

Both per-route and per-asset aggregate limits apply. The stricter remaining allowance wins.

## CADC
Aggregate: 25,000 max single; 100,000/hour each direction; 250,000/day each direction; 2,000,000 CADC total 420-side exposure.
Routes: Ethereum 25k/75k/150k/750k; Base 15k/50k/100k/500k; Arbitrum 15k/50k/100k/500k; Polygon 10k/25k/50k/250k; Solana 10k/25k/50k/250k. Route figures are single/hour/day/TVL and apply independently in each direction for flow limits.

## USDC
Aggregate: 25,000 max single; 100,000/hour; 250,000/day; 2,000,000 USDC exposure. Ethereum route 25k/75k/150k/750k; Base and Arbitrum 15k/50k/100k/500k. USDC remains inactive until Circle CCTP supports 420.

## ETH
5 ETH single; 20 ETH/hour; 50 ETH/day; 250 ETH total exposure.

## BTC
All limits are zero. BTC remains APPROVED_INACTIVE until withdrawal custody is separately approved.

## Governance
Safety reductions and pauses may be immediate under authorized emergency controls. Limit increases require G2 or stronger. Fundamental verification-mechanism changes are G3. Route, asset, direction, and global pauses are distinct.

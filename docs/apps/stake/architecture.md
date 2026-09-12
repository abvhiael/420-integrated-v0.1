# 420 Stake architecture

`Stake420` is a read-oriented facade. Canonical validator lifecycle and collateral accounting belong to `ValidatorRegistry`; protocol-owned matched credit belongs to `CommunityValidatorReserve`; consensus-issued reward accounting reaches `RewardController` only through the bound consensus system path.

The application may use Indexer/Explorer for presentation, but those views cannot admit validators, choose committees, slash balances or mint rewards.
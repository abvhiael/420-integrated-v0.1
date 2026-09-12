# Names events and finality

Registration, renewal, resolution changes and transfers emit on-chain history. Applications consuming indexed events must account for reorg/finality status.

Do not permanently cache a pre-finality transfer or renewal without a reconciliation path.
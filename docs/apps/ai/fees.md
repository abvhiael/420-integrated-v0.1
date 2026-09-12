# 420 AI fees

AI compute settles in native `$420` by default at Genesis. A request binds a user-authorized maximum spend; accepted execution and settlement cannot exceed that maximum.

Network gas is separate from compute price. Provider/ComputeMarket pricing, any verification cost and refundable/unused funding should be presented separately rather than hidden in one opaque total.

Direct legacy escrow custody is disabled; settlement/refunds follow the bound Vault/settlement path.
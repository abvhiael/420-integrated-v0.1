# 420 AI API and provider boundary

Read APIs may expose providers, model versions, job lifecycle, result commitments, verification and settlement state. Off-chain endpoints may handle payload upload/download, worker status and delivery.

Never treat an off-chain provider endpoint or matcher response as canonical authorization. Economically material match terms and canonical lifecycle state must be checked on-chain.
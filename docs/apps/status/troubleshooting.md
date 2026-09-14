# Troubleshooting

If Status is unavailable, query direct canonical/health interfaces. If Status disagrees with chain/protocol state, canonical state wins and the disagreement should be treated as an observability incident. If a component is green but your transaction failed, inspect the transaction/protocol rather than assuming Status proves success.

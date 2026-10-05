# 420 Token troubleshooting

## Deployment is blocked before signing

Confirm the Wallet resolved `420/service/token/v1` on the intended chain. The runtime must have verified, distinct, code-bearing TokenFactory420, TokenTemplateRegistry420 and community Treasury Vault identities. A wrong service ID, zero/missing code hash, aliased dependency, wrong Vault ID or wrong release version is supposed to fail closed.

## Transaction simulation fails

Check:

- the target is the verified current TokenFactory420;
- the transaction carries exactly 42 native 420;
- the account has enough native 420 for the fee plus gas;
- the chosen template is enabled;
- an ERC20 capped configuration has a nonzero cap and initial supply no greater than the cap;
- the factory calldata is non-empty and matches the reviewed template/configuration;
- the community Vault is registered/active and can accept a native deposit.

A Treasury/Vault failure reverts the entire deployment, including creator nonce and factory provenance changes.

## Token behavior is unexpected

For mint errors, confirm you selected a mintable/capped profile and that the current owner is calling. For capped supply, the immutable cap cannot be exceeded. For burn errors, confirm the profile supports burn and that the caller owns or has sufficient allowance for the amount.

For permits, check deadline, holder nonce, chain ID, verifying contract and signature encoding. A permit from another token or chain, a replayed permit, a noncanonical signature or an expired permit must fail.

For vote totals, remember balances do not count until delegated. Historical queries require a block strictly earlier than the current block.

For ERC721/ERC1155 safe transfer failures to a contract, verify the recipient implements the corresponding receiver callback.

## Token is absent from another 420 app

Token deployment does not imply downstream acceptance. Swap/Exchange, Pay, Bridge and Launchpad each apply their own eligibility rules. Explorer/Search/Analytics are derived views; indexing delay or rebuild does not change canonical token ownership or factory provenance.

## Address disagreement

Do not use the retired historical Token factory candidate `0x0455`. The current Genesis address authority explicitly requires TokenFactory420 to be Registry-resolved with no fixed Genesis address. For live environments, use the release-qualified Registry result and verify runtime code/dependencies.

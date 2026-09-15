# 420 Token architecture

`TokenTemplateRegistry420` governs approved template profiles and enable/disable state. `TokenFactory420` deploys new assets deterministically and records provenance.

The factory does not retain post-deployment token custody or mint authority. Ownership/mint/burn/permit/vote behavior is defined by the selected template and deployed token state.

Native `$420` remains separate from every factory-created ERC asset.

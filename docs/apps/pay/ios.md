# 420 Pay for iOS

The iOS client uses the same shared SDK and link rules as the Android app.
Native QR scanning and sharing feed the same link review. The bundled SDK runs
in an isolated, nonpersistent WebKit view with no remote navigation or network
access from the bundled page. Hosted review loads current invoice terms and
requests Wallet approval. The app keeps review and return state in memory and
shields the app preview when it leaves the foreground.

## Build and qualify

On macOS, install Xcode and XcodeGen. Install the locked Node dependencies
in `packages/420-pay-sdk` and `pay/web`, then build the SDK. Run
`node pay/ios/build-sdk.mjs` from the repository root and `xcodegen generate`
from `pay/ios`. Build the `Pay420` scheme for a generic iOS device. Run its
unit and UI tests on an iPhone simulator with `PAY_CHAIN_ID=420` and
`WALLET_LINK_HOST=wallet.example.test`. Those values are test fixtures.

## Universal Links and payment authority

Set `PAY_LINK_HOST`, `PAY_CHAIN_ID` and `WALLET_LINK_HOST` from the approved
deployment. The default chain and Wallet host are unset. For a signed
release, publish the Apple App Site Association records for the Pay app
on its `/wallet-return` path and the Wallet app on its `/connect` path.
The apps' signed associated-domain entitlements must match the host records.
Only enable the Pay callback path for the Pay app so hosted root links open in
the browser.

iOS opens Wallet with Universal Links Only. Pay accepts a return only for
its exact live request and consumes that request once. A return does not
convey payment approval or settlement. The existing iOS Wallet displays
inbound requests. Native transaction approval and a Wallet-produced return
still depend on Wallet transport wiring and the signed deployment. Hosted
checkout remains the approval path. Pay registers no push token and stores
no Wallet signing material.

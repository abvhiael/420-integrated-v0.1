# 420 Pay for Android

The Android client uses the shared Pay SDK and link parser inside a
network-disabled WebView that loads only bundled assets. Native QR scan,
manual link input and sharing use the same link checks. Open hosted review to
load current invoice terms and request Wallet approval. Link validation alone
does not confirm settlement.

## Build and qualify

Use Java 17, Gradle 8.10.2, Android SDK 35 and Node.js 22. Install the locked
dependencies in `packages/420-pay-sdk` and `pay/web`, then build the Pay SDK.
From `pay/android`, run `node --test web/sdk.test.mjs` and
`gradle :app:assembleRelease :app:bundleRelease`. The release artifacts are
unsigned. Run `gradle :app:connectedDebugAndroidTest -PpayChainId=420
-PwalletHost=wallet.example.test` on an API 35 emulator for local qualification.
The documentation test chain and Wallet host are fixtures.

## App Links and payment authority

Set `payHost`, `payChainId` and `walletHost` from the approved deployment.
The default build leaves the chain and Wallet host unset. Publish the
Digital Asset Links statements for the Pay release certificate on the Pay
host and the Wallet release certificate on the Wallet host. The Wallet build
must claim its configured HTTPS `/connect` link. Pay requires the Wallet
package and OS-verified host binding before handing it an expiring intent.
The return path only matches a live request in memory and consumes it once.
A matched return prompts a canonical state check through hosted checkout.

The current Android Wallet app parses and displays inbound approval requests.
Live native transaction approval and a Wallet-produced return depend on
Wallet transport wiring and the signed, verified deployment. Neither the
Android Pay app nor a callback can sign or declare a payment settled.

Return reminders are opt-in and generic. They contain no amount, merchant,
invoice, QR data or status and are hidden on the lock screen. Pay stores no
Wallet signing material and retains no review session after process restart.

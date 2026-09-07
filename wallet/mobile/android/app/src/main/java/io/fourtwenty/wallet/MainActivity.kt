package io.fourtwenty.wallet

import android.content.Intent
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch

class MainActivity : FragmentActivity() {
    private lateinit var titleView: TextView
    private lateinit var statusView: TextView
    private lateinit var unlockButton: Button
    private var localLocked = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        AndroidDeviceSecurity420.enablePrivacyShield(this)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 48, 32, 32)
        }
        titleView = TextView(this).apply { text = "420 Wallet"; textSize = 24f }
        statusView = TextView(this).apply { text = walletText(); textSize = 16f; setPadding(0, 24, 0, 24) }
        unlockButton = Button(this).apply {
            text = "Unlock wallet"
            visibility = View.GONE
            setOnClickListener { authorizeLocalUnlock() }
        }
        root.addView(titleView)
        root.addView(statusView)
        root.addView(unlockButton)
        root.addView(navigationRow())
        setContentView(root)

        val securitySignals = AndroidDeviceSecurity420.inspect(this)
        if (securitySignals.rooted || securitySignals.debuggerAttached) enterLocalLock("device security risk detected\nre-authentication required")

        AndroidPush420.register(
            onToken = { token -> getSharedPreferences("wallet420_push_v1", MODE_PRIVATE).edit().putString("fcm_token", token).apply() },
            onError = { getSharedPreferences("wallet420_push_v1", MODE_PRIVATE).edit().remove("fcm_token").apply() },
        )
        if (!localLocked) {
            handleIntent(intent)
            consumePendingPush()
        }
    }

    override fun onResume() {
        super.onResume()
        if (!localLocked) consumePendingPush()
    }

    override fun onPause() {
        AndroidDeviceSecurity420.onBackground(this) { enterLocalLock("unlock required after backgrounding") }
        super.onPause()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (!localLocked) {
            handleIntent(intent)
            consumePendingPush()
        }
    }

    private fun navigationRow(): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER
        addView(navButton("Wallet") { showSurface("Wallet", walletText()) })
        addView(navButton("Apps") { showSurface("Apps", appsText()) })
        addView(navButton("Activity") { showSurface("Activity", activityText()) })
        addView(navButton("Security") { showSurface("Security", securityText()) })
    }

    private fun navButton(label: String, action: () -> Unit): Button = Button(this).apply {
        text = label
        setOnClickListener { if (!localLocked) action() }
    }

    private fun showSurface(title: String, body: String) {
        if (localLocked) return
        titleView.text = title
        statusView.text = body
    }

    private fun enterLocalLock(reason: String) {
        localLocked = true
        titleView.text = "420 Wallet Locked"
        statusView.text = reason
        unlockButton.visibility = View.VISIBLE
    }

    private fun authorizeLocalUnlock() {
        val signals = AndroidDeviceSecurity420.inspect(this)
        if (signals.rooted || signals.debuggerAttached) {
            enterLocalLock("device security risk detected\nunlock blocked")
            return
        }
        val gate = AndroidBiometricGate420(this, ContextCompat.getMainExecutor(this))
        if (!gate.isAvailable()) {
            enterLocalLock("device authentication unavailable")
            return
        }
        lifecycleScope.launch {
            val authorized = try {
                gate.authorize("Unlock 420 Wallet after backgrounding")
            } catch (_: Exception) {
                false
            }
            if (!authorized) {
                enterLocalLock("unlock cancelled or failed")
                return@launch
            }
            localLocked = false
            unlockButton.visibility = View.GONE
            titleView.text = "420 Wallet"
            statusView.text = walletText()
            // Local presence only restores presentation access; canonical SmartAccount authority is unchanged.
            consumePendingPush()
        }
    }

    private fun walletText() = "Portfolio\nAssets and balances from qualified Wallet Core\n\nSend · Receive · Connect"
    private fun appsText() = "420 Integrated Apps\nHTTPS destinations only\n\nSearch · AppStore · AI · Swap · Bridge · Stake · Governance"
    private fun activityText() = "Activity\nUserOperation status, chain, hash, and timestamps\n\nPresentation only — no signing authority"
    private fun securityText() = "Security Center\nPasskeys · Sessions · dApp permissions · Recovery · Device"

    private fun consumePendingPush() {
        if (localLocked) return
        val reference = AndroidPush420.consumePending(this) ?: return
        // Shared Wallet Core must canonically rehydrate and revalidate before approval.
        titleView.text = "Approval Request"
        statusView.text = "push (${reference.state})\n${reference.origin}\n${reference.requestId}"
    }

    private fun handleIntent(intent: Intent?) {
        if (localLocked) return
        val value = intent?.dataString ?: return
        titleView.text = "Approval Request"
        statusView.text = try {
            val handoff = AndroidDappHandoffParser420.parse(
                value,
                productionHost = BuildConfig.WALLET_LINK_HOST,
                allowDevelopmentScheme = BuildConfig.DEBUG,
            )
            "request from ${handoff.origin}\n${handoff.requestId}"
        } catch (_: Exception) {
            "rejected invalid handoff"
        }
    }
}

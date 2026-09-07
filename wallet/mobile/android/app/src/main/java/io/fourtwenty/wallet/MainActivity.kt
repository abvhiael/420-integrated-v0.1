package io.fourtwenty.wallet

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.view.Gravity
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

class MainActivity : Activity() {
    private lateinit var titleView: TextView
    private lateinit var statusView: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 48, 32, 32)
        }
        titleView = TextView(this).apply { text = "420 Wallet"; textSize = 24f }
        statusView = TextView(this).apply { text = walletText(); textSize = 16f; setPadding(0, 24, 0, 24) }
        root.addView(titleView)
        root.addView(statusView)
        root.addView(navigationRow())
        setContentView(root)

        AndroidPush420.register(
            onToken = { token -> getSharedPreferences("wallet420_push_v1", MODE_PRIVATE).edit().putString("fcm_token", token).apply() },
            onError = { getSharedPreferences("wallet420_push_v1", MODE_PRIVATE).edit().remove("fcm_token").apply() },
        )
        handleIntent(intent)
        consumePendingPush()
    }

    override fun onResume() {
        super.onResume()
        consumePendingPush()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIntent(intent)
        consumePendingPush()
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
        setOnClickListener { action() }
    }

    private fun showSurface(title: String, body: String) {
        titleView.text = title
        statusView.text = body
    }

    private fun walletText() = "Portfolio\nAssets and balances from qualified Wallet Core\n\nSend · Receive · Connect"
    private fun appsText() = "420 Integrated Apps\nHTTPS destinations only\n\nSearch · AppStore · AI · Swap · Bridge · Stake · Governance"
    private fun activityText() = "Activity\nUserOperation status, chain, hash, and timestamps\n\nPresentation only — no signing authority"
    private fun securityText() = "Security Center\nPasskeys · Sessions · dApp permissions · Recovery · Device"

    private fun consumePendingPush() {
        val reference = AndroidPush420.consumePending(this) ?: return
        titleView.text = "Approval Request"
        statusView.text = "push (${reference.state})\n${reference.origin}\n${reference.requestId}"
    }

    private fun handleIntent(intent: Intent?) {
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

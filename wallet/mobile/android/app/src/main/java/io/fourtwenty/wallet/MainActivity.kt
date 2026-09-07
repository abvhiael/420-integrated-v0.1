package io.fourtwenty.wallet

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.widget.TextView

class MainActivity : Activity() {
    private lateinit var statusView: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        statusView = TextView(this).apply {
            text = "420 Wallet — W11 native bootstrap"
            textSize = 20f
            setPadding(32, 64, 32, 32)
        }
        setContentView(statusView)
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

    private fun consumePendingPush() {
        val reference = AndroidPush420.consumePending(this) ?: return
        // Presentation only. Shared Wallet Core must canonically rehydrate and revalidate before approval.
        statusView.text = "420 Wallet push (${reference.state})\n${reference.origin}\n${reference.requestId}"
    }

    private fun handleIntent(intent: Intent?) {
        val value = intent?.dataString ?: return
        statusView.text = try {
            val handoff = AndroidDappHandoffParser420.parse(
                value,
                productionHost = BuildConfig.WALLET_LINK_HOST,
                allowDevelopmentScheme = BuildConfig.DEBUG,
            )
            "420 Wallet request\n${handoff.origin}\n${handoff.requestId}"
        } catch (_: Exception) {
            "420 Wallet — rejected invalid handoff"
        }
    }
}

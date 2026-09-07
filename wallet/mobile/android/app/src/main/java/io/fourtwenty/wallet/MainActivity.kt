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
        handleIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIntent(intent)
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

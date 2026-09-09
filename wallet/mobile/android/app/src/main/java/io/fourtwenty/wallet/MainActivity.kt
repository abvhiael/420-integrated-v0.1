package io.fourtwenty.wallet

import android.content.Intent
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch

class MainActivity : FragmentActivity() {
    private lateinit var titleView: TextView
    private lateinit var statusView: TextView
    private lateinit var contentHost: LinearLayout
    private lateinit var unlockButton: Button
    private lateinit var navigation: LinearLayout
    private var localLocked = false
    private var selectedSurface = "Wallet"
    private var onboardingActive = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        AndroidDeviceSecurity420.enablePrivacyShield(this)

        val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        Wallet420DesignSystem.applyRoot(root)

        titleView = TextView(this).apply {
            text = "420 Wallet"
            Wallet420DesignSystem.styleTitle(this)
            contentDescription = "420 Wallet"
        }
        statusView = TextView(this).apply { Wallet420DesignSystem.styleBody(this) }
        unlockButton = Button(this).apply {
            text = "Unlock wallet"
            visibility = View.GONE
            Wallet420DesignSystem.styleAction(this)
            setOnClickListener { authorizeLocalUnlock() }
        }
        contentHost = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        navigation = navigationRow()

        root.addView(titleView)
        root.addView(Wallet420DesignSystem.verticalSpace(root, Wallet420DesignSystem.SPACE_SM_DP))
        root.addView(statusView)
        root.addView(Wallet420DesignSystem.verticalSpace(root, Wallet420DesignSystem.SPACE_MD_DP))
        root.addView(unlockButton)

        val scroll = ScrollView(this).apply {
            isFillViewport = true
            addView(contentHost)
        }
        root.addView(scroll, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f))
        root.addView(Wallet420DesignSystem.verticalSpace(root, Wallet420DesignSystem.SPACE_SM_DP))
        root.addView(navigation)
        setContentView(root)

        onboardingActive = !getSharedPreferences("wallet420_onboarding_v1", MODE_PRIVATE)
            .getBoolean("completed", false)
        if (onboardingActive) renderOnboardingWelcome() else showSurface("Wallet")

        val securitySignals = AndroidDeviceSecurity420.inspect(this)
        if (securitySignals.rooted || securitySignals.debuggerAttached) enterLocalLock("device security risk detected\nre-authentication required")

        AndroidPush420.register(
            onToken = { token -> getSharedPreferences("wallet420_push_v1", MODE_PRIVATE).edit().putString("fcm_token", token).apply() },
            onError = { getSharedPreferences("wallet420_push_v1", MODE_PRIVATE).edit().remove("fcm_token").apply() },
        )
        if (!localLocked && !onboardingActive) {
            handleIntent(intent)
            consumePendingPush()
        }
    }

    override fun onResume() {
        super.onResume()
        if (!localLocked && !onboardingActive) consumePendingPush()
    }

    override fun onPause() {
        AndroidDeviceSecurity420.onBackground(this) { enterLocalLock("unlock required after backgrounding") }
        super.onPause()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (!localLocked && !onboardingActive) {
            handleIntent(intent)
            consumePendingPush()
        }
    }

    private fun navigationRow(): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER
        addView(navButton("Wallet"))
        addView(navButton("Apps"))
        addView(navButton("Activity"))
        addView(navButton("Security"))
    }

    private fun navButton(label: String): Button = Button(this).apply {
        text = label
        contentDescription = "$label tab"
        Wallet420DesignSystem.styleNavigation(this, selectedSurface == label)
        setOnClickListener { if (!localLocked && !onboardingActive) showSurface(label) }
    }

    private fun renderOnboardingWelcome() {
        onboardingActive = true
        navigation.visibility = View.GONE
        titleView.text = "Welcome to 420 Wallet"
        titleView.contentDescription = "420 Wallet onboarding"
        statusView.text = "Your SmartAccount is the canonical account. This phone is a secure local client for passkeys, approvals, recovery access, and wallet presentation."
        contentHost.removeAllViews()
        contentHost.addView(card("Built for local authorization", "Private signing material stays device-bound where supported. Public RPC is transport only and never signing authority."))
        contentHost.addView(space())
        contentHost.addView(card("Recovery matters", "Your device is replaceable. Recovery follows canonical SmartAccount policy, not an app-local password or hidden remote signer."))
        contentHost.addView(space())
        contentHost.addView(onboardingChoiceCard())
        Wallet420DesignSystem.animateContentIn(contentHost)
    }

    private fun onboardingChoiceCard(): LinearLayout = LinearLayout(this).apply {
        Wallet420DesignSystem.styleCard(this)
        addView(sectionTitle("How do you want to begin?"))
        addView(Wallet420DesignSystem.verticalSpace(this, Wallet420DesignSystem.SPACE_SM_DP))
        addView(onboardingButton("Set up a new wallet") { renderOnboardingSecurity("new") })
        addView(Wallet420DesignSystem.verticalSpace(this, Wallet420DesignSystem.SPACE_SM_DP))
        addView(onboardingButton("Find an existing wallet") { renderOnboardingSecurity("existing") })
        addView(Wallet420DesignSystem.verticalSpace(this, Wallet420DesignSystem.SPACE_SM_DP))
        addView(onboardingButton("Recover a wallet") { renderOnboardingSecurity("recovery") })
    }

    private fun onboardingButton(label: String, action: () -> Unit): Button = Button(this).apply {
        text = label
        contentDescription = label
        Wallet420DesignSystem.styleSecondaryAction(this)
        setOnClickListener { if (!localLocked) action() }
    }

    private fun renderOnboardingSecurity(path: String) {
        titleView.text = "Secure your wallet"
        statusView.text = when (path) {
            "new" -> "Wallet Core will create/discover the canonical SmartAccount and bind a passkey through the qualified account bootstrap flow."
            "existing" -> "Wallet Core will discover the canonical SmartAccount before this device receives any local authorization capability."
            else -> "Recovery uses the canonical recovery policy and timelock. This app cannot bypass or replace that authority."
        }
        contentHost.removeAllViews()
        contentHost.addView(card("Passkeys", "Passkeys authorize locally with platform security. Biometrics prove local presence only; they do not become account authority."))
        contentHost.addView(space())
        contentHost.addView(card("Before you continue", "Review recovery, keep device security enabled, and remember that dApp permissions are scoped, revocable, and independently revalidated."))
        contentHost.addView(space())
        contentHost.addView(Button(this).apply {
            text = "Continue to wallet"
            contentDescription = "Complete onboarding"
            Wallet420DesignSystem.styleAction(this)
            setOnClickListener { completeOnboarding() }
        })
        contentHost.addView(space())
        contentHost.addView(Button(this).apply {
            text = "Back"
            contentDescription = "Back to onboarding choices"
            Wallet420DesignSystem.styleSecondaryAction(this)
            setOnClickListener { renderOnboardingWelcome() }
        })
        Wallet420DesignSystem.animateContentIn(contentHost)
        Wallet420DesignSystem.pulseStatus(statusView)
    }

    private fun completeOnboarding() {
        getSharedPreferences("wallet420_onboarding_v1", MODE_PRIVATE).edit().putBoolean("completed", true).apply()
        onboardingActive = false
        navigation.visibility = View.VISIBLE
        showSurface("Wallet")
        statusView.text = "Onboarding complete. Account, passkey, recovery, and signing authority remain governed by Wallet Core and canonical SmartAccount policy."
        Wallet420DesignSystem.pulseStatus(statusView)
        handleIntent(intent)
        consumePendingPush()
    }

    private fun showSurface(surface: String) {
        if (localLocked || onboardingActive) return
        selectedSurface = surface
        titleView.text = if (surface == "Wallet") "420 Wallet" else surface
        titleView.contentDescription = titleView.text
        statusView.text = when (surface) {
            "Wallet" -> "Your portfolio, actions, and recent wallet activity."
            "Apps" -> "Trusted entry points into the 420 Integrated ecosystem."
            "Activity" -> "Track submitted UserOperations and wallet events."
            else -> "Manage passkeys, sessions, permissions, recovery, and this device."
        }
        contentHost.removeAllViews()
        when (surface) {
            "Wallet" -> renderWallet()
            "Apps" -> renderApps()
            "Activity" -> renderActivity()
            else -> renderSecurity()
        }
        refreshNavigation()
        Wallet420DesignSystem.animateContentIn(contentHost)
    }

    private fun refreshNavigation() {
        for (index in 0 until navigation.childCount) {
            val button = navigation.getChildAt(index) as? Button ?: continue
            Wallet420DesignSystem.styleNavigation(button, button.text.toString() == selectedSurface)
        }
    }

    private fun renderWallet() {
        contentHost.addView(card("Portfolio", "$420  —  balance from Wallet Core\nAssets stay chain-derived and presentation-only here."))
        contentHost.addView(space())
        contentHost.addView(actionCard("Quick actions", listOf("Send", "Receive", "Connect")))
        contentHost.addView(space())
        contentHost.addView(card("Recent activity", "No local signing state is stored in this screen.\nOpen Activity for UserOperation status and transaction details."))
    }

    private fun renderApps() {
        contentHost.addView(card("420 Integrated", "HTTPS destinations only. App navigation never becomes signing authority."))
        contentHost.addView(space())
        contentHost.addView(card("Discover", "Search · AppStore · AI"))
        contentHost.addView(space())
        contentHost.addView(card("Finance & governance", "Swap · Bridge · Stake · Governance"))
    }

    private fun renderActivity() {
        contentHost.addView(card("UserOperations", "Status · chain · hash · timestamps"))
        contentHost.addView(space())
        contentHost.addView(card("Authority boundary", "Activity is presentation-only. Submission and signing remain governed by Wallet Core and canonical SmartAccount policy."))
    }

    private fun renderSecurity() {
        contentHost.addView(card("Authentication", "Passkeys · local biometric presence · session keys"))
        contentHost.addView(space())
        contentHost.addView(card("Permissions", "dApp capabilities · session scope · expiry"))
        contentHost.addView(space())
        contentHost.addView(card("Recovery & device", "Recovery policy · device state · lost-device controls"))
    }

    private fun actionCard(title: String, actions: List<String>): LinearLayout = LinearLayout(this).apply {
        Wallet420DesignSystem.styleCard(this)
        addView(sectionTitle(title))
        addView(Wallet420DesignSystem.verticalSpace(this, Wallet420DesignSystem.SPACE_SM_DP))
        val row = LinearLayout(context).apply { orientation = LinearLayout.HORIZONTAL }
        actions.forEachIndexed { index, label ->
            val button = Button(context).apply {
                text = label
                contentDescription = "$label action"
                if (index == 0) Wallet420DesignSystem.styleAction(this) else Wallet420DesignSystem.styleSecondaryAction(this)
                setOnClickListener {
                    statusView.text = "$label request prepared for Wallet Core authorization"
                    Wallet420DesignSystem.pulseStatus(statusView)
                }
            }
            row.addView(button, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        }
        addView(row)
    }

    private fun card(title: String, body: String): LinearLayout = LinearLayout(this).apply {
        Wallet420DesignSystem.styleCard(this)
        addView(sectionTitle(title))
        addView(Wallet420DesignSystem.verticalSpace(this, Wallet420DesignSystem.SPACE_SM_DP))
        addView(TextView(context).apply {
            text = body
            Wallet420DesignSystem.styleBody(this)
        })
    }

    private fun sectionTitle(value: String): TextView = TextView(this).apply {
        text = value
        Wallet420DesignSystem.styleSectionTitle(this)
    }

    private fun space(): View = Wallet420DesignSystem.verticalSpace(contentHost, Wallet420DesignSystem.SPACE_MD_DP)

    private fun enterLocalLock(reason: String) {
        localLocked = true
        titleView.text = "420 Wallet Locked"
        statusView.text = reason
        contentHost.removeAllViews()
        unlockButton.visibility = View.VISIBLE
        Wallet420DesignSystem.pulseStatus(statusView)
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
            val authorized = try { gate.authorize("Unlock 420 Wallet after backgrounding") } catch (_: Exception) { false }
            if (!authorized) {
                enterLocalLock("unlock cancelled or failed")
                return@launch
            }
            localLocked = false
            unlockButton.visibility = View.GONE
            if (onboardingActive) renderOnboardingWelcome() else showSurface("Wallet")
            // Local presence only restores presentation access; canonical SmartAccount authority is unchanged.
            if (!onboardingActive) consumePendingPush()
        }
    }

    private fun consumePendingPush() {
        if (localLocked || onboardingActive) return
        val reference = AndroidPush420.consumePending(this) ?: return
        // Shared Wallet Core must canonically rehydrate and revalidate before approval.
        titleView.text = "Approval Request"
        statusView.text = "push (${reference.state})\n${reference.origin}\n${reference.requestId}"
        Wallet420DesignSystem.pulseStatus(statusView)
    }

    private fun handleIntent(intent: Intent?) {
        if (localLocked || onboardingActive) return
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
        Wallet420DesignSystem.pulseStatus(statusView)
    }
}

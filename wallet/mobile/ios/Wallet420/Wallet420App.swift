import SwiftUI

private enum WalletSurface420: String, CaseIterable, Identifiable {
    case wallet = "Wallet"
    case apps = "Apps"
    case activity = "Activity"
    case security = "Security"
    var id: String { rawValue }
    var accessibilityID: String { "wallet420.surface.\(rawValue.lowercased())" }
    var tabAccessibilityID: String { "wallet420.tab.\(rawValue.lowercased())" }
}

private enum OnboardingPath420: String {
    case newWallet
    case existingWallet
    case recovery
}

@main
struct Wallet420App: App {
    @UIApplicationDelegateAdaptor(AppDelegate420.self) private var appDelegate
    @Environment(\.scenePhase) private var scenePhase
    @AppStorage("wallet420.onboarding.completed") private var onboardingCompleted = false
    @State private var onboardingPath: OnboardingPath420?
    @State private var selectedSurface: WalletSurface420 = .wallet
    @State private var handoffStatus: String?
    @State private var privacyShield = false
    @State private var localLocked = false
    @State private var unlockStatus: String?
    @State private var transientStatus: String?

    private var isUITest: Bool {
        ProcessInfo.processInfo.arguments.contains("--ui-test")
    }

    private var onboardingActive: Bool {
        !onboardingCompleted && !isUITest
    }

    var body: some Scene {
        WindowGroup {
            ZStack {
                if onboardingActive {
                    onboardingRoot
                } else {
                    mainWalletRoot
                }

                if privacyShield {
                    Rectangle()
                        .fill(Wallet420DesignSystem.backgroundDark)
                        .ignoresSafeArea()
                    Text("420 Wallet Locked")
                        .font(.title2.bold())
                        .foregroundStyle(Wallet420DesignSystem.textPrimaryDark)
                        .accessibilityIdentifier("wallet420.privacy-shield")
                }
            }
            .task {
                if !isUITest {
                    try? await PushRegistration420.shared.register()
                    inspectDeviceSecurity()
                    if !localLocked && !onboardingActive { consumePendingPush() }
                } else {
                    privacyShield = false
                    localLocked = false
                    unlockStatus = nil
                    handoffStatus = nil
                    transientStatus = nil
                }
            }
            .onChange(of: scenePhase) { phase in
                if isUITest {
                    privacyShield = false
                    localLocked = false
                    unlockStatus = nil
                    return
                }

                switch phase {
                case .active:
                    privacyShield = UIScreen.main.isCaptured
                    inspectDeviceSecurity()
                    if !localLocked && !onboardingActive { consumePendingPush() }
                case .inactive, .background:
                    privacyShield = true
                    localLocked = true
                    unlockStatus = "unlock required after backgrounding"
                    handoffStatus = nil
                    transientStatus = nil
                @unknown default:
                    privacyShield = true
                    localLocked = true
                    unlockStatus = "unlock required"
                }
            }
            .onReceive(NotificationCenter.default.publisher(for: UIScreen.capturedDidChangeNotification)) { _ in
                if isUITest {
                    privacyShield = false
                } else {
                    privacyShield = UIScreen.main.isCaptured || scenePhase != .active
                }
            }
            .onOpenURL { url in if !localLocked && !onboardingActive { handle(url) } }
            .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { activity in
                if !localLocked && !onboardingActive, let url = activity.webpageURL { handle(url) }
            }
        }
    }

    private var onboardingRoot: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Wallet420DesignSystem.spacingMedium) {
                Text(onboardingPath == nil ? "Welcome to 420 Wallet" : "Secure your wallet")
                    .font(.system(size: 28, weight: .bold, design: .rounded))
                    .accessibilityIdentifier("wallet420.onboarding.title")

                if let onboardingPath {
                    onboardingSecurity(path: onboardingPath)
                } else {
                    Text("Your SmartAccount is the canonical account. This iPhone is a secure local client for passkeys, approvals, recovery access, and wallet presentation.")
                        .font(.body)
                        .foregroundStyle(.secondary)
                    infoCard(title: "Built for local authorization", body: "Private signing material stays device-bound where supported. Public RPC is transport only and never signing authority.")
                    infoCard(title: "Recovery matters", body: "Your device is replaceable. Recovery follows canonical SmartAccount policy, not an app-local password or hidden remote signer.")
                    onboardingChoices
                }
            }
            .padding(Wallet420DesignSystem.spacingMedium)
        }
        .wallet420Surface()
    }

    private var onboardingChoices: some View {
        VStack(alignment: .leading, spacing: Wallet420DesignSystem.spacingSmall) {
            Text("How do you want to begin?").font(.headline)
            Button("Set up a new wallet") { onboardingPath = .newWallet }
                .buttonStyle(Wallet420SecondaryButtonStyle())
                .accessibilityIdentifier("wallet420.onboarding.new")
            Button("Find an existing wallet") { onboardingPath = .existingWallet }
                .buttonStyle(Wallet420SecondaryButtonStyle())
                .accessibilityIdentifier("wallet420.onboarding.existing")
            Button("Recover a wallet") { onboardingPath = .recovery }
                .buttonStyle(Wallet420SecondaryButtonStyle())
                .accessibilityIdentifier("wallet420.onboarding.recovery")
        }
        .wallet420Card()
    }

    @ViewBuilder
    private func onboardingSecurity(path: OnboardingPath420) -> some View {
        let description: String = {
            switch path {
            case .newWallet:
                return "Wallet Core will create or discover the canonical SmartAccount and bind a passkey through the qualified account bootstrap flow."
            case .existingWallet:
                return "Wallet Core will discover the canonical SmartAccount before this device receives any local authorization capability."
            case .recovery:
                return "Recovery uses the canonical recovery policy and timelock. This app cannot bypass or replace that authority."
            }
        }()

        Text(description)
            .font(.body)
            .foregroundStyle(.secondary)
        infoCard(title: "Passkeys", body: "Passkeys authorize locally with platform security. Face ID or Touch ID prove local presence only; they do not become account authority.")
        infoCard(title: "Before you continue", body: "Review recovery, keep device security enabled, and remember that dApp permissions are scoped, revocable, and independently revalidated.")
        Button("Continue to wallet") {
            onboardingCompleted = true
            onboardingPath = nil
            transientStatus = "Onboarding complete. Account, passkey, recovery, and signing authority remain governed by Wallet Core and canonical SmartAccount policy."
        }
        .buttonStyle(Wallet420PrimaryButtonStyle())
        .accessibilityIdentifier("wallet420.onboarding.complete")
        Button("Back") { onboardingPath = nil }
            .buttonStyle(Wallet420SecondaryButtonStyle())
            .accessibilityIdentifier("wallet420.onboarding.back")
    }

    private var mainWalletRoot: some View {
        VStack(alignment: .leading, spacing: Wallet420DesignSystem.spacingMedium) {
            header

            if localLocked {
                lockedContent
            } else {
                ScrollView {
                    VStack(spacing: Wallet420DesignSystem.spacingMedium) {
                        surfaceContent(selectedSurface)
                        if let handoffStatus {
                            statusCard(title: "Approval request", body: handoffStatus)
                        } else if let transientStatus {
                            statusCard(title: "Ready for authorization", body: transientStatus)
                        }
                    }
                    .frame(maxWidth: .infinity)
                }
            }

            navigationBar
        }
        .padding(Wallet420DesignSystem.spacingMedium)
        .wallet420Surface()
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: Wallet420DesignSystem.spacingSmall) {
            Text(selectedSurface == .wallet ? "420 Wallet" : selectedSurface.rawValue)
                .font(.system(size: 26, weight: .bold, design: .rounded))
                .accessibilityIdentifier(selectedSurface.accessibilityID)
            Text(localLocked ? (unlockStatus ?? "unlock required after backgrounding") : subtitle(selectedSurface))
                .font(.body)
                .foregroundStyle(.secondary)
        }
    }

    private var lockedContent: some View {
        VStack(alignment: .leading, spacing: Wallet420DesignSystem.spacingMedium) {
            statusCard(
                title: "Wallet locked",
                body: unlockStatus ?? "Re-authenticate locally to restore presentation access. Canonical SmartAccount authority is unchanged."
            )
            Button("Unlock wallet") {
                Task { await authorizeLocalUnlock() }
            }
            .buttonStyle(Wallet420PrimaryButtonStyle())
        }
    }

    private var navigationBar: some View {
        HStack(spacing: Wallet420DesignSystem.spacingSmall) {
            ForEach(WalletSurface420.allCases) { surface in
                Button(surface.rawValue) {
                    guard !localLocked else { return }
                    selectedSurface = surface
                    handoffStatus = nil
                    transientStatus = nil
                }
                .font(.system(size: 13, weight: selectedSurface == surface ? .bold : .medium))
                .frame(maxWidth: .infinity, minHeight: Wallet420DesignSystem.minimumTouchTarget)
                .foregroundStyle(selectedSurface == surface ? Wallet420DesignSystem.brandPrimaryDark : Color.primary)
                .background(selectedSurface == surface ? Wallet420DesignSystem.surfaceDark.opacity(0.55) : Color.clear)
                .clipShape(RoundedRectangle(cornerRadius: Wallet420DesignSystem.cornerRadiusMedium, style: .continuous))
                .accessibilityIdentifier(surface.tabAccessibilityID)
                .disabled(localLocked)
            }
        }
    }

    @ViewBuilder
    private func surfaceContent(_ surface: WalletSurface420) -> some View {
        switch surface {
        case .wallet:
            infoCard(title: "Portfolio", body: "$420  —  balance from Wallet Core\nAssets and balances remain chain-derived and presentation-only here.")
            quickActions
            infoCard(title: "Recent activity", body: "Open Activity for UserOperation status, chain, hash, and timestamps.")
        case .apps:
            infoCard(title: "420 Integrated", body: "HTTPS destinations only. App navigation never becomes signing authority.")
            infoCard(title: "Discover", body: "Search · AppStore · AI")
            infoCard(title: "Finance & governance", body: "Swap · Bridge · Stake · Governance")
        case .activity:
            infoCard(title: "UserOperations", body: "Status · chain · hash · timestamps")
            infoCard(title: "Authority boundary", body: "Activity is presentation-only. Submission and signing remain governed by Wallet Core and canonical SmartAccount policy.")
        case .security:
            infoCard(title: "Authentication", body: "Passkeys · local biometric presence · session keys")
            infoCard(title: "Permissions", body: "dApp capabilities · session scope · expiry")
            infoCard(title: "Recovery & device", body: "Recovery policy · device state · lost-device controls")
        }
    }

    private var quickActions: some View {
        VStack(alignment: .leading, spacing: Wallet420DesignSystem.spacingSmall) {
            Text("Quick actions").font(.headline)
            HStack(spacing: Wallet420DesignSystem.spacingSmall) {
                Button("Send") { transientStatus = "Send request prepared for Wallet Core authorization" }
                    .buttonStyle(Wallet420PrimaryButtonStyle())
                Button("Receive") { transientStatus = "Receive presentation opened" }
                    .buttonStyle(Wallet420SecondaryButtonStyle())
                Button("Connect") { transientStatus = "Connect request prepared for Wallet Core authorization" }
                    .buttonStyle(Wallet420SecondaryButtonStyle())
            }
        }
        .wallet420Card()
    }

    private func infoCard(title: String, body: String) -> some View {
        VStack(alignment: .leading, spacing: Wallet420DesignSystem.spacingSmall) {
            Text(title).font(.headline)
            Text(body)
                .font(.body)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .wallet420Card()
    }

    private func statusCard(title: String, body: String) -> some View {
        VStack(alignment: .leading, spacing: Wallet420DesignSystem.spacingSmall) {
            Text(title).font(.headline)
            Text(body)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .wallet420Card()
    }

    private func subtitle(_ surface: WalletSurface420) -> String {
        switch surface {
        case .wallet: return "Your portfolio, actions, and recent wallet activity."
        case .apps: return "Trusted entry points into the 420 Integrated ecosystem."
        case .activity: return "Track submitted UserOperations and wallet events."
        case .security: return "Manage passkeys, sessions, permissions, recovery, and this device."
        }
    }

    private func inspectDeviceSecurity() {
        let signals = DeviceSecurity420.inspect()
        if signals.jailbroken || signals.debuggerAttached {
            localLocked = true
            privacyShield = true
            unlockStatus = "device security risk detected\nunlock blocked"
            handoffStatus = nil
            transientStatus = nil
        }
    }

    @MainActor
    private func authorizeLocalUnlock() async {
        let signals = DeviceSecurity420.inspect()
        guard !signals.jailbroken, !signals.debuggerAttached else {
            localLocked = true
            privacyShield = true
            unlockStatus = "device security risk detected\nunlock blocked"
            return
        }
        let gate = BiometricGate420()
        guard gate.isAvailable() else {
            unlockStatus = "device authentication unavailable"
            return
        }
        do {
            let authorized = try await gate.authorize(reason: "Unlock 420 Wallet after backgrounding")
            guard authorized else {
                unlockStatus = "unlock cancelled"
                return
            }
            localLocked = false
            unlockStatus = nil
            privacyShield = UIScreen.main.isCaptured
            selectedSurface = .wallet
            // Local presence only restores presentation access; canonical SmartAccount authority is unchanged.
            if !onboardingActive { consumePendingPush() }
        } catch {
            unlockStatus = "unlock failed"
        }
    }

    private func consumePendingPush() {
        guard !localLocked, !onboardingActive else { return }
        guard let reference = PushRegistration420.shared.consumePending() else { return }
        handoffStatus = "push (\(reference.state)) from \(reference.origin)\n\(reference.requestID)"
        transientStatus = nil
    }

    private func handle(_ url: URL) {
        guard !localLocked, !onboardingActive else { return }
        let productionHost = (Bundle.main.object(forInfoDictionaryKey: "WalletLinkHost") as? String) ?? ""
        do {
            let handoff = try DappHandoffParser420.parse(
                url.absoluteString,
                productionHost: productionHost,
                allowDevelopmentScheme: _isDebugAssertConfiguration()
            )
            handoffStatus = "request from \(handoff.origin)\n\(handoff.requestID)"
            transientStatus = nil
        } catch {
            handoffStatus = "rejected invalid handoff"
            transientStatus = nil
        }
    }
}

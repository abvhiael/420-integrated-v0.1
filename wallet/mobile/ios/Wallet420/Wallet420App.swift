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

@main
struct Wallet420App: App {
    @UIApplicationDelegateAdaptor(AppDelegate420.self) private var appDelegate
    @Environment(\.scenePhase) private var scenePhase
    @State private var selectedSurface: WalletSurface420 = .wallet
    @State private var handoffStatus: String?
    @State private var privacyShield = false
    @State private var localLocked = false
    @State private var unlockStatus: String?

    var body: some Scene {
        WindowGroup {
            ZStack {
                VStack(spacing: 16) {
                    Text(selectedSurface.rawValue == "Wallet" ? "420 Wallet" : selectedSurface.rawValue)
                        .font(.title)
                        .accessibilityIdentifier(selectedSurface.accessibilityID)
                    Text(localLocked ? (unlockStatus ?? "unlock required after backgrounding") : surfaceText(selectedSurface))
                        .font(.body)
                        .multilineTextAlignment(.center)
                    if localLocked {
                        Button("Unlock wallet") {
                            Task { await authorizeLocalUnlock() }
                        }
                    }
                    if let handoffStatus, !localLocked {
                        Divider()
                        Text(handoffStatus)
                            .font(.subheadline)
                            .multilineTextAlignment(.center)
                    }
                    Spacer()
                    HStack {
                        ForEach(WalletSurface420.allCases) { surface in
                            Button(surface.rawValue) {
                                guard !localLocked else { return }
                                selectedSurface = surface
                                handoffStatus = nil
                            }
                            .accessibilityIdentifier(surface.tabAccessibilityID)
                            .disabled(localLocked)
                        }
                    }
                }
                .padding()

                if privacyShield {
                    Rectangle()
                        .fill(.background)
                        .ignoresSafeArea()
                    Text("420 Wallet Locked")
                        .font(.title2)
                        .accessibilityIdentifier("wallet420.privacy-shield")
                }
            }
            .task {
                try? await PushRegistration420.shared.register()
                inspectDeviceSecurity()
                if !localLocked { consumePendingPush() }
            }
            .onChange(of: scenePhase) { phase in
                switch phase {
                case .active:
                    privacyShield = UIScreen.main.isCaptured
                    inspectDeviceSecurity()
                    if !localLocked { consumePendingPush() }
                case .inactive, .background:
                    privacyShield = true
                    localLocked = true
                    unlockStatus = "unlock required after backgrounding"
                    handoffStatus = nil
                @unknown default:
                    privacyShield = true
                    localLocked = true
                    unlockStatus = "unlock required"
                }
            }
            .onReceive(NotificationCenter.default.publisher(for: UIScreen.capturedDidChangeNotification)) { _ in
                privacyShield = UIScreen.main.isCaptured || scenePhase != .active
            }
            .onOpenURL { url in if !localLocked { handle(url) } }
            .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { activity in
                if !localLocked, let url = activity.webpageURL { handle(url) }
            }
        }
    }

    private func inspectDeviceSecurity() {
        let signals = DeviceSecurity420.inspect()
        if signals.jailbroken || signals.debuggerAttached {
            localLocked = true
            privacyShield = true
            unlockStatus = "device security risk detected\nunlock blocked"
            handoffStatus = nil
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
            // Local presence only restores presentation access; canonical SmartAccount authority is unchanged.
            consumePendingPush()
        } catch {
            unlockStatus = "unlock failed"
        }
    }

    private func surfaceText(_ surface: WalletSurface420) -> String {
        switch surface {
        case .wallet:
            return "Portfolio\nAssets and balances from qualified Wallet Core\n\nSend · Receive · Connect"
        case .apps:
            return "420 Integrated Apps\nHTTPS destinations only\n\nSearch · AppStore · AI · Swap · Bridge · Stake · Governance"
        case .activity:
            return "UserOperation status, chain, hash, and timestamps\n\nPresentation only — no signing authority"
        case .security:
            return "Passkeys · Sessions · dApp permissions · Recovery · Device"
        }
    }

    private func consumePendingPush() {
        guard !localLocked else { return }
        guard let reference = PushRegistration420.shared.consumePending() else { return }
        handoffStatus = "push (\(reference.state)) from \(reference.origin)\n\(reference.requestID)"
    }

    private func handle(_ url: URL) {
        guard !localLocked else { return }
        let productionHost = (Bundle.main.object(forInfoDictionaryKey: "WalletLinkHost") as? String) ?? ""
        do {
            let handoff = try DappHandoffParser420.parse(
                url.absoluteString,
                productionHost: productionHost,
                allowDevelopmentScheme: _isDebugAssertConfiguration()
            )
            handoffStatus = "request from \(handoff.origin)\n\(handoff.requestID)"
        } catch {
            handoffStatus = "rejected invalid handoff"
        }
    }
}

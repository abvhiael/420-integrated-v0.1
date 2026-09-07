import SwiftUI

private enum WalletSurface420: String, CaseIterable, Identifiable {
    case wallet = "Wallet"
    case apps = "Apps"
    case activity = "Activity"
    case security = "Security"
    var id: String { rawValue }
}

@main
struct Wallet420App: App {
    @UIApplicationDelegateAdaptor(AppDelegate420.self) private var appDelegate
    @Environment(\.scenePhase) private var scenePhase
    @State private var selectedSurface: WalletSurface420 = .wallet
    @State private var handoffStatus: String?
    @State private var privacyShield = false
    @State private var localLocked = false

    var body: some Scene {
        WindowGroup {
            ZStack {
                VStack(spacing: 16) {
                    Text(selectedSurface.rawValue == "Wallet" ? "420 Wallet" : selectedSurface.rawValue)
                        .font(.title)
                    Text(localLocked ? "unlock required after backgrounding" : surfaceText(selectedSurface))
                        .font(.body)
                        .multilineTextAlignment(.center)
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
                                selectedSurface = surface
                                handoffStatus = nil
                            }
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
                }
            }
            .task {
                try? await PushRegistration420.shared.register()
                inspectDeviceSecurity()
                consumePendingPush()
            }
            .onChange(of: scenePhase) { phase in
                switch phase {
                case .active:
                    privacyShield = UIScreen.main.isCaptured
                    inspectDeviceSecurity()
                    consumePendingPush()
                case .inactive, .background:
                    privacyShield = true
                    localLocked = true
                    handoffStatus = nil
                @unknown default:
                    privacyShield = true
                    localLocked = true
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
            handoffStatus = nil
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

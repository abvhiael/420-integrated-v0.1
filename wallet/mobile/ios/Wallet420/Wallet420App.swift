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

    var body: some Scene {
        WindowGroup {
            VStack(spacing: 16) {
                Text(selectedSurface.rawValue == "Wallet" ? "420 Wallet" : selectedSurface.rawValue)
                    .font(.title)
                Text(surfaceText(selectedSurface))
                    .font(.body)
                    .multilineTextAlignment(.center)
                if let handoffStatus {
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
                    }
                }
            }
            .padding()
            .task {
                try? await PushRegistration420.shared.register()
                consumePendingPush()
            }
            .onChange(of: scenePhase) { phase in
                if phase == .active { consumePendingPush() }
            }
            .onOpenURL { url in handle(url) }
            .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { activity in
                if let url = activity.webpageURL { handle(url) }
            }
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

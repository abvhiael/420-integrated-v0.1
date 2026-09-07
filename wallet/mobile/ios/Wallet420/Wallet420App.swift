import SwiftUI

@main
struct Wallet420App: App {
    @UIApplicationDelegateAdaptor(AppDelegate420.self) private var appDelegate
    @State private var handoffStatus = "W11 native bootstrap"

    var body: some Scene {
        WindowGroup {
            VStack(spacing: 12) {
                Text("420 Wallet")
                    .font(.title)
                Text(handoffStatus)
                    .font(.subheadline)
            }
            .padding()
            .task {
                try? await PushRegistration420.shared.register()
            }
            .onOpenURL { url in handle(url) }
            .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { activity in
                if let url = activity.webpageURL { handle(url) }
            }
        }
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

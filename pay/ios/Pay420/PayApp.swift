import SwiftUI

@main
@MainActor
struct PayApp: App {
    var body: some Scene {
        WindowGroup { PayHome() }
    }
}

@MainActor
struct PayHome: View {
    @Environment(\.scenePhase) private var phase
    @StateObject private var sdk = PaySDK()
    @State private var input = ""
    @State private var status = "Scan or enter a Pay link."
    @State private var reviewed: URL?
    @State private var pending: PayLinks.WalletHandoff?
    @State private var revision = UUID()
    @State private var scannerOpen = false
    private let deployment = PayDeployment()

    var body: some View {
        NavigationStack {
            Form {
                Section("Review") {
                    TextField("Pay link or address", text: $input)
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .accessibilityIdentifier("pay.input")
                    Button("Check link") { review(input) }
                        .disabled(!sdk.ready || !deployment.configured)
                    Button("Scan payment QR") { scannerOpen = true }
                        .disabled(!sdk.ready || !deployment.configured)
                    Button("Open hosted review") {
                        guard let reviewed else { return }
                        clear()
                        UIApplication.shared.open(reviewed, options: [:])
                    }.disabled(reviewed == nil)
                    if let reviewed { ShareLink(item: reviewed) { Text("Share reviewed link") } }
                }
                Section("Wallet") {
                    Button("Open verified 420 Wallet", action: openWallet)
                    Button("Clear review", action: clear)
                }
                Text(status).accessibilityIdentifier("pay.status")
            }
            .navigationTitle("420 Pay")
        }
        .onAppear {
            sdk.load()
            if !deployment.configured { status = "Approved Pay deployment is unavailable." }
        }
        .onChange(of: input) { _ in invalidateReview() }
        .onChange(of: phase) { next in
            if next == .background {
                scannerOpen = false
                invalidateReview()
                input = ""
            }
            if next == .active, let request = pending, request.expires <= Date() { pending = nil }
        }
        .overlay {
            if phase != .active {
                Color(UIColor.systemBackground).ignoresSafeArea().accessibilityHidden(true)
            }
        }
        .onOpenURL(perform: walletReturn)
        .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { activity in
            if let url = activity.webpageURL { walletReturn(url) }
        }
        .sheet(isPresented: $scannerOpen) {
            NavigationStack {
                QRScanner { result in
                    scannerOpen = false
                    switch result {
                    case .success(let value):
                        review(value)
                    case .failure:
                        status = "Camera unavailable. Enter the link to continue."
                    }
                }
                .navigationTitle("Scan payment QR")
                .toolbar { ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { scannerOpen = false }
                } }
            }
        }
    }

    private func invalidateReview() {
        revision = UUID()
        reviewed = nil
    }

    private func review(_ value: String) {
        invalidateReview()
        let ticket = revision
        status = "Checking Pay link…"
        Task {
            let link = await sdk.review(value, deployment: deployment)
            guard ticket == revision else { return }
            reviewed = link
            status = link == nil ? "Invalid payment link for this Pay deployment." :
                "Link checked. Open 420 Pay for current terms and Wallet approval."
        }
    }

    private func openWallet() {
        pending = nil
        guard deployment.configured,
              let request = PayLinks.handoff(payHost: deployment.payHost, walletHost: deployment.walletHost, now: Date())
        else {
            status = "Verified 420 Wallet Universal Link is unavailable."
            return
        }
        pending = request
        UIApplication.shared.open(request.url, options: [.universalLinksOnly: true]) { opened in
            guard pending?.id == request.id else { return }
            if !opened { pending = nil }
            status = opened ? "Wallet review opened." : "Verified 420 Wallet Universal Link is unavailable."
        }
    }

    private func walletReturn(_ url: URL) {
        guard let request = pending, request.matches(url, on: deployment.payHost, now: Date()) else {
            status = "Wallet return could not be matched to an active review."
            return
        }
        clear()
        status = "Returned from Wallet. Open hosted checkout to verify current payment state."
    }

    private func clear() {
        invalidateReview()
        input = ""
        pending = nil
        status = "Review cleared."
    }
}

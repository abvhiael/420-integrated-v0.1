import SwiftUI

@main
struct PuffBuddiesApp: App {
    @StateObject private var bridge = PuffBuddiesNativeBridge()
    var body: some Scene {
        WindowGroup {
            NavigationStack {
                List {
                    Section("PuffBuddies") {
                        NavigationLink("Eligibility", destination: Text("Server-revalidated eligibility"))
                        NavigationLink("Profile & photos", destination: Text("Profile editor and authorized media handoff"))
                        NavigationLink("Discovery", destination: Text("Authorized discovery results"))
                        NavigationLink("Matches & messaging", destination: Text("Current matches and Messenger entry"))
                        NavigationLink("Notifications", destination: Text("Non-authoritative notifications"))
                        NavigationLink("Safety", destination: Text("Block • Report • Unmatch"))
                        NavigationLink("Settings", destination: Text("Visibility • Deactivate • Delete"))
                        NavigationLink("Premium", destination: Text("Feature availability only"))
                    }
                }
                .navigationTitle("PuffBuddies")
                .onAppear { bridge.restoreSession() }
            }
        }
    }
}

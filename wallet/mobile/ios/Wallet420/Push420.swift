import Foundation
import UIKit
import UserNotifications

/// W11.6 APNs registration. Push carries request references only and never signing authority.
struct PushReference420: Equatable {
    let origin: String
    let requestID: String
    let expiresAt: Int64
    let state: String
}

final class PushRegistration420: NSObject {
    static let shared = PushRegistration420()
    private let defaults = UserDefaults.standard

    func register() async throws {
        let center = UNUserNotificationCenter.current()
        center.delegate = AppDelegate420.sharedDelegate
        _ = try await center.requestAuthorization(options: [.alert, .badge, .sound])
        await MainActor.run { UIApplication.shared.registerForRemoteNotifications() }
    }

    func storeDeviceToken(_ deviceToken: Data) {
        let token = deviceToken.map { String(format: "%02x", $0) }.joined()
        defaults.set(token, forKey: "wallet420.apns.token.v1")
    }

    @discardableResult
    func storeReference(userInfo: [AnyHashable: Any], state: String, nowMs: Int64 = Int64(Date().timeIntervalSince1970 * 1000)) -> Bool {
        guard ["foreground", "background", "terminated"].contains(state) else { return false }
        let allowed = Set(["origin", "requestId", "expiresAt", "aps"])
        let keys = Set(userInfo.keys.compactMap { $0 as? String })
        guard keys.isSubset(of: allowed),
              let origin = userInfo["origin"] as? String,
              origin.lowercased().hasPrefix("https://"),
              let requestID = userInfo["requestId"] as? String,
              (8...128).contains(requestID.count)
        else { return false }
        let expiryString = userInfo["expiresAt"] as? String ?? String(describing: userInfo["expiresAt"] ?? "")
        guard let expiresAt = Int64(expiryString), expiresAt > nowMs, expiresAt - nowMs <= 10 * 60 * 1000 else { return false }
        defaults.set(origin, forKey: "wallet420.push.origin.v1")
        defaults.set(requestID, forKey: "wallet420.push.request.v1")
        defaults.set(expiresAt, forKey: "wallet420.push.expiry.v1")
        defaults.set(state, forKey: "wallet420.push.state.v1")
        return true
    }

    /// One-shot consumption before canonical request rehydration. Duplicate/stale references fail closed.
    func consumePending(nowMs: Int64 = Int64(Date().timeIntervalSince1970 * 1000)) -> PushReference420? {
        guard let origin = defaults.string(forKey: "wallet420.push.origin.v1"),
              let requestID = defaults.string(forKey: "wallet420.push.request.v1"),
              let state = defaults.string(forKey: "wallet420.push.state.v1")
        else { return nil }
        let expiresAt = defaults.object(forKey: "wallet420.push.expiry.v1") as? Int64 ?? Int64(defaults.integer(forKey: "wallet420.push.expiry.v1"))
        let key = "\(origin)\n\(requestID)"
        let consumed = defaults.string(forKey: "wallet420.push.consumed.v1") == key
        for field in ["origin", "request", "expiry", "state"] { defaults.removeObject(forKey: "wallet420.push.\(field).v1") }
        guard !consumed, expiresAt > nowMs else { return nil }
        defaults.set(key, forKey: "wallet420.push.consumed.v1")
        return PushReference420(origin: origin, requestID: requestID, expiresAt: expiresAt, state: state)
    }
}

final class AppDelegate420: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    static weak var sharedDelegate: AppDelegate420?

    override init() {
        super.init()
        AppDelegate420.sharedDelegate = self
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        PushRegistration420.shared.storeDeviceToken(deviceToken)
    }

    func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable: Any], fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
        let accepted = PushRegistration420.shared.storeReference(userInfo: userInfo, state: application.applicationState == .active ? "foreground" : "background")
        completionHandler(accepted ? .newData : .noData)
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) {
        _ = PushRegistration420.shared.storeReference(userInfo: response.notification.request.content.userInfo, state: "terminated")
        completionHandler()
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        UserDefaults.standard.removeObject(forKey: "wallet420.apns.token.v1")
    }
}

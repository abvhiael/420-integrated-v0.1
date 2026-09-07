import Foundation
import UIKit
import UserNotifications

/// W11.6 APNs registration. Push carries request references only and never signing authority.
final class PushRegistration420: NSObject {
    static let shared = PushRegistration420()

    func register() async throws {
        let center = UNUserNotificationCenter.current()
        _ = try await center.requestAuthorization(options: [.alert, .badge, .sound])
        await MainActor.run { UIApplication.shared.registerForRemoteNotifications() }
    }

    func storeDeviceToken(_ deviceToken: Data) {
        let token = deviceToken.map { String(format: "%02x", $0) }.joined()
        UserDefaults.standard.set(token, forKey: "wallet420.apns.token.v1")
    }

    func storeReference(userInfo: [AnyHashable: Any]) {
        let allowed = Set(["origin", "requestId", "expiresAt"])
        let keys = Set(userInfo.keys.compactMap { $0 as? String })
        guard keys.isSubset(of: allowed),
              let origin = userInfo["origin"] as? String,
              let requestID = userInfo["requestId"] as? String,
              let expiresAt = userInfo["expiresAt"] as? String
        else { return }
        UserDefaults.standard.set(origin, forKey: "wallet420.push.origin.v1")
        UserDefaults.standard.set(requestID, forKey: "wallet420.push.request.v1")
        UserDefaults.standard.set(expiresAt, forKey: "wallet420.push.expiry.v1")
    }
}

final class AppDelegate420: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        PushRegistration420.shared.storeDeviceToken(deviceToken)
    }

    func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable: Any], fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
        PushRegistration420.shared.storeReference(userInfo: userInfo)
        completionHandler(.newData)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        UserDefaults.standard.removeObject(forKey: "wallet420.apns.token.v1")
    }
}

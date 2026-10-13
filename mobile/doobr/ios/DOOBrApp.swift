import SwiftUI
import Security
import CoreLocation
import UserNotifications

@MainActor final class MobilePermissions: NSObject, ObservableObject, CLLocationManagerDelegate, UNUserNotificationCenterDelegate {
 @Published private(set) var locationAllowed = false
 @Published private(set) var notificationsAllowed = false
 @Published private(set) var status = "Non-operational: no delivery, tracking or push registration."
 private let location = CLLocationManager()
 private var assignmentAuthorized = false
 private var routeDeadline: Date? = nil
 private var userConsent = false
 override init() {
  super.init()
  location.delegate = self
  location.desiredAccuracy = kCLLocationAccuracyHundredMeters
  UNUserNotificationCenter.current().delegate = self
 }
 func requestForegroundLocation() {
  // Only OS permission request, never automatically begin tracking.
  location.requestWhenInUseAuthorization()
 }
 func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
  locationAllowed = manager.authorizationStatus == .authorizedWhenInUse || manager.authorizationStatus == .authorizedAlways
  if !locationAllowed { stopTracking() }
 }
 func requestNotifications() {
  UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { [weak self] granted, _ in
   Task { @MainActor in self?.notificationsAllowed = granted }
  }
 }
 func stopTracking() {
  userConsent = false
  location.stopUpdatingLocation()
  assignmentAuthorized = false
  routeDeadline = nil
 }
 func startTrackingIfAuthorized() {
  // Fail closed: assignment proof must be independently verified by a trusted
  // backend; native UI cannot set assignmentAuthorized or consent itself.
  guard assignmentAuthorized && userConsent && locationAllowed && routeDeadline.map({ $0 > Date() }) == true else {
   location.stopUpdatingLocation()
   status = "Location unavailable without a verified assignment and permission."
   return
  }
  location.startUpdatingLocation()
 }
 func applicationDidBecomeInactive() { stopTracking() }
 func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
  // No coordinates sent or persisted until encrypted transport and external
  // authorization are implemented. Stop immediately.
  guard assignmentAuthorized && userConsent && locationAllowed && routeDeadline.map({ $0 > Date() }) == true else { stopTracking(); return }
  // No approved encrypted tracking transport: hard stop rather than store coordinates.
  stopTracking()
 }
}

enum DeviceKey {
 static func createSecureEnclaveKey() -> Bool {
  let access = SecAccessControlCreateWithFlags(nil,
   kSecAttrAccessibleWhenUnlockedThisDeviceOnly, [.privateKeyUsage, .userPresence], nil)
  guard let access else { return false }
  let attrs: [String: Any] = [
   kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
   kSecAttrKeySizeInBits as String: 256,
   kSecAttrTokenID as String: kSecAttrTokenIDSecureEnclave,
   kSecPrivateKeyAttrs as String: [
    kSecAttrIsPermanent as String: true,
    kSecAttrAccessControl as String: access,
    kSecAttrApplicationTag as String: Data("org.integrated420.doobr.device.v1".utf8)
   ]
  ]
  var error: Unmanaged<CFError>?
  return SecKeyCreateRandomKey(attrs as CFDictionary, &error) != nil
 }
}

@main struct DOOBrApp: App {
 @StateObject private var permissions = MobilePermissions()
 var body: some Scene {
  WindowGroup {
   VStack(spacing: 18) {
    Text("DOOBr mobile — development only")
    Text(permissions.status)
    Button("Request foreground location") { permissions.requestForegroundLocation() }
    Button("Request notifications") { permissions.requestNotifications() }
    Button("Stop location") { permissions.stopTracking() }
   }.padding().accessibilityElement(children: .contain)
  }
 }
}

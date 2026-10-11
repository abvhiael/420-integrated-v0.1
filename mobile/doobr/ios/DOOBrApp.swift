import SwiftUI
import Security
import CoreLocation
import UserNotifications

@main struct DOOBrApp: App {
 var body: some Scene {
  WindowGroup { Text("DOOBr mobile — development only. Delivery and location tracking are disabled.")
   .padding().accessibilityLabel("DOOBr development; service unavailable") }
 }
}
enum DeviceKey {
 static func createSecureEnclaveKey() -> Bool {
  let attrs: [String:Any] = [
   kSecAttrKeyType as String:kSecAttrKeyTypeECSECPrimeRandom,
   kSecAttrKeySizeInBits as String:256,
   kSecAttrTokenID as String:kSecAttrTokenIDSecureEnclave,
   kSecPrivateKeyAttrs as String:[
    kSecAttrIsPermanent as String:true,
    kSecAttrApplicationTag as String:Data("org.integrated420.doobr.device.v1".utf8)
   ]]
  var error:Unmanaged<CFError>?
  guard SecKeyCreateRandomKey(attrs as CFDictionary,&error) != nil else { return false }
  return true
 }
}

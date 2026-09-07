import Foundation
import UIKit

struct DeviceSecuritySignals420 {
    let jailbroken: Bool
    let debuggerAttached: Bool
    let screenCaptureActive: Bool
}

enum DeviceSecurity420 {
    private static let jailbreakIndicators = [
        "/Applications/Cydia.app",
        "/Library/MobileSubstrate/MobileSubstrate.dylib",
        "/bin/bash",
        "/usr/sbin/sshd",
    ]

    static func inspect() -> DeviceSecuritySignals420 {
        let jailbroken = jailbreakIndicators.contains { FileManager.default.fileExists(atPath: $0) }
        return DeviceSecuritySignals420(
            jailbroken: jailbroken,
            debuggerAttached: _isDebugAssertConfiguration(),
            screenCaptureActive: UIScreen.main.isCaptured
        )
    }

    @MainActor
    static func applyPrivacyShield(to window: UIWindow?, enabled: Bool) {
        guard let window else { return }
        window.isHidden = enabled
    }

    // Device signals are local risk inputs only. They never grant or revoke SmartAccount420 authority.
}

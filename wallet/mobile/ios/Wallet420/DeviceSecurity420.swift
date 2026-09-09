import Foundation
import UIKit
import Darwin

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
            debuggerAttached: isDebuggerAttached(),
            screenCaptureActive: UIScreen.main.isCaptured
        )
    }

    private static func isDebuggerAttached() -> Bool {
        var info = kinfo_proc()
        var size = MemoryLayout<kinfo_proc>.stride
        var mib: [Int32] = [CTL_KERN, KERN_PROC, KERN_PROC_PID, getpid()]
        let result = mib.withUnsafeMutableBufferPointer { pointer in
            sysctl(pointer.baseAddress, u_int(pointer.count), &info, &size, nil, 0)
        }
        guard result == 0 else { return false }
        return (info.kp_proc.p_flag & P_TRACED) != 0
    }

    @MainActor
    static func applyPrivacyShield(to window: UIWindow?, enabled: Bool) {
        guard let window else { return }
        window.isHidden = enabled
    }

    // Device signals are local risk inputs only. They never grant or revoke SmartAccount420 authority.
}

import Foundation
import LocalAuthentication

/// W11.3 local user-presence gate. It never signs and never grants canonical wallet authority.
final class BiometricGate420 {
    func isAvailable() -> Bool {
        let context = LAContext()
        var error: NSError?
        return context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error)
    }

    func authorize(reason: String) async throws -> Bool {
        guard !reason.isEmpty else { throw BiometricGate420Error.invalidReason }
        let context = LAContext()
        context.localizedCancelTitle = "Cancel"

        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) else {
            throw error ?? BiometricGate420Error.unavailable
        }

        return try await withCheckedThrowingContinuation { continuation in
            context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason) { success, error in
                if let error {
                    let nsError = error as NSError
                    if nsError.domain == LAError.errorDomain,
                       let code = LAError.Code(rawValue: nsError.code),
                       code == .userCancel || code == .appCancel || code == .systemCancel {
                        continuation.resume(returning: false)
                        return
                    }
                    continuation.resume(throwing: error)
                    return
                }
                continuation.resume(returning: success)
            }
        }
    }
}

enum BiometricGate420Error: Error {
    case invalidReason
    case unavailable
}

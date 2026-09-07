import Foundation

/// W11.8 lost-device coordinator. Local session material is destroyed before canonical recovery is requested.
/// This coordinator cannot itself grant, revoke, or replace SmartAccount420 authority.
final class LostDevice420 {
    private let sessionKeys: SessionKey420

    init(sessionKeys: SessionKey420 = SessionKey420()) {
        self.sessionKeys = sessionKeys
    }

    func handle(sessionAlias: String, beginCanonicalRecovery: () throws -> Void) throws {
        guard !sessionAlias.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw LostDevice420Error.invalidSessionAlias
        }
        try sessionKeys.invalidate(alias: sessionAlias)
        UserDefaults.standard.removeObject(forKey: "wallet420.push.v1")
        UserDefaults.standard.removeObject(forKey: "wallet420.permissions.v1")
        Privacy420.clear()
        try beginCanonicalRecovery()
    }
}

enum LostDevice420Error: Error {
    case invalidSessionAlias
}

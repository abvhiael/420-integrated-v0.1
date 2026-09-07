import Foundation

/// W11 native implementation boundary consumed by the shared mobile Wallet Core.
/// RPC remains read/transport only. Signing authority remains local to the device.
protocol NativeWalletBridge420 {
    func rpc(method: String, paramsJSON: String) async throws -> String
    func secureGet(key: String) async throws -> Data?
    func secureSet(key: String, value: Data) async throws
    func secureDelete(key: String) async throws
    func createPasskey(requestJSON: String) async throws -> String
    func getPasskey(requestJSON: String) async throws -> String
    func authorizeBiometric(reason: String) async throws -> Bool
    func ensureSessionKey(alias: String) async throws -> Data
    func sessionPublicKey(alias: String) async throws -> Data
    func rotateSessionKey(alias: String) async throws -> Data
    func invalidateSessionKey(alias: String) async throws
    func signSessionHash(alias: String, hash: Data) async throws -> Data
    func submitTransaction(requestJSON: String) async throws -> String
    func openExternalURL(_ url: URL) throws
    func onResume(_ listener: @escaping () -> Void) -> AnyObject
    func onPause(_ listener: @escaping () -> Void) -> AnyObject
}

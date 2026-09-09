import Foundation

/// W11.9 native qualification fixture. This mirrors the canonical mobile
/// authority boundary; it does not grant authority itself.
enum AuthorityPolicy420 {
    static let canonicalAccountAuthority = "SmartAccount420"
    static let canonicalCapabilityAuthority = "CapabilityRegistry420"
    static let rpcRole = "read_transport_only"
    static let nativeClientIsCanonicalAuthority = false
    static let remoteSignerAllowed = false
    static let exportablePrivateKeyAllowed = false

    private static let allowedRpcMethods: Set<String> = [
        "eth_chainId",
        "eth_call",
        "eth_estimateGas",
        "eth_getBalance",
        "eth_getCode",
        "eth_getTransactionCount",
        "eth_getBlockByNumber",
        "eth_getLogs",
        "eth_sendUserOperation",
        "eth_getUserOperationReceipt",
        "eth_estimateUserOperationGas",
    ]

    static func rpcMethodAllowed(_ method: String) -> Bool {
        allowedRpcMethods.contains(method)
    }

    static func endpointAllowed(_ value: String) -> Bool {
        guard let components = URLComponents(string: value),
              components.scheme == "https",
              let host = components.host,
              !host.isEmpty,
              components.user == nil,
              components.password == nil else {
            return false
        }
        return true
    }
}

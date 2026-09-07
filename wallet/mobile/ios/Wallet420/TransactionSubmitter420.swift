import Foundation

/// W11.4 guarded UserOperation submission boundary for owner/recovery/session flows.
final class TransactionSubmitter420 {
    private let transport: RpcTransport420
    private let securityContext: () -> NativeSecurityContext420

    init(transport: RpcTransport420, securityContext: @escaping () -> NativeSecurityContext420) {
        self.transport = transport
        self.securityContext = securityContext
    }

    func submit(requestJSON: String) async throws -> String {
        guard let data = requestJSON.data(using: .utf8),
              let request = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let kind = request["kind"] as? String,
              ["owner", "recovery", "session"].contains(kind),
              let chainID = request["chainId"] as? String,
              let account = request["account"] as? String,
              let epoch = request["authorizationEpoch"] as? NSNumber,
              let userOperation = request["userOperation"] as? [String: Any],
              let entryPoint = request["entryPoint"] as? String,
              entryPoint.hasPrefix("0x"), entryPoint.count == 42
        else { throw TransactionSubmitter420Error.invalidRequest }

        let current = securityContext()
        guard chainID == current.chainID else { throw TransactionSubmitter420Error.chainDrift }
        guard account.caseInsensitiveCompare(current.account) == .orderedSame else { throw TransactionSubmitter420Error.accountDrift }
        guard epoch.int64Value == current.authorizationEpoch else { throw TransactionSubmitter420Error.authorizationEpochDrift }

        let params = try Self.jsonString([userOperation, entryPoint])
        let raw = try await transport.rpc(method: "eth_sendUserOperation", paramsJSON: params)
        guard let response = try JSONSerialization.jsonObject(with: Data(raw.utf8)) as? [String: Any],
              let hash = response["result"] as? String,
              hash.hasPrefix("0x"), hash.count == 66
        else { throw TransactionSubmitter420Error.invalidUserOperationHash }

        let receipt = try await pollReceipt(hash)
        return try Self.jsonString(["userOpHash": hash, "receipt": receipt])
    }

    private func pollReceipt(_ hash: String) async throws -> Any {
        for _ in 0..<30 {
            let params = try Self.jsonString([hash])
            let raw = try await transport.rpc(method: "eth_getUserOperationReceipt", paramsJSON: params)
            if let response = try JSONSerialization.jsonObject(with: Data(raw.utf8)) as? [String: Any],
               let result = response["result"], !(result is NSNull) {
                return result
            }
            try await Task.sleep(nanoseconds: 1_000_000_000)
        }
        return NSNull()
    }

    private static func jsonString(_ object: Any) throws -> String {
        let data = try JSONSerialization.data(withJSONObject: object)
        return String(decoding: data, as: UTF8.self)
    }
}

struct NativeSecurityContext420 {
    let chainID: String
    let account: String
    let authorizationEpoch: Int64
}

enum TransactionSubmitter420Error: Error {
    case invalidRequest
    case chainDrift
    case accountDrift
    case authorizationEpochDrift
    case invalidUserOperationHash
}

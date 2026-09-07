import Foundation

/// W11.4 HTTPS-only JSON-RPC transport. Never provides signing authority.
final class RpcTransport420 {
    private let endpointsByChain: [String: URL]
    private let activeChainID: () -> String
    private var requestID: UInt64 = 1

    init(endpoints: [String: String], activeChainID: @escaping () -> String) throws {
        var resolved: [String: URL] = [:]
        for (chainID, value) in endpoints {
            guard let url = URL(string: value), url.scheme?.lowercased() == "https" else {
                throw RpcTransport420Error.insecureEndpoint
            }
            resolved[chainID] = url
        }
        self.endpointsByChain = resolved
        self.activeChainID = activeChainID
    }

    func rpc(method: String, paramsJSON: String = "[]") async throws -> String {
        guard Self.allowedMethods.contains(method) else { throw RpcTransport420Error.methodNotAllowed }
        guard let endpoint = endpointsByChain[activeChainID()] else { throw RpcTransport420Error.chainNotAllowlisted }
        let params = try Self.parseParams(paramsJSON)
        requestID &+= 1
        let body: [String: Any] = [
            "jsonrpc": "2.0",
            "id": requestID,
            "method": method,
            "params": params,
        ]
        let data = try JSONSerialization.data(withJSONObject: body)
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.timeoutInterval = 30
        request.httpBody = data
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        let (responseData, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw RpcTransport420Error.httpFailure
        }
        let object = try JSONSerialization.jsonObject(with: responseData) as? [String: Any]
        guard object?["error"] == nil else { throw RpcTransport420Error.rpcFailure }
        return String(decoding: responseData, as: UTF8.self)
    }

    private static func parseParams(_ value: String) throws -> Any {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return [] }
        guard let data = trimmed.data(using: .utf8),
              let object = try? JSONSerialization.jsonObject(with: data),
              object is [Any] || object is [String: Any]
        else { throw RpcTransport420Error.invalidParams }
        return object
    }

    static let allowedMethods: Set<String> = [
        "eth_chainId", "eth_call", "eth_estimateGas", "eth_getBalance", "eth_getCode",
        "eth_getTransactionCount", "eth_getBlockByNumber", "eth_getLogs",
        "eth_sendUserOperation", "eth_getUserOperationReceipt", "eth_estimateUserOperationGas",
    ]
}

enum RpcTransport420Error: Error {
    case insecureEndpoint
    case methodNotAllowed
    case chainNotAllowlisted
    case invalidParams
    case httpFailure
    case rpcFailure
}

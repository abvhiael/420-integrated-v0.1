import Foundation

/// W11.4 HTTPS-only JSON-RPC transport. Never provides signing authority.
final class RpcTransport420 {
    private let endpointsByChain: [String: URL]
    private let activeChainID: () -> String
    private var requestID: UInt64 = 1

    init(endpoints: [String: String], activeChainID: @escaping () -> String) throws {
        var resolved: [String: URL] = [:]
        for (rawChainID, value) in endpoints {
            let chainID = try NativeNetworkConfig420.normalizeChainID(rawChainID)
            guard let url = URL(string: value),
                  url.scheme?.lowercased() == "https",
                  url.host?.isEmpty == false,
                  url.user == nil,
                  url.password == nil
            else { throw RpcTransport420Error.insecureEndpoint }
            guard resolved[chainID] == nil else { throw RpcTransport420Error.duplicateChain }
            resolved[chainID] = url
        }
        guard !resolved.isEmpty else { throw RpcTransport420Error.invalidConfiguration }
        self.endpointsByChain = resolved
        self.activeChainID = activeChainID
    }

    func rpc(method: String, paramsJSON: String = "[]") async throws -> String {
        guard Self.allowedMethods.contains(method) else { throw RpcTransport420Error.methodNotAllowed }
        let chainID = try NativeNetworkConfig420.normalizeChainID(activeChainID())
        guard let endpoint = endpointsByChain[chainID] else { throw RpcTransport420Error.chainNotAllowlisted(chainID) }
        let params = try Self.parseParams(paramsJSON)
        let id = requestID
        requestID &+= 1
        let body: [String: Any] = ["jsonrpc": "2.0", "id": id, "method": method, "params": params]
        let data = try JSONSerialization.data(withJSONObject: body)
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.timeoutInterval = 30
        request.httpBody = data
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let responseData: Data
        let response: URLResponse
        do {
            (responseData, response) = try await URLSession.shared.data(for: request)
        } catch let error as URLError {
            if error.code == .timedOut { throw RpcTransport420Error.timeout }
            throw RpcTransport420Error.networkFailure(error.code)
        } catch {
            throw RpcTransport420Error.networkFailure(nil)
        }

        guard let http = response as? HTTPURLResponse else { throw RpcTransport420Error.malformedResponse("non-http response") }
        guard (200...299).contains(http.statusCode) else { throw RpcTransport420Error.httpFailure(http.statusCode) }
        guard let object = try? JSONSerialization.jsonObject(with: responseData) as? [String: Any] else {
            throw RpcTransport420Error.malformedResponse("invalid JSON")
        }
        guard object["jsonrpc"] as? String == "2.0" else { throw RpcTransport420Error.malformedResponse("invalid jsonrpc version") }
        guard let responseID = object["id"] as? NSNumber, responseID.uint64Value == id else {
            throw RpcTransport420Error.malformedResponse("response id mismatch")
        }
        if let error = object["error"] as? [String: Any] {
            let code = (error["code"] as? NSNumber)?.intValue ?? 0
            let message = (error["message"] as? String)?.isEmpty == false ? error["message"] as! String : "unknown RPC error"
            throw RpcTransport420Error.rpcFailure(code, message)
        }
        guard object.keys.contains("result") else { throw RpcTransport420Error.malformedResponse("missing result") }
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
    case duplicateChain
    case invalidConfiguration
    case methodNotAllowed
    case chainNotAllowlisted(String)
    case invalidParams
    case timeout
    case networkFailure(URLError.Code?)
    case httpFailure(Int)
    case malformedResponse(String)
    case rpcFailure(Int, String)
}

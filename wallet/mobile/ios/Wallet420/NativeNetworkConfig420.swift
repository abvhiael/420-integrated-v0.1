import Foundation

struct NativeNetwork420: Equatable {
    let chainID: String
    let rpcURL: URL
}

/// Configuration-only native network registry for W11.4.
/// Network endpoints are supplied by app/runtime configuration and never carry signing authority.
struct NativeNetworkConfig420 {
    let networks: [String: NativeNetwork420]

    init(jsonData: Data) throws {
        let object = try JSONSerialization.jsonObject(with: jsonData)
        guard let root = object as? [String: Any], let entries = root["networks"] as? [[String: Any]] else {
            throw NativeNetworkConfig420Error.invalidConfig
        }
        var resolved: [String: NativeNetwork420] = [:]
        for entry in entries {
            guard let rawChainID = entry["chainId"] as? String,
                  let rawURL = entry["rpcUrl"] as? String
            else { throw NativeNetworkConfig420Error.invalidConfig }
            let chainID = try Self.normalizeChainID(rawChainID)
            guard let url = URL(string: rawURL),
                  url.scheme?.lowercased() == "https",
                  url.host?.isEmpty == false,
                  url.user == nil,
                  url.password == nil
            else { throw NativeNetworkConfig420Error.insecureEndpoint }
            guard resolved[chainID] == nil else { throw NativeNetworkConfig420Error.duplicateChain }
            resolved[chainID] = NativeNetwork420(chainID: chainID, rpcURL: url)
        }
        guard !resolved.isEmpty else { throw NativeNetworkConfig420Error.invalidConfig }
        self.networks = resolved
    }

    init(bundle: Bundle = .main, resource: String = "wallet-networks", extension ext: String = "json") throws {
        guard let url = bundle.url(forResource: resource, withExtension: ext) else {
            throw NativeNetworkConfig420Error.missingConfig
        }
        try self.init(jsonData: Data(contentsOf: url))
    }

    var endpoints: [String: String] {
        networks.mapValues { $0.rpcURL.absoluteString }
    }

    static func normalizeChainID(_ value: String) throws -> String {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard trimmed.range(of: "^0x[0-9a-f]+$", options: .regularExpression) != nil else {
            throw NativeNetworkConfig420Error.invalidChainID
        }
        let hex = String(trimmed.dropFirst(2)).drop(while: { $0 == "0" })
        return "0x" + (hex.isEmpty ? "0" : String(hex))
    }
}

enum NativeNetworkConfig420Error: Error {
    case missingConfig
    case invalidConfig
    case invalidChainID
    case insecureEndpoint
    case duplicateChain
}

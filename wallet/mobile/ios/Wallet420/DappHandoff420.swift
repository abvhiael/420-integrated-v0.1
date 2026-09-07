import Foundation

/// W11.5 inbound dApp handoff. Links carry intent only and never signing authority.
struct DappHandoff420: Equatable {
    let origin: String
    let requestID: String
    let expiresAt: Int64
    let callbackURL: String
    let transport: String
}

enum DappHandoff420Error: Error {
    case invalidURL
    case forbiddenComponents
    case developmentSchemeDisabled
    case invalidDevelopmentPath
    case productionLinkMismatch
    case invalidOrigin
    case invalidRequestID
    case invalidExpiry
    case expired
    case expiryTooLong
    case invalidCallback
    case callbackOriginMismatch
}

enum DappHandoffParser420 {
    private static let maxLifetimeMs: Int64 = 10 * 60 * 1000
    private static let requestIDPattern = try! NSRegularExpression(pattern: "^[A-Za-z0-9._:-]{8,128}$")

    static func parse(
        _ value: String,
        productionHost: String,
        nowMs: Int64 = Int64(Date().timeIntervalSince1970 * 1000),
        allowDevelopmentScheme: Bool = false
    ) throws -> DappHandoff420 {
        guard let components = URLComponents(string: value), let scheme = components.scheme?.lowercased() else {
            throw DappHandoff420Error.invalidURL
        }
        guard components.fragment == nil, components.user == nil, components.password == nil else {
            throw DappHandoff420Error.forbiddenComponents
        }

        let development = scheme == "420wallet"
        if development {
            guard allowDevelopmentScheme else { throw DappHandoff420Error.developmentSchemeDisabled }
            guard components.host == "connect", components.path.isEmpty || components.path == "/" else {
                throw DappHandoff420Error.invalidDevelopmentPath
            }
        } else {
            guard scheme == "https",
                  !productionHost.isEmpty,
                  components.host?.lowercased() == productionHost.lowercased(),
                  components.path == "/connect"
            else { throw DappHandoff420Error.productionLinkMismatch }
        }

        let query = Dictionary(uniqueKeysWithValues: (components.queryItems ?? []).map { ($0.name, $0.value ?? "") })
        let origin = try normalizeOrigin(query["origin"])
        guard let requestID = query["requestId"], validRequestID(requestID) else { throw DappHandoff420Error.invalidRequestID }
        guard let expiryString = query["expiresAt"], let expiresAt = Int64(expiryString), expiresAt > 0 else { throw DappHandoff420Error.invalidExpiry }
        guard expiresAt > nowMs else { throw DappHandoff420Error.expired }
        guard expiresAt - nowMs <= maxLifetimeMs else { throw DappHandoff420Error.expiryTooLong }
        let callbackURL = try normalizeCallback(query["callback"], origin: origin)
        return DappHandoff420(origin: origin, requestID: requestID, expiresAt: expiresAt, callbackURL: callbackURL, transport: development ? "development-scheme" : "verified-link")
    }

    private static func validRequestID(_ value: String) -> Bool {
        let range = NSRange(value.startIndex..<value.endIndex, in: value)
        return requestIDPattern.firstMatch(in: value, range: range) != nil
    }

    private static func normalizeOrigin(_ value: String?) throws -> String {
        guard let value, let components = URLComponents(string: value),
              components.scheme?.lowercased() == "https",
              let host = components.host, !host.isEmpty,
              components.user == nil, components.password == nil
        else { throw DappHandoff420Error.invalidOrigin }
        let port = components.port.map { ":\($0)" } ?? ""
        return "https://\(host.lowercased())\(port)"
    }

    private static func normalizeCallback(_ value: String?, origin: String) throws -> String {
        guard let value, let components = URLComponents(string: value),
              components.scheme?.lowercased() == "https",
              let host = components.host, !host.isEmpty,
              components.user == nil, components.password == nil
        else { throw DappHandoff420Error.invalidCallback }
        let port = components.port.map { ":\($0)" } ?? ""
        guard "https://\(host.lowercased())\(port)" == origin else { throw DappHandoff420Error.callbackOriginMismatch }
        guard let url = components.url else { throw DappHandoff420Error.invalidCallback }
        return url.absoluteString
    }
}

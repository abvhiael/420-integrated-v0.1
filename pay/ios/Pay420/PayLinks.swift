import Foundation

struct PayDeployment {
    let payHost: String
    let chainID: String
    let walletHost: String

    init(bundle: Bundle = .main) {
        payHost = bundle.object(forInfoDictionaryKey: "PayLinkHost") as? String ?? ""
        chainID = bundle.object(forInfoDictionaryKey: "PayChainID") as? String ?? ""
        walletHost = bundle.object(forInfoDictionaryKey: "WalletLinkHost") as? String ?? ""
    }

    var configured: Bool {
        PayLinks.validHost(payHost) && chainID.range(of: #"^[1-9][0-9]{0,77}$"#, options: .regularExpression) != nil
    }
}

enum PayLinks {
    static func validHost(_ host: String) -> Bool {
        host.range(of: #"^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$"#, options: .regularExpression) != nil
    }

    private static func components(_ url: URL, on host: String) -> URLComponents? {
        guard validHost(host), let parts = URLComponents(url: url, resolvingAgainstBaseURL: false),
              parts.scheme == "https", parts.host == host, parts.port == nil,
              parts.user == nil, parts.password == nil else { return nil }
        return parts
    }

    static func hosted(_ url: URL, on host: String) -> Bool {
        guard let parts = components(url, on: host) else { return false }
        return parts.percentEncodedPath == "/" && parts.percentEncodedQuery == nil &&
            parts.percentEncodedFragment?.hasPrefix("pay?") == true
    }

    static func handoff(payHost: String, walletHost: String, now: Date) -> WalletHandoff? {
        guard validHost(payHost), validHost(walletHost), payHost != walletHost else { return nil }
        let request = UUID().uuidString.lowercased()
        let expiry = now.addingTimeInterval(120)
        let origin = "https://\(payHost)"
        var link = URLComponents()
        link.scheme = "https"
        link.host = walletHost
        link.path = "/connect"
        link.queryItems = [
            URLQueryItem(name: "origin", value: origin),
            URLQueryItem(name: "requestId", value: request),
            URLQueryItem(name: "expiresAt", value: String(Int64(expiry.timeIntervalSince1970 * 1000))),
            URLQueryItem(name: "callback", value: "\(origin)/wallet-return?requestId=\(request)")
        ]
        guard let url = link.url else { return nil }
        return WalletHandoff(url: url, id: request, started: now, expires: expiry)
    }

    struct WalletHandoff {
        let url: URL
        let id: String
        let started: Date
        let expires: Date

        func matches(_ callback: URL, on host: String, now: Date) -> Bool {
            guard now >= started, now < expires, let parts = PayLinks.components(callback, on: host)
            else { return false }
            return parts.percentEncodedPath == "/wallet-return" && parts.fragment == nil &&
                parts.percentEncodedQuery == "requestId=\(id)"
        }
    }
}

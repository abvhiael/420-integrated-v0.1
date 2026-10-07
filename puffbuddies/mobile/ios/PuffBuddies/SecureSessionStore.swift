import Foundation
import Security

final class PuffBuddiesSecureSessionStore {
    private let service = "org.420integrated.puffbuddies"
    private let account = "session"

    func save(_ token: String) throws {
        guard !token.isEmpty, token.utf8.count <= 4096 else { throw NSError(domain:"PuffBuddies",code:1) }
        try clear()
        let data = Data(token.utf8)
        let query: [String:Any] = [
            kSecClass as String:kSecClassGenericPassword,
            kSecAttrService as String:service,
            kSecAttrAccount as String:account,
            kSecAttrAccessible as String:kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
            kSecValueData as String:data
        ]
        guard SecItemAdd(query as CFDictionary,nil) == errSecSuccess else { throw NSError(domain:"PuffBuddies",code:2) }
    }

    func load() -> String? {
        let query:[String:Any] = [
            kSecClass as String:kSecClassGenericPassword,
            kSecAttrService as String:service,
            kSecAttrAccount as String:account,
            kSecReturnData as String:true,
            kSecMatchLimit as String:kSecMatchLimitOne
        ]
        var item:CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary,&item) == errSecSuccess,
              let data=item as? Data else { return nil }
        return String(data:data,encoding:.utf8)
    }

    func clear() throws {
        let query:[String:Any] = [kSecClass as String:kSecClassGenericPassword,kSecAttrService as String:service,kSecAttrAccount as String:account]
        let status=SecItemDelete(query as CFDictionary)
        if status != errSecSuccess && status != errSecItemNotFound { throw NSError(domain:"PuffBuddies",code:3) }
    }
}

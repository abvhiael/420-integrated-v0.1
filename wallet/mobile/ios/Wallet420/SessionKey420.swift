import Foundation
import Security

/// W11.2 device-local session signer.
///
/// On physical devices, Secure Enclave is preferred. Simulator/unsupported
/// environments fall back to a non-exportable Keychain-backed P-256 key so CI
/// can compile and exercise the same lifecycle without introducing exportable
/// private-key material. Keys are device-only, available only while unlocked,
/// and version-namespaced so migration never reuses obsolete private material.
final class SessionKey420 {
    private let tagPrefix = "io.fourtwenty.wallet.session.v1."
    private let legacyTagPrefix = "io.fourtwenty.wallet.session."
    private let keyVersionValue = 1

    func ensure(alias: String) throws -> Data {
        try validate(alias: alias)
        try migrateLegacyAlias(alias: alias)
        if let key = try privateKey(alias: alias) {
            return try publicKeyData(for: key)
        }
        let key = try generate(alias: alias)
        return try publicKeyData(for: key)
    }

    func publicKey(alias: String) throws -> Data {
        try validate(alias: alias)
        guard let key = try privateKey(alias: alias) else {
            throw SessionKeyError.unavailable
        }
        return try publicKeyData(for: key)
    }

    func signHash(alias: String, hash: Data) throws -> Data {
        try validate(alias: alias)
        guard !hash.isEmpty else { throw SessionKeyError.invalidInput }
        guard let key = try privateKey(alias: alias) else {
            throw SessionKeyError.unavailable
        }
        var error: Unmanaged<CFError>?
        guard let signature = SecKeyCreateSignature(
            key,
            .ecdsaSignatureDigestX962SHA256,
            hash as CFData,
            &error
        ) as Data? else {
            if let error { throw error.takeRetainedValue() }
            throw SessionKeyError.signingFailed
        }
        return signature
    }

    func rotate(alias: String) throws -> Data {
        try invalidate(alias: alias)
        return try ensure(alias: alias)
    }

    func invalidate(alias: String) throws {
        try validate(alias: alias)
        let status = SecItemDelete(baseQuery(alias: alias) as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw SessionKeyError.keychain(status)
        }
        let legacyStatus = SecItemDelete(legacyQuery(alias: alias) as CFDictionary)
        guard legacyStatus == errSecSuccess || legacyStatus == errSecItemNotFound else {
            throw SessionKeyError.keychain(legacyStatus)
        }
    }

    func keyVersion() -> Int { keyVersionValue }

    private func generate(alias: String) throws -> SecKey {
        let access = SecAccessControlCreateWithFlags(
            nil,
            kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
            .privateKeyUsage,
            nil
        )!

        var privateAttrs: [String: Any] = [
            kSecAttrIsPermanent as String: true,
            kSecAttrApplicationTag as String: tag(alias: alias),
            kSecAttrAccessControl as String: access,
        ]

        var attributes: [String: Any] = [
            kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
            kSecAttrKeySizeInBits as String: 256,
            kSecPrivateKeyAttrs as String: privateAttrs,
        ]

        #if targetEnvironment(simulator)
        // Simulator has no Secure Enclave; Keychain still retains the private key.
        #else
        attributes[kSecAttrTokenID as String] = kSecAttrTokenIDSecureEnclave
        #endif

        var error: Unmanaged<CFError>?
        if let key = SecKeyCreateRandomKey(attributes as CFDictionary, &error) {
            return key
        }

        #if targetEnvironment(simulator)
        if let error { throw error.takeRetainedValue() }
        throw SessionKeyError.generationFailed
        #else
        attributes.removeValue(forKey: kSecAttrTokenID as String)
        privateAttrs[kSecAttrAccessControl as String] = access
        attributes[kSecPrivateKeyAttrs as String] = privateAttrs
        error = nil
        if let fallback = SecKeyCreateRandomKey(attributes as CFDictionary, &error) {
            return fallback
        }
        if let error { throw error.takeRetainedValue() }
        throw SessionKeyError.generationFailed
        #endif
    }

    private func migrateLegacyAlias(alias: String) throws {
        guard try privateKey(alias: alias) == nil else { return }
        let status = SecItemDelete(legacyQuery(alias: alias) as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw SessionKeyError.keychain(status)
        }
    }

    private func privateKey(alias: String) throws -> SecKey? {
        var query = baseQuery(alias: alias)
        query[kSecReturnRef as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        if status == errSecItemNotFound { return nil }
        if status == errSecInteractionNotAllowed { throw SessionKeyError.deviceLocked }
        guard status == errSecSuccess, let key = item else {
            throw SessionKeyError.keychain(status)
        }
        return (key as! SecKey)
    }

    private func publicKeyData(for privateKey: SecKey) throws -> Data {
        guard let publicKey = SecKeyCopyPublicKey(privateKey) else {
            throw SessionKeyError.unavailable
        }
        var error: Unmanaged<CFError>?
        if let data = SecKeyCopyExternalRepresentation(publicKey, &error) as Data? {
            return data
        }
        if let error { throw error.takeRetainedValue() }
        throw SessionKeyError.unavailable
    }

    private func baseQuery(alias: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassKey,
            kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
            kSecAttrApplicationTag as String: tag(alias: alias),
        ]
    }

    private func legacyQuery(alias: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassKey,
            kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
            kSecAttrApplicationTag as String: Data((legacyTagPrefix + alias).utf8),
        ]
    }

    private func tag(alias: String) -> Data {
        Data((tagPrefix + alias).utf8)
    }

    private func validate(alias: String) throws {
        guard !alias.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw SessionKeyError.invalidInput
        }
    }
}

enum SessionKeyError: Error {
    case invalidInput
    case unavailable
    case deviceLocked
    case generationFailed
    case signingFailed
    case keychain(OSStatus)
}

import AuthenticationServices
import Foundation

/// W11.3 native iOS passkey ceremony adapter.
/// Shared Wallet Core remains responsible for WebAuthn/PK42 validation and binding.
@MainActor
final class Passkey420: NSObject, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    private var continuation: CheckedContinuation<String, Error>?

    func create(requestJSON: String) async throws -> String {
        let options = try JSONDecoder().decode(CreationOptions.self, from: Data(requestJSON.utf8))
        guard !options.rp.id.isEmpty,
              let challenge = Data(base64URLEncoded: options.challenge),
              let userID = Data(base64URLEncoded: options.user.id)
        else { throw Passkey420Error.invalidRequest }

        let provider = ASAuthorizationPlatformPublicKeyCredentialProvider(relyingPartyIdentifier: options.rp.id)
        let request = provider.createCredentialRegistrationRequest(
            challenge: challenge,
            name: options.user.name,
            userID: userID
        )
        request.userVerificationPreference = .required
        return try await perform(request)
    }

    func get(requestJSON: String) async throws -> String {
        let options = try JSONDecoder().decode(RequestOptions.self, from: Data(requestJSON.utf8))
        guard !options.rpId.isEmpty,
              let challenge = Data(base64URLEncoded: options.challenge)
        else { throw Passkey420Error.invalidRequest }

        let provider = ASAuthorizationPlatformPublicKeyCredentialProvider(relyingPartyIdentifier: options.rpId)
        let request = provider.createCredentialAssertionRequest(challenge: challenge)
        request.userVerificationPreference = .required
        request.allowedCredentials = (options.allowCredentials ?? []).compactMap { item in
            guard let id = Data(base64URLEncoded: item.id) else { return nil }
            return ASAuthorizationPlatformPublicKeyCredentialDescriptor(credentialID: id)
        }
        return try await perform(request)
    }

    private func perform(_ request: ASAuthorizationRequest) async throws -> String {
        guard continuation == nil else { throw Passkey420Error.ceremonyInProgress }
        return try await withCheckedThrowingContinuation { continuation in
            self.continuation = continuation
            let controller = ASAuthorizationController(authorizationRequests: [request])
            controller.delegate = self
            controller.presentationContextProvider = self
            controller.performRequests()
        }
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        do {
            let response: WebAuthnResponse
            if let registration = authorization.credential as? ASAuthorizationPlatformPublicKeyCredentialRegistration {
                response = WebAuthnResponse(
                    id: registration.credentialID.base64URLEncodedString(),
                    rawId: registration.credentialID.base64URLEncodedString(),
                    type: "public-key",
                    response: .registration(
                        clientDataJSON: registration.rawClientDataJSON.base64URLEncodedString(),
                        attestationObject: registration.rawAttestationObject?.base64URLEncodedString() ?? ""
                    )
                )
            } else if let assertion = authorization.credential as? ASAuthorizationPlatformPublicKeyCredentialAssertion {
                response = WebAuthnResponse(
                    id: assertion.credentialID.base64URLEncodedString(),
                    rawId: assertion.credentialID.base64URLEncodedString(),
                    type: "public-key",
                    response: .assertion(
                        clientDataJSON: assertion.rawClientDataJSON.base64URLEncodedString(),
                        authenticatorData: assertion.rawAuthenticatorData.base64URLEncodedString(),
                        signature: assertion.signature.base64URLEncodedString(),
                        userHandle: assertion.userID.base64URLEncodedString()
                    )
                )
            } else {
                throw Passkey420Error.unexpectedCredential
            }
            let data = try JSONEncoder().encode(response)
            finish(.success(String(decoding: data, as: UTF8.self)))
        } catch {
            finish(.failure(error))
        }
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        finish(.failure(error))
    }

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        ASPresentationAnchor()
    }

    private func finish(_ result: Result<String, Error>) {
        guard let continuation else { return }
        self.continuation = nil
        switch result {
        case .success(let value): continuation.resume(returning: value)
        case .failure(let error): continuation.resume(throwing: error)
        }
    }
}

private struct CreationOptions: Decodable {
    struct RP: Decodable { let id: String }
    struct User: Decodable { let id: String; let name: String }
    let rp: RP
    let user: User
    let challenge: String
}

private struct RequestOptions: Decodable {
    struct Descriptor: Decodable { let id: String }
    let rpId: String
    let challenge: String
    let allowCredentials: [Descriptor]?
}

private struct WebAuthnResponse: Encodable {
    enum Payload: Encodable {
        case registration(clientDataJSON: String, attestationObject: String)
        case assertion(clientDataJSON: String, authenticatorData: String, signature: String, userHandle: String)

        func encode(to encoder: Encoder) throws {
            var container = encoder.container(keyedBy: CodingKeys.self)
            switch self {
            case .registration(let clientDataJSON, let attestationObject):
                try container.encode(clientDataJSON, forKey: .clientDataJSON)
                try container.encode(attestationObject, forKey: .attestationObject)
            case .assertion(let clientDataJSON, let authenticatorData, let signature, let userHandle):
                try container.encode(clientDataJSON, forKey: .clientDataJSON)
                try container.encode(authenticatorData, forKey: .authenticatorData)
                try container.encode(signature, forKey: .signature)
                try container.encode(userHandle, forKey: .userHandle)
            }
        }

        enum CodingKeys: String, CodingKey { case clientDataJSON, attestationObject, authenticatorData, signature, userHandle }
    }

    let id: String
    let rawId: String
    let type: String
    let response: Payload
}

private extension Data {
    init?(base64URLEncoded value: String) {
        var base64 = value.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        while base64.count % 4 != 0 { base64.append("=") }
        self.init(base64Encoded: base64)
    }

    func base64URLEncodedString() -> String {
        base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
    }
}

enum Passkey420Error: Error {
    case invalidRequest
    case ceremonyInProgress
    case unexpectedCredential
}

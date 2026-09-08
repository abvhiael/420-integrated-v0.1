import XCTest
@testable import Wallet420

final class AuthorityPolicy420Tests: XCTestCase {
    func testCanonicalAuthorityRemainsOnChainAndRpcIsTransportOnly() {
        XCTAssertEqual(AuthorityPolicy420.canonicalAccountAuthority, "SmartAccount420")
        XCTAssertEqual(AuthorityPolicy420.canonicalCapabilityAuthority, "CapabilityRegistry420")
        XCTAssertEqual(AuthorityPolicy420.rpcRole, "read_transport_only")
        XCTAssertFalse(AuthorityPolicy420.nativeClientIsCanonicalAuthority)
        XCTAssertFalse(AuthorityPolicy420.remoteSignerAllowed)
        XCTAssertFalse(AuthorityPolicy420.exportablePrivateKeyAllowed)
    }

    func testOnlyQualifiedRpcVocabularyIsAllowed() {
        XCTAssertTrue(AuthorityPolicy420.rpcMethodAllowed("eth_chainId"))
        XCTAssertTrue(AuthorityPolicy420.rpcMethodAllowed("eth_sendUserOperation"))
        XCTAssertFalse(AuthorityPolicy420.rpcMethodAllowed("eth_sendTransaction"))
        XCTAssertFalse(AuthorityPolicy420.rpcMethodAllowed("personal_sign"))
        XCTAssertFalse(AuthorityPolicy420.rpcMethodAllowed("eth_signTypedData_v4"))
    }

    func testEndpointsMustBeCredentialFreeHttps() {
        XCTAssertTrue(AuthorityPolicy420.endpointAllowed("https://rpc.example"))
        XCTAssertFalse(AuthorityPolicy420.endpointAllowed("http://rpc.example"))
        XCTAssertFalse(AuthorityPolicy420.endpointAllowed("https://user:pass@rpc.example"))
    }
}

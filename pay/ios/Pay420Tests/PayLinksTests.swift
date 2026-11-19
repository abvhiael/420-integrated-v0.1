import XCTest
@testable import Pay420

final class PayLinksTests: XCTestCase {
    func testHostedReviewRejectsOriginAndPathSubstitutions() throws {
        let host = "pay.420integrated.org"
        for value in ["https://\(host).invalid/#pay?v=1", "https://user@\(host)/#pay?v=1",
                      "https://\(host):8443/#pay?v=1", "https://\(host)/wallet-return#pay?v=1",
                      "https://\(host)/?next=foo#pay?v=1", "http://\(host)/#pay?v=1"] {
            XCTAssertFalse(PayLinks.hosted(try XCTUnwrap(URL(string: value)), on: host))
        }
        XCTAssertTrue(PayLinks.hosted(try XCTUnwrap(URL(string: "https://\(host)/#pay?v=1")), on: host))
    }

    func testWalletReturnRequiresExactLiveRequest() throws {
        let host = "pay.420integrated.org"
        let start = Date(timeIntervalSince1970: 1_800_000_000)
        let handoff = try XCTUnwrap(PayLinks.handoff(payHost: host, walletHost: "wallet.example.test", now: start))
        let callback = try XCTUnwrap(URL(string: "https://\(host)/wallet-return?requestId=\(handoff.id)"))
        XCTAssertEqual(handoff.url.host, "wallet.example.test")
        XCTAssertTrue(handoff.matches(callback, on: host, now: start))
        XCTAssertFalse(handoff.matches(callback, on: host, now: handoff.expires))
        XCTAssertFalse(handoff.matches(callback, on: host, now: start.addingTimeInterval(-1)))
        XCTAssertFalse(handoff.matches(callback, on: "other.example.test", now: start))
        XCTAssertFalse(handoff.matches(try XCTUnwrap(URL(string: callback.absoluteString + "&settled=true")),
                                      on: host, now: start))
        XCTAssertNotEqual(handoff.id, PayLinks.handoff(payHost: host, walletHost: "wallet.example.test", now: start)?.id)
    }
}

import XCTest

final class PayUITests: XCTestCase {
    func testBundledSdkReviewAndUnverifiedWallet() {
        let app = XCUIApplication()
        app.launch()
        let check = app.buttons["Check link"]
        let enabled = XCTNSPredicateExpectation(predicate: NSPredicate(format: "enabled == true"), object: check)
        XCTAssertEqual(XCTWaiter.wait(for: [enabled], timeout: 20), .completed)
        let input = app.textFields["pay.input"]
        input.tap()
        input.typeText("0x" + String(repeating: "ab", count: 20))
        check.tap()
        let status = app.staticTexts["pay.status"]
        let reviewed = XCTNSPredicateExpectation(predicate: NSPredicate(format: "label == %@",
            "Link checked. Open 420 Pay for current terms and Wallet approval."), object: status)
        XCTAssertEqual(XCTWaiter.wait(for: [reviewed], timeout: 10), .completed)
        XCTAssertTrue(app.buttons["Open hosted review"].isEnabled)
        app.buttons["Clear review"].tap()
        XCTAssertFalse(app.buttons["Open hosted review"].isEnabled)
        app.buttons["Open verified 420 Wallet"].tap()
        let unavailable = XCTNSPredicateExpectation(predicate: NSPredicate(format: "label == %@",
            "Verified 420 Wallet Universal Link is unavailable."), object: status)
        XCTAssertEqual(XCTWaiter.wait(for: [unavailable], timeout: 10), .completed)
    }
}

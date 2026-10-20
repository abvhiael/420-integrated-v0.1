import XCTest

final class LIFTdPreviewUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testRiderDriverAndRecoveryFailClosed() throws {
        let app = XCUIApplication()
        app.launch()
        let rider = app.buttons["Open rider preview"]
        let driver = app.buttons["Open driver preview"]
        XCTAssertTrue(rider.waitForExistence(timeout: 25), "Welcome screen must expose rider preview")
        XCTAssertTrue(driver.exists, "Welcome screen must expose driver preview")
        rider.tap()
        XCTAssertTrue(app.staticTexts["Your ride"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["No confirmed trip"].exists)
        XCTAssertFalse(app.buttons["Request fare quote"].isEnabled, "No backend means no authorized quote")
        XCTAssertFalse(app.buttons["Accept fare terms and request ride"].isEnabled, "No backend means no dispatch")
        let back = app.buttons["Return to role selection"]
        for _ in 0..<8 where !back.isHittable { app.swipeUp() }
        XCTAssertTrue(back.waitForExistence(timeout: 10))
        back.tap()
        XCTAssertTrue(driver.waitForExistence(timeout: 10))
        driver.tap()
        XCTAssertTrue(app.staticTexts["Driver workspace"].waitForExistence(timeout: 10))
        XCTAssertFalse(app.buttons["Request online availability"].isEnabled)
        XCTAssertFalse(app.buttons["Request trip start"].isEnabled)
        app.terminate()
        app.launch()
        XCTAssertTrue(rider.waitForExistence(timeout: 25), "Relaunch must not restore rider or driver authority")
        XCTAssertTrue(driver.exists)
    }
}

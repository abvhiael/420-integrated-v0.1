import XCTest

final class Wallet420UITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testPrimaryWalletSurfacesAreReachable() throws {
        let app = XCUIApplication()
        app.launchArguments += ["--ui-test"]
        app.launch()

        XCTAssertTrue(app.staticTexts["Wallet"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["Wallet"].exists || app.staticTexts["Wallet"].exists)

        for label in ["Apps", "Activity", "Security"] {
            let candidate = app.buttons[label]
            if candidate.exists {
                candidate.tap()
                XCTAssertTrue(app.staticTexts[label].waitForExistence(timeout: 2) || app.navigationBars[label].exists)
            }
        }
    }
}

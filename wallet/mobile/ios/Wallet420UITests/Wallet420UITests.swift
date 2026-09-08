import XCTest

final class Wallet420UITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testPrimaryWalletSurfacesAreReachable() throws {
        let app = XCUIApplication()
        app.launchArguments += ["--ui-test"]
        app.launch()

        XCTAssertTrue(app.staticTexts["wallet420.surface.wallet"].waitForExistence(timeout: 8))
        XCTAssertFalse(app.staticTexts["wallet420.privacy-shield"].exists)

        for surface in ["apps", "activity", "security", "wallet"] {
            let tab = app.buttons["wallet420.tab.\(surface)"]
            XCTAssertTrue(tab.waitForExistence(timeout: 3), "missing tab for \(surface)")
            tab.tap()
            XCTAssertTrue(
                app.staticTexts["wallet420.surface.\(surface)"].waitForExistence(timeout: 3),
                "surface did not become reachable: \(surface)"
            )
        }
    }
}

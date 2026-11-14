import XCTest

final class HikingUITests: XCTestCase {
    func testBundledHikingPagesAndNativeFilePicker() {
        let app = XCUIApplication()
        app.launch()
        let hiking = app.webViews.links.matching(NSPredicate(format: "label CONTAINS %@", "하이킹")).firstMatch
        XCTAssertTrue(hiking.waitForExistence(timeout: 30))
        hiking.tap()
        XCTAssertTrue(app.webViews.staticTexts["현재 위치에서 하이킹 시작"].waitForExistence(timeout: 15) || app.webViews.buttons["현재 위치에서 하이킹 시작"].exists)
        let shot = XCTAttachment(screenshot: app.screenshot()); shot.name = "iPhone-hiking"; shot.lifetime = .keepAlways; add(shot)
        let maps = app.webViews.links.matching(NSPredicate(format: "label CONTAINS %@", "지도")).firstMatch
        XCTAssertTrue(maps.exists); maps.tap()
        let picker = app.webViews.buttons["지도 파일 가져오기"]
        XCTAssertTrue(picker.waitForExistence(timeout: 15)); picker.tap()
        XCTAssertTrue(app.navigationBars.firstMatch.waitForExistence(timeout: 15), "Native Files picker must be presented")
        let files = XCTAttachment(screenshot: app.screenshot()); files.name = "iPhone-Files-picker"; files.lifetime = .keepAlways; add(files)
    }
}

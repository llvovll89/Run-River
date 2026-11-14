import XCTest

final class HikingUITests: XCTestCase {
    func testStartPauseFinishSaveAndExportHiking() {
        let app = XCUIApplication(); app.launch()
        let hiking = app.webViews.links.matching(NSPredicate(format: "label CONTAINS %@", "하이킹")).firstMatch
        XCTAssertTrue(hiking.waitForExistence(timeout: 30)); hiking.tap()
        let start = app.webViews.buttons["현재 위치에서 하이킹 시작"]
        XCTAssertTrue(start.waitForExistence(timeout: 15)); start.tap()
        let pause = app.webViews.buttons["일시정지"]
        for _ in 0..<8 {
            if pause.waitForExistence(timeout: 3) { break }
            for title in ["Allow While Using App", "Allow Once", "Allow", "OK"] {
                let permission = app.alerts.buttons[title]
                if permission.exists { permission.tap() }
            }
        }
        XCTAssertTrue(pause.exists, "The real hiking start button must obtain location and reach the native recording screen")
        guard pause.exists else { return }
        XCTAssertTrue(app.webViews.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "GPS 수신 중")).firstMatch.waitForExistence(timeout: 20))
        pause.tap()
        let resume = app.webViews.buttons["기록 재개"]
        XCTAssertTrue(resume.waitForExistence(timeout: 10)); resume.tap()
        app.webViews.buttons["이동 종료"].tap()
        let confirm = app.webViews.buttons["종료 확인"]
        XCTAssertTrue(confirm.waitForExistence(timeout: 10)); confirm.tap()
        let save = app.webViews.buttons["결과 저장하기"]
        XCTAssertTrue(save.waitForExistence(timeout: 10)); save.tap()
        let export = app.webViews.buttons["이동 경로 GPX 내보내기"]
        XCTAssertTrue(export.waitForExistence(timeout: 15)); export.tap()
        XCTAssertTrue(app.navigationBars.firstMatch.waitForExistence(timeout: 15), "GPX export must present the native Files picker")
        let shot = XCTAttachment(screenshot: app.screenshot()); shot.name = "iPhone-GPX-export"; shot.lifetime = .keepAlways; add(shot)
    }
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

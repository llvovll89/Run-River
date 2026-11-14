import XCTest

final class HikingUITests: XCTestCase {
    private func tapVisible(_ element: XCUIElement, in app: XCUIApplication) {
        // A tap can return before WKWebView commits the next document. Do not
        // start swiping the old page while the destination is still loading.
        _ = element.waitForExistence(timeout: 10)
        for _ in 0..<8 {
            if element.exists && element.isHittable { break }
            app.swipeUp()
        }
        XCTAssertTrue(element.waitForExistence(timeout: 15))
        element.tap()
    }
    func testStartPauseFinishSaveAndExportHiking() {
        let app = XCUIApplication(); app.launch()
        let hiking = app.webViews.links.matching(NSPredicate(format: "label CONTAINS %@", "하이킹")).firstMatch
        XCTAssertTrue(hiking.waitForExistence(timeout: 30)); hiking.tap()
        let start = app.webViews.buttons["현재 위치에서 하이킹 시작"]
        tapVisible(start, in: app)
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
        tapVisible(pause, in: app)
        let resume = app.webViews.buttons["기록 재개"]
        XCTAssertTrue(resume.waitForExistence(timeout: 10)); resume.tap()
        let finish = app.webViews.buttons["운동 종료"]
        XCTAssertTrue(finish.waitForExistence(timeout: 10)); finish.tap()
        let confirm = app.webViews.buttons["종료 확인"]
        XCTAssertTrue(confirm.waitForExistence(timeout: 10)); confirm.tap()
        let save = app.webViews.buttons["결과 저장하기"]
        tapVisible(save, in: app)
        let export = app.webViews.buttons["이동 경로 GPX 내보내기"]
        tapVisible(export, in: app)
        XCTAssertTrue(app.navigationBars.firstMatch.waitForExistence(timeout: 15), "GPX export must present the native Files picker")
        let shot = XCTAttachment(screenshot: app.screenshot()); shot.name = "iPhone-GPX-export"; shot.lifetime = .keepAlways; add(shot)
    }
    func testBundledHikingPagesAndNativeFilePicker() {
        let app = XCUIApplication()
        app.launch()
        let hiking = app.webViews.links.matching(NSPredicate(format: "label CONTAINS %@", "하이킹")).firstMatch
        XCTAssertTrue(hiking.waitForExistence(timeout: 30))
        hiking.tap()
        XCTAssertTrue(app.webViews.staticTexts["산길에서도 나의 페이스로"].waitForExistence(timeout: 30))
        let shot = XCTAttachment(screenshot: app.screenshot()); shot.name = "iPhone-hiking"; shot.lifetime = .keepAlways; add(shot)
        let maps = app.webViews.links["오프라인 지도 저장·관리"]
        tapVisible(maps, in: app)
        XCTAssertTrue(app.webViews.staticTexts["산에 가기 전, 지도 준비"].waitForExistence(timeout: 30))
        let picker = app.webViews.buttons["지도 파일 가져오기"]
        tapVisible(picker, in: app)
        XCTAssertTrue(app.navigationBars.firstMatch.waitForExistence(timeout: 15), "Native Files picker must be presented")
        let files = XCTAttachment(screenshot: app.screenshot()); files.name = "iPhone-Files-picker"; files.lifetime = .keepAlways; add(files)
    }
}

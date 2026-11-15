import Foundation
import SQLite3

enum HikingError: LocalizedError {
    case message(String)
    var errorDescription: String? { if case let .message(text) = self { return text }; return nil }
}

// A fix and its distance/time checkpoint commit together, including while WKWebView is suspended.
final class RunStore {
    private var db: OpaquePointer?
    private var configured = false
    init(url: URL) throws {
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        guard sqlite3_open(url.path, &db) == SQLITE_OK else { throw HikingError.message("기록 저장소를 열 수 없어요.") }
        try execute("PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS session(id INTEGER PRIMARY KEY CHECK(id=1), json TEXT NOT NULL); CREATE TABLE IF NOT EXISTS fixes(id INTEGER PRIMARY KEY, json TEXT NOT NULL); CREATE TABLE IF NOT EXISTS config(id INTEGER PRIMARY KEY CHECK(id=1), json TEXT NOT NULL)")
        configured = !(try read("SELECT json FROM config WHERE id=1")).isEmpty
        try FileManager.default.setAttributes([.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: url.path)
    }
    deinit { sqlite3_close(db) }
    private func execute(_ sql: String) throws {
        guard sqlite3_exec(db, sql, nil, nil, nil) == SQLITE_OK else { throw HikingError.message("기기를 확인해주세요. 기록 저장에 실패했어요.") }
    }
    private func write(_ sql: String, _ value: [String: Any]) throws {
        let data = try JSONSerialization.data(withJSONObject: value, options: [.sortedKeys])
        let json = String(decoding: data, as: UTF8.self)
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else { throw HikingError.message("기록을 저장할 수 없어요.") }
        defer { sqlite3_finalize(statement) }
        let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
        guard sqlite3_bind_text(statement, 1, json, -1, transient) == SQLITE_OK, sqlite3_step(statement) == SQLITE_DONE else { throw HikingError.message("저장 공간을 확인해주세요. 기록을 저장할 수 없어요.") }
    }
    func save(_ state: [String: Any], point: [String: Any]? = nil) throws {
        var metrics = state
        let config = metrics.removeValue(forKey: "config") as? [String: Any]
        try execute("BEGIN IMMEDIATE")
        do {
            if !configured, let config { try write("INSERT INTO config(id,json) VALUES(1,?)", config) }
            try write("INSERT OR REPLACE INTO session(id,json) VALUES(1,?)", metrics)
            if let point { try write("INSERT INTO fixes(json) VALUES(?)", point) }
            try execute("COMMIT")
            if config != nil { configured = true }
        } catch { try? execute("ROLLBACK"); throw error }
    }
    private func read(_ sql: String) throws -> [[String: Any]] {
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else { throw HikingError.message("기록을 읽을 수 없어요.") }
        defer { sqlite3_finalize(statement) }
        var rows = [[String: Any]]()
        var step = sqlite3_step(statement)
        while step == SQLITE_ROW {
            guard let text = sqlite3_column_text(statement, 0), let data = String(cString: text).data(using: .utf8), let row = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { throw HikingError.message("저장한 기록을 읽을 수 없어요.") }
            rows.append(row)
            step = sqlite3_step(statement)
        }
        guard step == SQLITE_DONE else { throw HikingError.message("기록을 읽을 수 없어요.") }
        return rows
    }
    func state() throws -> [String: Any]? {
        guard var state = try read("SELECT json FROM session WHERE id=1").first else { return nil }
        state["config"] = try read("SELECT json FROM config WHERE id=1").first
        return state
    }
    func points() throws -> [[String: Any]] { try read("SELECT json FROM fixes ORDER BY id") }
    func clear(runId: String) throws {
        guard let state = try state(), state["status"] as? String == "finished", (state["config"] as? [String: Any])?["runId"] as? String == runId else { throw HikingError.message("완료한 기록만 정리할 수 있어요.") }
        try execute("BEGIN IMMEDIATE")
        do { try execute("DELETE FROM session; DELETE FROM fixes; DELETE FROM config; COMMIT"); configured = false } catch { try? execute("ROLLBACK"); throw error }
    }
}

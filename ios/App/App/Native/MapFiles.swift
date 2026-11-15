import Foundation
import CryptoKit

final class MapFiles {
    static let maxBytes = 200 * 1024 * 1024
    let directory: URL
    init(directory: URL) throws {
        self.directory = directory
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        var excluded = directory
        var values = URLResourceValues(); values.isExcludedFromBackup = true
        try excluded.setResourceValues(values)
    }
    func url(_ id: String) throws -> URL {
        guard let uuid = UUID(uuidString: id), uuid.uuidString.lowercased() == id.lowercased() else { throw HikingError.message("지도 파일 이름을 확인해주세요.") }
        return directory.appendingPathComponent(uuid.uuidString.lowercased() + ".pmtiles")
    }
    func list() throws -> [[String: Any]] {
        try FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: [.fileSizeKey]).compactMap { url in
            guard url.pathExtension == "pmtiles", UUID(uuidString: url.deletingPathExtension().lastPathComponent) != nil else { return nil }
            return ["id": url.deletingPathExtension().lastPathComponent, "size": try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0]
        }
    }
    func read(id: String, offset: Int, length: Int) throws -> Data {
        guard offset >= 0, length > 0, length <= 16 * 1024 * 1024 else { throw HikingError.message("잘못된 지도 읽기 범위예요.") }
        let file = try url(id)
        let size = try file.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
        guard offset < size else { throw HikingError.message("지도 읽기 범위를 벗어났어요.") }
        let handle = try FileHandle(forReadingFrom: file); defer { try? handle.close() }
        try handle.seek(toOffset: UInt64(offset))
        return try handle.read(upToCount: min(length, size - offset)) ?? Data()
    }
    func remove(_ id: String) throws { try FileManager.default.removeItem(at: url(id)) }
    // Stream a security-scoped import/download, bound memory and disk use, then publish atomically.
    func importFile(_ source: URL, sha256: String? = nil) throws -> String {
        let id = UUID().uuidString.lowercased()
        let destination = try url(id), partial = directory.appendingPathComponent(id + ".part")
        defer { try? FileManager.default.removeItem(at: partial) }
        let input = try FileHandle(forReadingFrom: source); defer { try? input.close() }
        guard FileManager.default.createFile(atPath: partial.path, contents: nil, attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication]) else { throw HikingError.message("지도 저장 공간을 확인해주세요.") }
        let output = try FileHandle(forWritingTo: partial); defer { try? output.close() }
        var count = 0, header = Data(), hash = SHA256()
        while let chunk = try input.read(upToCount: 64 * 1024), !chunk.isEmpty {
            count += chunk.count
            guard count <= Self.maxBytes else { throw HikingError.message("200MB 이하 지도를 선택해주세요.") }
            if header.count < 127 { header.append(chunk.prefix(127 - header.count)) }
            hash.update(data: chunk); try output.write(contentsOf: chunk)
        }
        guard header.count == 127, header.prefix(7) == Data("PMTiles".utf8), header[7] == 3, header[99] == 1 else { throw HikingError.message("PMTiles v3 벡터 지도를 선택해주세요.") }
        let digest = hash.finalize().map { String(format: "%02x", $0) }.joined()
        if let sha256, digest != sha256.lowercased() { throw HikingError.message("지도 다운로드 검증에 실패했어요.") }
        try output.synchronize(); try output.close()
        try FileManager.default.moveItem(at: partial, to: destination)
        return id
    }
}

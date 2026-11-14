package com.runriver.app;

import java.io.*;
import java.util.UUID;

/** App-private, bounded, atomic map imports. Incomplete files are never listed. */
final class MapFiles {
    static final long MAX_BYTES = 200L * 1024 * 1024;
    private final File root;
    MapFiles(File filesDir) throws IOException {
        root = new File(filesDir, "offline-maps");
        if (!root.isDirectory() && !root.mkdirs()) throw new IOException("지도 저장 폴더를 만들지 못했어요.");
    }
    File file(String id) throws IOException {
        if (id == null || !id.matches("[a-f0-9-]{36}")) throw new IOException("잘못된 지도 ID입니다.");
        return new File(root, id + ".pmtiles");
    }
    File[] list() { File[] files = root.listFiles((dir, name) -> name.endsWith(".pmtiles")); return files == null ? new File[0] : files; }
    String copy(InputStream input) throws Exception {
        return copy(input, null);
    }
    String copy(InputStream input, String expectedSha256) throws Exception {
        String id = UUID.randomUUID().toString();
        File part = new File(root, id + ".part");
        try {
            long total = 0;
            java.security.MessageDigest digest = java.security.MessageDigest.getInstance("SHA-256");
            try (FileOutputStream out = new FileOutputStream(part)) {
                byte[] buffer = new byte[65536]; int count;
                while ((count = input.read(buffer)) != -1) {
                    total += count; if (total > MAX_BYTES) throw new IOException("지도는 200MB 이하 파일을 사용해주세요.");
                    out.write(buffer, 0, count); digest.update(buffer, 0, count);
                }
                out.getFD().sync();
            }
            if (expectedSha256 != null) {
                StringBuilder actual = new StringBuilder();
                for (byte value : digest.digest()) actual.append(String.format("%02x", value & 255));
                if (!actual.toString().equalsIgnoreCase(expectedSha256)) throw new IOException("지도 파일 확인에 실패했어요. 다시 다운로드해주세요.");
            }
            try (RandomAccessFile check = new RandomAccessFile(part, "r")) {
                byte[] header = new byte[127]; check.readFully(header);
                if (!new String(header, 0, 7, java.nio.charset.StandardCharsets.US_ASCII).equals("PMTiles") || header[7] != 3 || header[99] != 1) {
                    throw new IOException("PMTiles v3 벡터 지도 파일을 선택해주세요.");
                }
            }
            if (!part.renameTo(file(id))) throw new IOException("지도를 저장하지 못했어요. 기기 공간을 확인해주세요.");
            return id;
        } finally { if (part.exists() && !part.delete()) part.deleteOnExit(); }
    }
    byte[] read(String id, long offset, int length) throws Exception {
        if (offset < 0 || length < 0 || length > 16 * 1024 * 1024) throw new IOException("잘못된 지도 읽기 범위입니다.");
        try (RandomAccessFile input = new RandomAccessFile(file(id), "r")) {
            if (offset > input.length()) throw new IOException("지도 파일이 손상되었어요.");
            length = (int)Math.min(length, input.length() - offset);
            byte[] bytes = new byte[length]; input.seek(offset); input.readFully(bytes); return bytes;
        }
    }
    void delete(String id) throws Exception {
        File file = file(id);
        if (file.exists() && !file.delete()) throw new IOException("지도 파일을 삭제하지 못했어요.");
    }
}

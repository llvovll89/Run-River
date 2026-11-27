const PROBE_ORIGIN = "https://run-river.invalid";

// 로그인 후 이동할 경로를 같은 출처의 상대 경로로만 제한한다.
// 문자열 검사만으로는 `/\evil.com`, `/<탭>/evil.com`처럼 URL 파서가 외부 호스트로 해석하는 값을 막지 못하므로 실제로 파싱해서 확인한다.
export function sanitizeNextPath(raw: string | null): string {
    if (!raw) return "/";
    const value = raw.trim();
    if (!value.startsWith("/")) return "/";
    try {
        const parsed = new URL(value, PROBE_ORIGIN);
        if (parsed.origin !== PROBE_ORIGIN) return "/";
        const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
        // `/.//evil.com`은 정규화 후 `//evil.com`(프로토콜 상대 URL)이 되므로 결과도 다시 확인한다
        if (path.startsWith("//") || path.startsWith("/\\")) return "/";
        return path;
    } catch {
        return "/";
    }
}

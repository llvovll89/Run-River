# Run River — 인증 시스템 설계

## 배경 및 목적

현재 `running_records` 테이블에 `user_id`가 없어, 여러 기기/사용자의 기록이 하나의 DB에 섞인다.
Google OAuth, Kakao OAuth, 이메일/비밀번호 세 가지 로그인을 도입해 사용자별 기록을 분리한다.

**핵심 결정 사항**

| 항목 | 결정 |
|------|------|
| 로그인 방식 | Google OAuth, Kakao OAuth, 이메일/비밀번호 |
| 비로그인 접근 | 불가 — 전 페이지 로그인 필수 |
| 기존 DB 기록 | `user_id = NULL` 보존, RLS로 자동 격리 |

---

## 1. Supabase 대시보드 설정

> 코딩 시작 전에 먼저 완료해야 한다.

### 1-1. SQL Editor — 스키마 변경

```sql
-- user_id 컬럼 추가 (NULL 허용 → 기존 기록 보존)
ALTER TABLE running_records
  ADD COLUMN IF NOT EXISTS user_id uuid
  REFERENCES auth.users(id) ON DELETE CASCADE;

-- 기존 전체 허용 정책 제거
DROP POLICY IF EXISTS "Allow all" ON running_records;

-- RLS 정책 (NULL 행은 auth.uid()와 일치하지 않아 자연 격리됨)
CREATE POLICY "read own"   ON running_records FOR SELECT USING      (auth.uid() = user_id);
CREATE POLICY "insert own" ON running_records FOR INSERT WITH CHECK  (auth.uid() = user_id);
CREATE POLICY "update own" ON running_records FOR UPDATE USING      (auth.uid() = user_id);
CREATE POLICY "delete own" ON running_records FOR DELETE USING      (auth.uid() = user_id);

-- 조회 성능 인덱스
CREATE INDEX IF NOT EXISTS idx_running_records_user_id
  ON running_records (user_id, created_at DESC);
```

### 1-2. Authentication > Providers

**Google**
1. Google Cloud Console → OAuth 2.0 클라이언트 ID 생성
2. 승인된 리다이렉트 URI: `https://<project-ref>.supabase.co/auth/v1/callback`
3. Supabase 대시보드 > Authentication > Providers > Google → Client ID / Client Secret 입력 후 Enable

**Kakao**
1. Kakao Developers → 애플리케이션 생성
2. 제품 설정 > 카카오 로그인 활성화
3. 동의항목: 닉네임, 프로필 이미지, 카카오계정(이메일)
4. Redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
5. Supabase 대시보드 > Authentication > Providers > Kakao → REST API 키 입력 후 Enable

### 1-3. Authentication > URL Configuration

```
Site URL:      https://your-domain.com

Redirect URLs:
  http://localhost:3000/auth/callback
  https://your-domain.com/auth/callback
```

---

## 2. 파일 구조 변경

### 새로 생성

```
src/
├── middleware.ts                      # 세션 갱신 + 라우트 보호
├── lib/
│   └── supabase/
│       ├── client.ts                  # 브라우저용 클라이언트 팩토리
│       └── server.ts                  # 서버용 클라이언트 팩토리 (쿠키 기반)
├── app/
│   └── auth/
│       ├── login/
│       │   ├── page.tsx               # 로그인 페이지 (서버 컴포넌트)
│       │   └── LoginForm.tsx          # 로그인 폼 (클라이언트 컴포넌트)
│       └── callback/
│           └── route.ts               # OAuth 코드 교환 Route Handler
└── components/
    └── UserMenu.tsx                   # 유저 아바타 + 로그아웃 바텀시트
```

### 수정

| 파일 | 변경 내용 |
|------|-----------|
| `src/types/index.ts` | `RunningRecord`에 `user_id?: string \| null` 추가 |
| `src/lib/supabase.ts` | 싱글턴 클라이언트 → `createBrowserClient` 교체; `saveRunningRecord`에 `userId` 파라미터 추가 |
| `src/app/history/page.tsx` | `createServerClient`(server.ts)로 교체 + `user_id` 필터 쿼리 |
| `src/app/result/page.tsx` | `getUser()`로 uid 조회 후 `saveRunningRecord(record, user.id)` 호출 |
| `src/app/page.tsx` | 헤더 버튼 그룹 끝에 `<UserMenu />` 추가 |
| `src/components/DeleteRecordButton.tsx` | `createBrowserClient`(client.ts)로 교체 |
| `src/components/EditableMemo.tsx` | `createBrowserClient`(client.ts)로 교체 |

---

## 3. 핵심 구현 상세

### middleware.ts — 라우트 보호

```
공개 경로: /auth/login, /auth/callback
보호 경로: /, /running, /result, /history (나머지 전부)

동작 흐름:
  1. createServerClient(@supabase/ssr)로 쿠키에서 세션 갱신
  2. supabase.auth.getUser() 호출  ← getSession() 금지 (보안 취약)
  3. user 없음 + 보호 경로 → redirect /auth/login
  4. user 있음 + /auth/login    → redirect /
  5. 갱신된 쿠키가 response에 포함되도록 supabaseResponse 반환
```

**matcher (SW/정적 에셋 반드시 제외)**
```
/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|workbox-.*\.js).*)
```

### lib/supabase/client.ts

```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

### lib/supabase/server.ts

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(URL, ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => list.forEach(({ name, value, options }) =>
        cookieStore.set(name, value, options)
      ),
    },
  });
}
```

### auth/callback/route.ts — OAuth 콜백

```
GET /auth/callback?code=...&next=...
  → supabase.auth.exchangeCodeForSession(code)
  → 성공: redirect to `next` or /
  → 실패: redirect /auth/login?error=auth_failed
```

### 로그인 페이지 UI

```
┌──────────────────────────────────┐
│   (safe-area 상단 여백)           │
│                                  │
│   [Run River 아이콘]              │
│   Run River                      │
│   GPS 러닝 트래커                 │
│                                  │
│   ┌──────────────────────────┐   │
│   │  G  Google로 계속하기    │   │  ← var(--c-surface) 카드
│   └──────────────────────────┘   │
│   ┌──────────────────────────┐   │
│   │  K  카카오로 계속하기    │   │  ← #FEE500 배경
│   └──────────────────────────┘   │
│                                  │
│   ──────── 또는 이메일로 ───────  │
│                                  │
│   [이메일 입력 필드]              │
│   [비밀번호 입력 필드]            │
│   [로그인 버튼]                   │
│                                  │
│   계정이 없으신가요? [회원가입]    │  ← 토글
│                                  │
│   (에러 메시지 — searchParams)    │
└──────────────────────────────────┘
```

- 기존 CSS 변수(`--c-surface`, `--c-toss-blue` 등) + `card`, `glass` 클래스 그대로 활용
- OAuth: `supabase.auth.signInWithOAuth({ provider, options: { redirectTo: origin + "/auth/callback" } })`
- 이메일: `signInWithPassword()` / `signUp()` 동일 폼에서 토글

### UserMenu.tsx — 유저 메뉴

- **위치**: `page.tsx` 헤더 `<div className="flex items-center gap-2">` 마지막
- **버튼**: `glass rounded-2xl p-2.5` — OAuth 아바타 이미지 or 이메일 첫 글자 이니셜
- **탭하면**: 딤드 배경 + 바텀시트 (기존 iOS 설치 안내 모달과 동일 패턴)
- **표시 정보**: 이름(`user_metadata.full_name`) + 이메일
- **로그아웃**: `supabase.auth.signOut()` → `router.push("/auth/login")`
- **Kakao 이메일 미동의 fallback**: `user.email || user.user_metadata?.name || "사용자"`

---

## 4. 주의사항

### PWA OAuth 리다이렉트
iOS 홈 화면 추가(standalone) 상태에서 OAuth 팝업 불가. `signInWithOAuth` 기본값(리다이렉트 방식)을 그대로 사용하면 안정적으로 동작한다. `/auth/callback`이 빠르게 처리되어 앱으로 즉시 복귀하는 것이 최선의 UX.

### `getUser()` vs `getSession()`
서버 사이드에서는 반드시 `getUser()`를 사용한다. `getSession()`은 쿠키의 JWT를 파싱할 뿐 서버 검증을 하지 않아 보안상 취약하다. (Supabase 공식 권고)

### history/page.tsx 서버 컴포넌트
RLS가 `auth.uid()`를 인식하려면 반드시 `@supabase/ssr`의 `createServerClient`를 사용해야 한다. 기존 `createClient(@supabase/supabase-js)`를 유지하면 `auth.uid() = NULL`로 처리되어 RLS가 모든 조회를 차단한다.

### Service Worker 충돌
`@ducanh2912/next-pwa`가 생성하는 `sw.js`, `workbox-*.js`를 middleware matcher에서 반드시 제외하지 않으면 Service Worker 등록이 실패한다.

### 기존 NULL 기록
RLS 정책(`auth.uid() = user_id`)에 의해 NULL 행은 어떤 유저도 접근 불가 — 별도 처리 없이 자동 격리된다. 특정 계정에 귀속시키려면 Supabase SQL Editor에서 수동 `UPDATE` 실행.

---

## 5. 검증 체크리스트

- [ ] 비로그인 상태로 `/` 접근 → `/auth/login` 리다이렉트
- [ ] Google 로그인 → OAuth 콜백 → `/` 복귀
- [ ] Kakao 로그인 → OAuth 콜백 → `/` 복귀
- [ ] 이메일 회원가입 → 이메일 인증 → 로그인
- [ ] 러닝 완료 후 저장 → Supabase 대시보드에서 `user_id` 채워짐 확인
- [ ] A 계정과 B 계정의 history가 각각 본인 기록만 표시
- [ ] PWA 홈 화면 추가 후 Google 로그인 → 앱으로 복귀 확인
- [ ] 로그아웃 → `/auth/login` 리다이렉트
- [ ] 세션 만료 후 클라이언트 요청 → 로그인 페이지로 유도

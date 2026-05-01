# TanStack Query 학습 가이드
> Run River 프로젝트 코드로 배우는 실전 예시

---

## 0. 왜 TanStack Query가 필요한가?

axios(또는 Supabase)로만 데이터를 가져오면 이걸 **직접 다 짜야** 한다:

```typescript
// ❌ 지금 방식 — 매번 이 패턴을 반복
const [records, setRecords] = useState<RunningRecord[]>([]);
const [loading, setLoading]  = useState(true);
const [error, setError]      = useState("");

useEffect(() => {
  setLoading(true);
  getRunningHistory()
    .then(setRecords)
    .catch(e => setError(e.message))
    .finally(() => setLoading(false));
}, []);

// 삭제 후 목록 갱신? → getRunningHistory() 또 호출
// 다른 페이지에서 같은 데이터? → 또 fetch
// 탭 전환 후 돌아왔을 때 최신 데이터? → 직접 구현
```

TanStack Query가 이걸 **자동으로** 처리한다:
- 로딩/에러 상태 관리
- 중복 요청 제거
- 자동 캐싱
- 뮤테이션 후 자동 리페치
- 포커스 되돌아올 때 자동 갱신

---

## 1. 설치 & 기본 설정

```bash
npm install @tanstack/react-query
npm install @tanstack/react-query-devtools  # 개발용
```

### QueryClientProvider 설정 (Next.js App Router)

```typescript
// src/providers/QueryProvider.tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  // useState로 감싸야 서버/클라이언트 인스턴스가 분리됨
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60,      // 1분 — 같은 데이터를 1분 내 재요청 시 캐시 사용
        gcTime:    1000 * 60 * 5,  // 5분 — 사용 안 하는 캐시 보관 기간
        retry: 1,                  // 실패 시 1번 재시도
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

```typescript
// src/app/layout.tsx — Provider 등록
import QueryProvider from "@/providers/QueryProvider";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <QueryProvider>
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}
```

---

## 2. useQuery — 데이터 읽기

axios로 치면 `GET` 요청.

### 기본 구조

```typescript
const { data, isPending, isError, error } = useQuery({
  queryKey: ["고유한 키"],   // 캐시 식별자 (배열)
  queryFn: () => 비동기함수(), // 실제 fetch 함수
});
```

### Run River 적용: 활동 기록 목록 가져오기

```typescript
// ❌ 기존 방식 (history/page.tsx — 서버 컴포넌트)
const records = await getRunningHistory();

// ✅ TanStack Query 방식 (클라이언트 컴포넌트)
import { useQuery } from "@tanstack/react-query";
import { getRunningHistory } from "@/lib/supabase";

function HistoryList() {
  const {
    data: records = [],   // 기본값 설정
    isPending,            // 최초 로딩 중
    isError,
    error,
  } = useQuery({
    queryKey: ["running-records"],       // 이 키로 캐시 저장
    queryFn: getRunningHistory,          // () => getRunningHistory() 와 동일
  });

  if (isPending) return <p>불러오는 중...</p>;
  if (isError)   return <p>에러: {error.message}</p>;

  return records.map(r => <RecordCard key={r.id} record={r} />);
}
```

### queryKey 이해하기

캐시를 구분하는 **고유 ID**. 같은 키 = 같은 캐시.

```typescript
// 단순 키
queryKey: ["running-records"]

// 파라미터 포함 (키가 다르면 별도 캐시)
queryKey: ["running-records", { type: "running" }]
queryKey: ["running-records", userId]

// 이 프로젝트에서 특정 날짜 기록만 가져올 때
queryKey: ["running-records", "2025-01-01"]
```

---

## 3. useMutation — 데이터 변경

axios로 치면 `POST` / `PATCH` / `DELETE` 요청.

### 기본 구조

```typescript
const { mutate, isPending } = useMutation({
  mutationFn: (변수) => 비동기함수(변수),
  onSuccess: (data) => { /* 성공 후 처리 */ },
  onError:   (error) => { /* 실패 후 처리 */ },
});

// 호출
mutate(전달할_데이터);
```

### Run River 적용 1: 기록 삭제

```typescript
// src/components/DeleteRecordButton.tsx

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteRunningRecord } from "@/lib/supabase";

function DeleteRecordButton({ id }: { id: string }) {
  const queryClient = useQueryClient();  // 캐시 제어용

  const { mutate: deleteRecord, isPending } = useMutation({
    mutationFn: (recordId: string) => deleteRunningRecord(recordId),

    onSuccess: () => {
      // ✨ 핵심: 삭제 성공 → "running-records" 캐시 무효화 → 자동 리페치
      queryClient.invalidateQueries({ queryKey: ["running-records"] });
    },

    onError: (error) => {
      alert("삭제 실패: " + error.message);
    },
  });

  return (
    <button
      onClick={() => deleteRecord(id)}
      disabled={isPending}
    >
      {isPending ? "삭제 중..." : "삭제"}
    </button>
  );
}
```

### Run River 적용 2: 메모 수정

```typescript
// src/components/EditableMemo.tsx

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateRunningMemo } from "@/lib/supabase";

function EditableMemo({ id, initialMemo }: { id: string; initialMemo: string }) {
  const [memo, setMemo] = useState(initialMemo);
  const queryClient = useQueryClient();

  const { mutate: saveMemo, isPending } = useMutation({
    mutationFn: ({ id, memo }: { id: string; memo: string | null }) =>
      updateRunningMemo(id, memo),

    // Optimistic Update — 서버 응답 전에 UI 먼저 업데이트
    onMutate: async ({ memo }) => {
      // 진행 중인 리페치 취소 (충돌 방지)
      await queryClient.cancelQueries({ queryKey: ["running-records"] });

      // 현재 캐시 저장 (롤백용)
      const previous = queryClient.getQueryData(["running-records"]);

      // 캐시 즉시 업데이트
      queryClient.setQueryData(["running-records"], (old: RunningRecord[]) =>
        old.map(r => r.id === id ? { ...r, memo } : r)
      );

      return { previous };  // onError에서 롤백에 사용
    },

    onError: (err, _, context) => {
      // 실패 시 이전 상태로 롤백
      queryClient.setQueryData(["running-records"], context?.previous);
    },

    onSettled: () => {
      // 성공/실패 관계없이 서버와 동기화
      queryClient.invalidateQueries({ queryKey: ["running-records"] });
    },
  });

  return (
    <textarea
      value={memo}
      onChange={e => setMemo(e.target.value)}
      onBlur={() => saveMemo({ id, memo: memo || null })}
    />
  );
}
```

### Run River 적용 3: 러닝 기록 저장 (result 페이지)

```typescript
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { saveRunningRecord } from "@/lib/supabase";

function ResultPage() {
  const queryClient = useQueryClient();
  const router = useRouter();

  const { mutate: save, isPending } = useMutation({
    mutationFn: saveRunningRecord,

    onSuccess: () => {
      // 저장 성공 → 기록 목록 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ["running-records"] });
      router.push("/history");
    },
  });

  const handleSave = () => {
    save({
      start_point: result.startPoint,
      end_point:   result.endPoint,
      distance_km: result.distance,
      duration_seconds: result.duration,
      pace:        result.pace,
      activity_type: result.activityType,
    });
  };

  return <button onClick={handleSave} disabled={isPending}>저장</button>;
}
```

---

## 4. invalidateQueries vs setQueryData

| 방법 | 동작 | 언제 사용 |
|------|------|-----------|
| `invalidateQueries` | 캐시를 "오래됨" 표시 → 자동 리페치 | 서버 응답이 중요할 때 (기본) |
| `setQueryData` | 캐시를 직접 수동 업데이트 | Optimistic Update (즉각적인 UI 반응) |

```typescript
const queryClient = useQueryClient();

// 방법 1: 서버에서 다시 가져오기
queryClient.invalidateQueries({ queryKey: ["running-records"] });

// 방법 2: 캐시 직접 수정 (삭제 후 리스트에서 제거)
queryClient.setQueryData(["running-records"], (old: RunningRecord[]) =>
  old.filter(r => r.id !== deletedId)
);
```

---

## 5. staleTime & gcTime

```
요청 → 데이터 도착 → [fresh 상태] → staleTime 지남 → [stale 상태] → 리페치
                                                           ↓ 컴포넌트 언마운트
                                              gcTime 지남 → 캐시 삭제
```

```typescript
useQuery({
  queryKey: ["running-records"],
  queryFn: getRunningHistory,

  staleTime: 1000 * 60,      // 1분: 1분 내 재방문 시 fetch 안 함 (캐시 사용)
  gcTime:    1000 * 60 * 10, // 10분: 화면에서 사라진 후 10분간 캐시 유지
  refetchOnWindowFocus: true, // 탭 포커스 시 자동 갱신 (기본값 true)
});
```

---

## 6. 커스텀 훅으로 분리 (권장 패턴)

쿼리 로직을 컴포넌트 밖으로 빼두면 재사용 + 테스트가 쉽다.

```typescript
// src/hooks/useRunningRecords.ts

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getRunningHistory,
  deleteRunningRecord,
  updateRunningMemo,
  saveRunningRecord,
} from "@/lib/supabase";

const QUERY_KEY = ["running-records"] as const;

// 목록 조회
export function useRunningRecords() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: getRunningHistory,
    staleTime: 1000 * 60,
  });
}

// 삭제
export function useDeleteRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteRunningRecord,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

// 메모 수정
export function useUpdateMemo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, memo }: { id: string; memo: string | null }) =>
      updateRunningMemo(id, memo),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

// 기록 저장
export function useSaveRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveRunningRecord,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
```

```typescript
// 컴포넌트에서 사용
function HistoryPage() {
  const { data: records = [], isPending } = useRunningRecords();
  const { mutate: deleteRecord } = useDeleteRecord();

  if (isPending) return <Loading />;
  return records.map(r =>
    <RecordCard key={r.id} record={r} onDelete={() => deleteRecord(r.id)} />
  );
}
```

---

## 7. axios와 비교 요약

| 상황 | axios 방식 | TanStack Query |
|------|-----------|----------------|
| 데이터 fetch | `useEffect` + `useState` 직접 | `useQuery` |
| 로딩 상태 | `useState(false)` | `isPending` 자동 |
| 에러 처리 | `catch` + `useState` | `isError`, `error` 자동 |
| POST/DELETE | `axios.post()` 호출 | `useMutation` |
| 삭제 후 목록 갱신 | 수동으로 다시 fetch | `invalidateQueries` |
| 캐싱 | 없음 | 자동 |
| 중복 요청 방지 | 없음 | 자동 |
| 탭 복귀 시 갱신 | 없음 | `refetchOnWindowFocus` |

---

## 핵심 요약

```
useQuery       → 읽기 (GET)
useMutation    → 쓰기/수정/삭제 (POST/PATCH/DELETE)
queryKey       → 캐시 식별자 (배열, 파라미터 포함 가능)
invalidateQueries → 뮤테이션 후 캐시 무효화 → 자동 리페치
setQueryData   → 낙관적 업데이트 (즉각 UI 반응)
staleTime      → 이 시간 내 재요청은 캐시 사용
```

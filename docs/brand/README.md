# Run River 브랜드

## 심볼

출발점(주황 점)에서 시작한 GPS 경로 한 줄이 8° 기울어진 R을 그린다.
경로를 따라 읽는다: ① 출발 → ② 오르막(기둥) → ③ 회전(둥근 모서리·볼) → ④ 열린 틈(볼이 기둥에 닿지 않음) → ⑤ 런아웃(머리핀처럼 꺾여 오른쪽 아래로).

- 탐색한 방향: A 스위치백 트레일(작은 크기에서 S로 읽혀 탈락), B 보폭+봉우리(흔한 삼각형 조합이라 탈락), C 경로 R(선택)
- 100단위 격자. 경로 `M30 80 V33 A13 13 0 0 1 43 20 H55 A17 17 0 0 1 55 54 H50 L74 84`, 선 굵기 12.5, `translate(53.5 49.2) scale(.8) skewX(-8) translate(-52 -52)`, 점 (32.75, 71.6) r 8.8
- 실측 외곽 x 23.9–76.4, y 18.6–80.4 (점의 무게를 감안해 오른쪽으로 1 단위 광학 보정)

## 워드마크

Pretendard Variable wght 700을 8° 기울여 윤곽선으로 변환. 글자 높이는 심볼 높이의 56%, 심볼과 세로 중앙 정렬.
`python3 docs/brand/generate_brand.py`로 다시 만든다(`pip install fonttools brotli` 필요).

## 컬러

| 이름 | HEX | 용도 |
|---|---|---|
| River Navy | `#16294A` | 아이콘 바탕, 라이트 배경의 심볼·워드마크 |
| Trailhead Orange | `#F25C1F` | 출발점에만 |
| Mist | `#F4F6F9` | 라이트 배경 |
| Night | `#0B1220` | 다크 배경 |
| Slate | `#5B6B82` | 보조 글자 |

대비: White/Navy 14.48, Navy/Mist 13.38, Orange/Navy 4.36, Orange/Night 5.64, Orange/Mist 3.07, Slate/Mist 5.01.

## 파일

| 파일 | 용도 |
|---|---|
| `symbol.svg` / `symbol-on-dark.svg` | 라이트 / 다크 배경 심볼 |
| `symbol-mono-black.svg` / `symbol-mono-white.svg` | 단색 |
| `lockup*.svg` | 가로 워드마크 (같은 네 가지) |
| `app-icon.svg` | 앱 아이콘 원본 (PNG는 `npm run icons`) |
| `public/brand/wordmark.svg` | 앱 안 워드마크 (CSS mask) |

## 규칙

- 사방 여백은 출발점 지름 이상. 심볼 최소 16px, 가로 워드마크 최소 96px 너비
- 볼을 닫거나, 기울기를 없애거나, 점 색을 주황·흑·백 외로 바꾸지 않는다
- 주황은 넓은 면이나 글자에 쓰지 않는다. 그림자·그라데이션·외곽선 효과 금지
- 출시·상표 출원 전 KIPRIS·USPTO·WIPO 도형 상표 검색으로 유사 로고 확인 필요 (아직 하지 않음)

# 오프라인 산행 지도

## 사용

홈의 **오프라인 지도 준비** 또는 설정에서 `/maps`로 이동한다. 북한산 주변 지도를 저장하거나 Protomaps 스키마의 PMTiles v3 MVT 파일(최대 200MB)을 가져온다. 저장한 지도 중 사용할 지도를 선택한다. Android 운동 화면은 선택한 지도 위에 현재 위치·이동 경로·준비한 코스를 표시한다. 지도 영역 밖은 별도로 저장해야 한다.

지도 준비 화면과 글꼴은 웹 서비스 워커에 포함한다. 지역 지도는 서비스 워커가 자동 다운로드하지 않는다. Android에서는 APK에도 지역 지도를 넣지 않고 사용자가 명시적으로 저장할 때 운영 사이트에서 다운로드한다. 운영 사이트 주소는 `NEXT_PUBLIC_SITE_URL`로 지정한다.

Android는 앱 전용 파일에 지도를 저장하고 필요한 바이트 범위만 읽는다. 미완성 다운로드는 `.part` 파일로 분리하고 완료 후 원자적으로 이름을 바꾼다. 기본 지도는 SHA-256도 확인한다. 파일 가져오기는 Android 문서 선택기를 사용해 넓은 저장소 권한을 요구하지 않는다. 삭제는 지도만 지우며 SQLite 운동 기록은 건드리지 않는다. 다운로드 중단 후에는 처음부터 재시도하며 부분 다운로드 재개는 아직 지원하지 않는다.

웹은 IndexedDB에 지도 Blob을 저장한다. 브라우저 저장 공간 부족 시 오류를 표시하고 기존 지도를 유지한다. 영구 저장 권한을 최선으로 요청하지만 OS나 브라우저 데이터 정리에 의한 삭제까지 막지는 못한다.

MapLibre GL JS 6.18.0과 PMTiles 4.5.0을 사용한다. 지도 렌더링·PMTiles 인덱스·글꼴은 로컬에서 읽는다. MapLibre의 `font-faces`로 포함된 Noto Sans를 사용하고 한국어는 기기 글꼴을 활용한다. WebGL이 필요하다. 등고선·지형 음영·오프라인 경로 생성·재탐색은 아직 없다. 지도에는 OSM에 수록된 산길만 나타나며 통제·폐쇄의 실시간 상태를 보장하지 않는다.

## 기본 지도 출처와 재생성

`public/offline-maps/bukhansan.pmtiles`는 Protomaps 공개 빌드에서 잘라낸 지도이다.

- 원본: `https://build.protomaps.com/20261113.pmtiles`, Protomaps basemap 4.15.2
- 데이터 기준: 원본 메타데이터의 OSM replication time `2026-11-13T04:00:00Z`
- 영역: 경도 126.92~127.04, 위도 37.60~37.72, zoom 0~14
- 생성: go-pmtiles 1.31.2
- SHA-256: `0791c9747ec5eb2450541f01394feb37491050b88ff4415a1d4e7fd4de987189`

```text
pmtiles extract https://build.protomaps.com/20261113.pmtiles bukhansan.pmtiles --bbox=126.92,37.60,127.04,37.72 --maxzoom=14 --download-threads=2
pmtiles verify bukhansan.pmtiles
```

과거 일별 빌드는 삭제될 수 있다. 새 빌드로 교체할 때 파일과 코드의 SHA-256, 데이터 기준 날짜도 함께 갱신한다.

Protomaps Basemap은 OpenStreetMap 기반 ODbL Produced Work이다. 지도에 © OpenStreetMap · Protomaps와 출처 링크를 표시한다. 이 저장소는 Organic Maps의 소스나 바이너리 지도를 재배포하지 않는다. OSM 표준 타일 서버를 대량 다운로드하지 않는다.

- [Protomaps 다운로드와 데이터 조건](https://docs.protomaps.com/basemaps/downloads)
- [지역 추출 절차](https://docs.protomaps.com/guide/getting-started)
- [OpenStreetMap 저작권·출처](https://www.openstreetmap.org/copyright)
- 글꼴: [Noto Sans](https://github.com/notofonts/noto-fonts), SIL Open Font License 1.1. 라이선스는 `public/fonts/OFL.txt`에 포함했다.

## 검사

`node --test tests/maps-browser.test.mjs`는 모바일 정적 번들을 제공하면서 기본 지도를 한 번 저장한 후 지도 다운로드 서버와 외부 요청을 차단한다. 새로 연 화면에서 저장 지도 렌더링, 잘못된 파일 가져오기 시 기존 지도 보존, 삭제를 확인한다. Android `MapFilesTest`는 원자적 가져오기·검증 실패 정리·체크섬·범위 읽기·경로 이탈 방지를 확인한다. 실제 Android 파일 선택기·WebView GPU·기기 저장 공간 부족 검사는 별도로 필요하다.

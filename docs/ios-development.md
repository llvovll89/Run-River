# iPhone 개발과 검증

사용자의 실사용 기기는 iPhone이다. 하이킹은 iOS 네이티브 앱과 Safari를 구분해서 검증한다. Safari/홈 화면 웹 앱은 화면을 잠근 동안 GPS 기록을 보장하지 않는다.

## 앱 만들기

macOS와 Xcode 26 이상, Node 22 이상, XcodeGen이 필요하다. iOS 15 이상을 지원하며 CocoaPods 대신 Capacitor Swift Package Manager를 사용한다.

```sh
npm ci
npm run ios:sync
brew install xcodegen # 처음 한 번
cd ios/App && xcodegen generate && cd ../..
npm run ios:open
```

`ios/App/project.yml`은 앱·단위 테스트·UI 테스트 타깃의 원본이다. 네이티브 파일이나 테스트 타깃을 변경하면 XcodeGen으로 프로젝트를 다시 생성한다. 번들 UI는 기기에 포함되며 `server.url`로 웹 서버를 열지 않는다. 다운로드한 지도는 별도 앱 전용 파일에 보관한다.

실제 iPhone 설치는 Xcode에서 Signing Team을 선택하고 연결한 기기에 Run한다. TestFlight 배포에는 Apple Developer 서명과 App Store Connect 설정이 필요하다. 저장소·CI에 Apple 계정이나 인증서를 넣지 않는다. CI의 가짜 API 설정과 서명 없는 시뮬레이터 산출물은 iPhone 설치 파일이 아니다.

## 기록과 파일

- 사용자가 기록을 시작할 때 정확한 위치와 사용 중 위치 권한을 확인한다. Core Location의 background location mode로 진행 중인 기록을 이어간다. 시작 전에 위치 권한을 허용하고 정확한 위치를 켠다.
- 좌표·거리·시간은 SQLite 트랜잭션으로 저장한다. KMZ 코스 설정은 한 번만 저장한다. 화면의 타이머는 GPS 기록의 실행 주체가 아니다.
- 일시정지·종료 시 위치 업데이트를 멈춘다. 프로세스 종료 후에는 마지막 저장 지점에서 일시정지 상태로 복구한다. 종료되거나 GPS가 끊긴 구간의 거리를 추정해 더하지 않는다.
- PMTiles는 Files 선택기에서 가져오거나 HTTPS로 다운로드한다. 200MB 제한, 헤더·선택적 SHA-256 검증, 임시 파일 후 원자적 게시, 범위 읽기를 사용한다. 지도는 iCloud 백업 대상에서 제외하며 앱 삭제 시 함께 지워진다.
- KMZ/KML/GPX 코스는 앱 화면의 파일 입력에서 가져온다. 완성한 기록의 GPX는 Files 내보내기를 사용한다. 완료 기록은 화면 저장 성공 후에만 네이티브 저장소에서 정리한다.

## 자동 검증 범위

`.github/workflows/verify.yml`의 `ios` 작업에서 Xcode 26으로 실제 앱 코드를 빌드하고 iPhone Simulator에서 XCTest와 UI 테스트를 실행한다. GPS 필터·GPS 단절·일시정지 시간·프로세스 재생성 복구·완료 기록 정리·지도 파일 검증과 범위 읽기·정적 경로를 검증한다. UI 테스트는 번들 하이킹 화면과 네이티브 Files 선택기를 연다. WebKit 테스트는 외부 네트워크를 차단한 지도 재열기, KMZ 경로 선택과 보존, GPX 내보내기 및 iOS 브리지의 화면 흐름을 검사한다. 브라우저 테스트의 네이티브 브리지는 모의 구현이며 Swift 검증은 XCTest에서 별도로 수행한다.

## 실제 iPhone에서 남는 확인

시뮬레이터와 WebKit 검증만으로 실제 GPS 수신·화면 잠금·배터리 사용을 통과했다고 표현하지 않는다. 연결된 iPhone에서 아래 항목을 확인한 뒤 현장 사용 판단을 한다.

1. 온라인에서 지도와 KMZ를 저장하고 앱을 완전히 닫았다 다시 연다.
2. 비행기 모드에서 지도가 표시되는지 확인하고 야외에서 하이킹을 시작한다.
3. 화면 잠금 10분 이상 이동 후 좌표·시간·거리와 코스 표시를 확인한다.
4. 쉬는 동안 일시정지하고 재개해 쉬는 시간과 GPS 단절 구간이 거리로 합산되지 않는지 확인한다.
5. 종료·저장·앱 재시작 후 로컬 기록 및 Files의 GPX를 확인한다.
6. 권한 해제, 앱 강제 종료와 재시작, 저장 공간 부족 시 기존 기록이 남고 복구 상태가 명확한지 확인한다.

Windows 작업 환경에서는 실제 iPhone 연결과 Apple 서명을 대신할 수 없다. 실기기 테스트 완료 여부는 자동 CI 결과와 별개로 기록한다.

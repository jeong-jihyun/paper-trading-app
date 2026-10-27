# 모의투자 트레이더 (paper-trading-app)

모바일 앱 + 파이썬 데스크톱 프로그램

가상 자금 1억 원으로 주식을 사고파는 **연습용** 프로그램입니다. 대신증권 모바일트레이딩(CYBOS Touch)의 메뉴 구성(관심종목 · 현재가 · 주문 · 계좌정보 · 종목발굴/알림)을 참고했고, 같은 규칙으로 동작하는 두 가지를 함께 제공합니다.

| 구분 | 폴더 | 기술 | 데이터 |
|---|---|---|---|
| 모바일 앱 | `app/` | React Native(Expo) + TypeScript + Firebase | 공공데이터 시세(하루 1회) → Firestore |
| 데스크톱 프로그램 | `desktop/` | Python + tkinter(윈폼 스타일) | 내장 샘플 시세(기본) / 대신증권 CYBOS Plus(선택) |
| 시세 수집 | `scripts/` + `.github/workflows` | Node + GitHub Actions | 공공데이터포털 → Firestore |

> **모의투자이며 실제 거래가 아닙니다.** 모바일 앱의 시세는 금융위원회 주식시세정보(공공누리 4유형: 출처표시, **상업적 이용 금지**, 변경 금지)를 쓰므로 비상업 연습용으로만 사용하세요. 광고·유료화를 하려면 시세 데이터 소스를 바꿔야 합니다.

## 1. 데스크톱 프로그램 (가장 빨리 해 보기)

```bash
cd desktop
python main.py            # 모의투자 (Python 3.9+, 추가 설치 없음)
python -m unittest discover -s tests   # 테스트
```
- 처음 실행하면 샘플 시세 20종목, 가상 자금 1억 원으로 시작합니다. 내 계좌는 `~/.mock_trading/state.json`에 저장됩니다.
- 모의투자 연결에서는 시작할 때와 **새로고침(F5)할 때마다 샘플 시세가 ±0.5% 이내로 흔들립니다.** 지정가 체결·알림을 시험하기 위한 것이며 실제 시세가 아닙니다. "10초마다 자동 갱신"을 켜면 계속 움직입니다.
- 대신증권 CYBOS Plus 연결(`python main.py --cybos`)은 윈도우 + 관리자 권한 + CYBOS Plus 로그인이 필요합니다. 자세한 내용과 주의점은 `desktop/README.md`를 보세요.

## 2. 모바일 앱

### 준비물 (처음 하는 분 기준)
1. **Firebase 프로젝트 만들기**
   1. https://console.firebase.google.com 접속 → Google 계정 로그인 → **프로젝트 추가** 클릭 → 이름 입력 → 계속 (Google 애널리틱스는 꺼도 됩니다) → **프로젝트 만들기**.
   2. 왼쪽 메뉴 **빌드 → Authentication → 시작하기 → 로그인 방법 → 이메일/비밀번호 → 사용 설정 → 저장**.
   3. 왼쪽 메뉴 **빌드 → Firestore Database → 데이터베이스 만들기 → 프로덕션 모드로 시작 → 위치(asia-northeast3 서울) → 사용 설정**.
   4. Firestore의 **규칙** 탭에 이 저장소의 `firestore.rules` 내용을 붙여 넣고 **게시**.
   5. 프로젝트 설정(왼쪽 위 톱니바퀴) → **내 앱 → 웹(</>) 아이콘** → 앱 닉네임 입력 → **앱 등록** → 화면에 나오는 `firebaseConfig` 값을 복사해 둡니다.
2. **공공데이터포털 인증키**: https://www.data.go.kr 회원가입 → "금융위원회_주식시세정보" 검색 → **활용신청** → 승인 후 마이페이지에서 **일반 인증키(Decoding)** 복사.
3. **서비스 계정 키(시세 수집용)**: Firebase 프로젝트 설정 → **서비스 계정 → 새 비공개 키 생성** → 내려받은 JSON 파일 내용을 통째로 복사.

### 실행
```bash
cd app
cp .env.example .env      # 1-5에서 복사한 값을 채운다
npm install
npx expo start            # 폰에 Expo Go 앱을 깔고 QR 코드를 스캔
npm test                  # 계산 로직 테스트 (npx jest)
```

### 화면 미리보기 (Firebase 없이 데모 모드)
Firebase 설정 전에 화면과 주문 동작만 보고 싶을 때 쓰는 데모 모드입니다. 가짜 DB(`app/demo/`)와 샘플 시세를 쓰며 실제 앱 코드는 그대로입니다.
```bash
cd app
EXPO_PUBLIC_DEMO=1 EXPO_PUBLIC_FIREBASE_API_KEY=demo EXPO_PUBLIC_FIREBASE_PROJECT_ID=demo npx expo start --web
# 로그인 화면부터 보려면 주소 끝에 #login 을 붙여서 접속
```

### 웹으로 배포하기 (Vercel, 자동 배포)
GitHub에 올리면 Vercel이 자동으로 빌드·배포합니다. 설정은 한 번만 하면 됩니다.

| Vercel 프로젝트 설정 | 값 |
|---|---|
| Root Directory | `app` |
| Install Command | `npm install --legacy-peer-deps` |
| Build Command | `npx expo export --platform web --output-dir dist` |
| Output Directory | `dist` |
| Node.js Version | `22.x` |
| Environment Variables | `.env.example`의 `EXPO_PUBLIC_FIREBASE_*` 6개 (Firebase 웹 설정값, 공개용) |

공공데이터 인증키와 Firebase 관리자 키는 **웹 배포에 넣지 않습니다.** 시세 수집용으로 GitHub Secrets에만 등록합니다.

### 시세 자동 수집 (GitHub Actions)
1. 이 저장소를 GitHub에 올린 뒤 **Settings → Secrets and variables → Actions → New repository secret**.
2. `DATA_GO_KR_KEY` (공공데이터 인증키), `FIREBASE_SERVICE_ACCOUNT` (서비스 계정 JSON 전체)를 각각 등록.
3. **Actions 탭 → daily-prices → Run workflow**로 한 번 수동 실행해 보면 `market/KOSPI`, `market/KOSDAQ` 문서가 생깁니다. 이후 평일 저녁 6시(한국시간)에 자동 실행됩니다.
4. Firestore **인덱스** 탭에서 `firestore.indexes.json`의 두 항목(orders.status, alerts.active 컬렉션 그룹)을 만들어 주세요. (Firebase CLI가 있으면 `firebase deploy --only firestore:indexes`)

로컬에서 계산만 시험: `cd scripts && npm install && npm run collect:sample` (키·DB 없이 샘플 응답으로 실행)

## 3. 규칙 요약 (모의 체결)
- 시장가: 기준일 종가로 즉시 체결 · 지정가: 현재가로 바로 체결 가능하면 즉시, 아니면 대기 → 다음 시세 갱신 때 시가·고가·저가로 체결 여부 판단
- 수수료 0.015%, 매도 거래세 0.18%, 초기 자금 1억 원은 **가정값**입니다(`app/src/config.ts`, `desktop/trading_core.py`에서 변경). 실제 요율과 다를 수 있습니다.
- 평균단가는 이동평균, 예수금 부족·보유 수량 초과 매도는 거부

## 4. 알려진 한계
- 시세는 하루 1회 갱신(전일 종가 기준)이며 실시간 호가는 없습니다.
- 알림은 앱 안의 "받은 알림" 목록으로 표시됩니다(푸시 알림은 개발용 빌드가 필요해 이번 범위에서 제외).
- 모의투자라 체결 계산을 앱에서 하고 규칙은 "본인 계좌만 수정 가능"까지만 제한합니다. 실제 돈이 걸리는 서비스라면 서버에서 처리해야 합니다.
- 공공데이터 응답 필드명(`srtnCd`, `clpr` 등)은 공개 문서 기준이며, 실제 인증키로 첫 실행할 때 한 번 확인이 필요합니다.
- 모바일 앱은 웹 데모 모드로, 윈폼 프로그램은 리눅스 가상 화면(tkinter 8.6)에서 실행해 화면을 확인했습니다. 실제 안드로이드·아이폰 기기와 윈도우 PC, 그리고 실제 Firebase·공공데이터 연결은 아직 확인하지 못했습니다.

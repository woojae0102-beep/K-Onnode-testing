# ONNODE TV 연결 사용 설명서

누구나 따라 할 수 있는 **TV 연습실 연결** 가이드입니다.

---

## 한 줄 요약

| 기기 | 역할 |
|------|------|
| **TV** | 큰 화면 — 안무 영상, AI 코치, 내 모습, 피드백 |
| **스마트폰 / 노트북** | 카메라(댄스) 또는 마이크(보컬) |

TV 연결은 **선택**입니다. TV 없이도 폰·노트북만으로 연습할 수 있습니다.

---

## 연결 방법 (3단계)

### 1단계 — 모바일에서 TV 연결 시작

1. ONNODE 로그인
2. 왼쪽 메뉴 **💪 트레이닝** 선택
3. 기획사·댄스/보컬 선택 후 **트레이닝 시작**
4. 화면 **우측 상단 `📺 TV 연결`** 버튼 클릭
5. **「TV 연결 시작」** 버튼 클릭

### 2단계 — TV에서 주소 열기

TV 리모컨으로 **인터넷(브라우저)** 앱을 실행합니다.

| TV 종류 | 브라우저 앱 |
|---------|------------|
| 삼성 Smart TV | Internet (인터넷) |
| LG TV | 웹브라우저 |
| Google TV / Chromecast | Chrome |
| Apple TV | Safari |

주소창에 아래 주소를 입력합니다.

```
https://your-domain.com/tv
```

배포 주소 예: `https://onnode.ai/tv`

**또는** 모바일에 표시된 **QR 코드**를 TV에서 스캔합니다.

### 3단계 — 카메라 / 마이크 켜기

1. 모바일 앱에서 **「시작」** (또는 카메라 켜기) 버튼 탭
2. 카메라·마이크 **권한 허용**
3. 모바일에 **「TV 연결 완료」** 또는 **「STUDIO LIVE」** 표시되면 성공
4. TV 화면 오른쪽에 **내 모습**이 실시간으로 나타납니다

---

## TV 화면 구성 (댄스)

```
┌────────────────────┬────────────────────┐
│  AI 코치           │  내 카메라 (큰 화면) │
│  안무 시범 영상     │  + 동작 스켈레톤     │
│  점수 · 박자       │                    │
├────────────────────┴────────────────────┤
│  실시간 피드백 ("오른팔을 더 올리세요")   │
└─────────────────────────────────────────┘
```

연습 영상(유튜브)은 **모바일에서 불러온 뒤** TV 왼쪽에 표시됩니다.  
(모바일 → TV 연결 **전에** 유튜브 URL을 불러 두면 편합니다.)

---

## 연결 방법 2가지

### 방법 A — 모바일이 코드 생성 (권장)

1. 모바일: `TV 연결 시작` → QR·코드 표시
2. TV: QR 스캔 또는 `your-domain.com/tv?code=123456` 접속

### 방법 B — TV가 코드 생성

1. TV: `your-domain.com/tv` 접속 → 화면에 **6자리 코드** 표시
2. 모바일: `TV 연결` → 「TV에 코드가 보이면 입력」→ 6자리 입력 → 연결

---

## 자주 묻는 질문

### TV 없이 연습할 수 있나요?

**네.** `📺 TV 연결`을 누르지 않으면 폰/노트북 한 화면에서 영상+카메라로 연습합니다.

### iPhone / 갤럭시 / 노트북 모두 되나요?

**네.** 카메라·마이크가 있는 기기면 됩니다. TV는 브라우저만 있으면 됩니다.

### AirPlay·스마트뷰로도 되나요?

앱 내 **WebRTC 연결**이 가장 정확합니다 (왼쪽 안무 / 오른쪽 내 모습 분할).  
AirPlay·HDMI 미러링은 화면 전체를 TV에 띄우는 보조 방법입니다.

### 연결이 안 될 때

1. **같은 Wi-Fi** — 폰과 TV가 동일 네트워크인지 확인
2. **Firebase 설정** — 관리자: Authentication → **익명 로그인** 활성화
3. **Firestore 규칙** — `tvSessions` 읽기/쓰기 허용 (아래 예시 참고)
4. **카메라 권한** — 모바일 브라우저 설정에서 카메라 허용
5. **TV 주소** — `https://` 포함 정확한 URL 입력

---

## 관리자 설정 (최초 1회)

### Firebase Authentication

1. [Firebase Console](https://console.firebase.google.com) → Authentication
2. Sign-in method → **익명(Anonymous)** → 사용 설정

### Firestore 보안 규칙 (예시)

프로젝트 루트 `firestore.rules.example` 참고. 핵심 경로:

```
artifacts/{appId}/public/data/tvSessions/{code}
artifacts/{appId}/public/data/sessions/{code}/webrtc/...
```

### 환경 변수 (`.env`)

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_APP_ID=...
```

NAT·방화벽 환경에서는 TURN 서버 추가:

```
VITE_WEBRTC_TURN_URLS=turn:...
VITE_WEBRTC_TURN_USERNAME=...
VITE_WEBRTC_TURN_CREDENTIAL=...
```

---

## 기술 구조 (참고)

- **Firestore** — 점수, 피드백, 스켈레톤, 영상 URL 동기화
- **WebRTC** — 모바일 카메라 → TV 실시간 전송
- **MediaPipe** — 모바일에서 포즈 분석 → TV에 스켈레톤 표시

상세 아키텍처: `docs/STUDIO_MODE_ARCHITECTURE.md`

---

## 문의

연결 오류 메시지를 스크린샷과 함께 공유해 주시면 빠르게 확인할 수 있습니다.

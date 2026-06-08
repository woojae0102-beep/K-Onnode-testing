# ONNODE STUDIO MODE — Architecture

## 1. Product Goal

**TV = 연습실 · Mobile = 카메라**

- 10초 이내 연결 (QR fallback)
- 비기술 사용자 3단계 이내 설정
- TV 미연결 시 폰/노트북 단독 연습 유지

## 2. UX Flow (3 Steps)

| Step | Mobile | TV |
|------|--------|-----|
| 1 | `TV 연결` 탭 → 자동 TV 검색 (1.8s) | `?tv=join` 접속 → 6자리 코드 표시 |
| 2 | 기기 선택 또는 QR 연결 | 코드 대기 |
| 3 | 카메라/마이크 ON → STUDIO LIVE | 코치·스켈레톤·피드백 표시 |

## 3. Network Architecture (Recommended)

```
Mobile Camera
    → MediaPipe (local)
    → Pose + Scores + Feedback
    → Firestore tvSessions/{code}  (state sync, 400ms)
    → WebRTC P2P video/audio       (low-latency mirror)
    → TV Studio Display
```

| Layer | Technology | Role |
|-------|------------|------|
| Signaling | Firestore | WebRTC offer/answer/ICE |
| State sync | Firestore | scores, feedback, pose, playback |
| Media | WebRTC | camera stream to TV |
| Analysis | MediaPipe (mobile) | pose — TV receives skeleton JSON |
| Auth (TV) | Firebase Anonymous | TV browser without login UI |

**Why not WebSocket-only?** Requires always-on server, harder NAT traversal.
**Why not WebRTC-only?** Pose/feedback JSON over data channel is possible but Firestore is simpler for MVP and reconnection.
**Scale path:** Add TURN (Twilio/Xirsys), Redis pub/sub for state, dedicated `studio.onnode.ai` edge.

## 4. React Component Tree

```
TVModeView
└── TVLayout
    ├── StudioConnectModal      (TV 연결 UX)
    ├── StudioMobileController  (TV 연결 후 — 카메라 only)
    └── [solo] TVReferencePanel + UserCameraPanel

?tv=CODE → TVDisplayBootstrap
└── StudioTVDisplay
    ├── AI Coach card
    ├── YouTubeTVPlayer (reference)
    ├── StudioSkeletonCanvas
    └── Feedback bar
```

## 5. Session Schema (`tvSessions/{code}`)

```json
{
  "code": "482910",
  "status": "live|waiting|ended",
  "studioMode": true,
  "agency": "hybe",
  "mode": "dance",
  "referenceVideoUrl": "...",
  "songTitle": "...",
  "currentTime": 12.4,
  "score": 87,
  "scores": { "rhythm": 91, "posture": 85 },
  "beatAccuracy": 91,
  "feedback": "오른팔을 10도 더 올리세요",
  "feedbackItems": [],
  "poseSnapshot": { "joints": {}, "jointAccuracies": {} },
  "practiceStep": 2,
  "practiceStepLabel": "기본 동작",
  "coachName": "...",
  "isPaused": false
}
```

## 6. Cast Integration Roadmap

| Platform | MVP | Production |
|----------|-----|------------|
| QR + Browser TV | ✅ | ✅ |
| Presentation API | ✅ partial | ✅ |
| Chromecast SDK | UI stub | Custom receiver app |
| AirPlay | Manual mirror guide | Native iOS wrapper |
| Samsung/LG | QR to TV browser | Smart TV hosted app |

## 7. MVP vs Scale

### MVP (current, ~2–3 weeks)
- Firestore + WebRTC + QR
- Studio TV layout
- Mobile controller mode
- Anonymous TV auth

### Scale (3–6 months)
- Dedicated TURN fleet
- Smart TV hosted apps (Tizen/webOS)
- Chromecast custom receiver
- Edge WebSocket for sub-100ms feedback
- Multi-room studio sessions

## 8. Cost Estimate (monthly, 10k MAU)

| Item | MVP | Scale |
|------|-----|-------|
| Firebase | $50–200 | $500–2k |
| TURN | $0–100 | $300–1k |
| CDN (MediaPipe wasm) | incl. | $100–500 |
| **Total** | **~$100–400** | **~$1k–4k** |

## 9. Implementation Order

1. ✅ Studio session + Firestore sync
2. ✅ Studio TV UI + Mobile controller
3. ✅ Connect modal + QR + code join
4. TURN env for production NAT
5. Chromecast receiver app
6. Smart TV store apps

## 10. Files

- `src/hooks/useStudioSession.ts`
- `src/hooks/useStudioDeviceScan.ts`
- `src/components/studio/StudioConnectModal.tsx`
- `src/components/studio/StudioMobileController.tsx`
- `src/views/StudioTVDisplay.tsx`
- `src/styles/studio-mode.css`

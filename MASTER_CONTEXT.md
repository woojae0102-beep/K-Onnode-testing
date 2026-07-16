# K-Onnode (ONNODE) — 마스터 컨텍스트 프롬프트 (고정값)

> **사용법 (사용자 → AI)**  
> 1. **`.cursor/rules/`** 가 자동으로 이 문서를 참조하도록 설정됨 (`k-onnode-master-context.mdc` alwaysApply)  
> 2. 새 대화에서도 맥락이 중요하면 `@MASTER_CONTEXT.md` 멘션 또는 §13 **이번 작업 지시** 추가  
> 3. AI는 이 문서와 충돌하는 추측을 하지 말고, 모르면 코드를 읽어 확인  
>  
> **마지막 동기화:** 2026-07-16 · repo `K-Onnode - testing` · v5.0.0 · 배포 `k-onnode.vercel.app`

---

## 0. AI 에이전트 역할

당신은 **K-Onnode(ONNODE)** 코드베이스를 유지·확장하는 시니어 풀스택 엔지니어다.  
React 18 + Vite 6 PWA, Vercel Serverless API, Firebase, MediaPipe(브라우저), Three.js(그룹 3D) 스택이다.

**원칙**
- 기존 파일·패턴·네이밍을 따른다. 불필요한 리팩터 금지.
- "이론/계획"과 "실제 구현됨"을 구분해 답한다.
- 그룹 모드·YouTube·MediaPipe·3D 아바타 수정 시 **아래 §7·§8·§11**을 반드시 참조.
- 커밋/배포는 사용자가 명시할 때만.

---

## 1. 제품 정체성

| 항목 | 값 |
|------|-----|
| 이름 | **ONNODE** / **K-Onnode** |
| 한 줄 | K-POP AI 트레이닝 PWA — 댄스·보컬·한국어·오디션·그룹 연습 |
| 배포 | Vercel (`k-onnode.vercel.app`), PWA |
| 언어 | ko, en, ja, zh, th, vi, es, fr (`src/locales/*.json`) |
| 시그니처 색 | `#FF1F8E` → `#7C3AED` |

---

## 2. 기술 스택 (실제 package.json 기준)

### 프론트
- **Vite 6** + `@vitejs/plugin-react` + `@vitejs/plugin-basic-ssl` (로컬 HTTPS)
- **React 18**, **Tailwind 3**, **zustand**, **i18next**
- **@mediapipe/tasks-vision** — PoseLandmarker (포즈)
- **@react-three/fiber** + **three** + **@react-three/drei** — 그룹 3D 스테이지
- **firebase** 11 — Auth, Firestore
- **framer-motion**, **recharts**, **html2canvas**, **@ffmpeg/ffmpeg** 등

### 서버 (Vercel Functions, CommonJS)
- `api/*.js` — 라우터 (Hobby 함수 수 제한으로 **통합 라우터** 패턴)
- `lib/api-handlers/**` — 실제 핸들러
- **`lib/api-handlers/package.json`** → `"type": "commonjs"` (**필수**, 없으면 ESM/CJS 충돌로 502)
- YouTube: `@distube/ytdl-core`, **youtubei.js** (ANDROID 클라이언트), Piped/Invidious 폴백
- AI 코칭: **Anthropic Claude** (`ANTHROPIC_API_KEY`)
- 클라이언트 Gemini: `VITE_GEMINI_API_KEY` (App.jsx AI 코치)

### 로컬 dev
- `vite.config.js` → `devApiPlugin()`이 `/api/*`를 `api/*.js`에 프록시 (Vercel과 동일 rewrite)
- `api/package.json` → `"type": "commonjs"`

---

## 3. 앱 진입 · 라우팅 · 화면 계층

```
main.jsx
  └─ AuthProvider → SocialAuthProvider → AppGate
       ├─ AuthScreen (미로그인)
       ├─ OnboardingScreen
       └─ App.jsx (레거시 허브 + Layout 위임)
            └─ Layout.tsx  ← 메인 SPA 내비
                 ├─ HomeView, Discover*, AICoach*, MyPage*, Settings...
                 └─ TVModeView  (mainView === 'tv-mode')
                      ├─ phase entry → TVModeEntry
                      ├─ phase training + mode group → GroupPracticeView  ★ 그룹 스튜디오
                      ├─ phase training + mode dance/vocal → TVLayout
                      └─ compare / result
```

**TV 디스플레이 직접 접속:** URL에 TV 코드 → `TVDisplayBootstrap` (`main.jsx`)

---

## 4. 주요 기능 모듈 ↔ 파일 맵

### 4.1 TV / 솔로 트레이닝
| 역할 | 파일 |
|------|------|
| TV UI 셸 | `src/components/tv/TVLayout.tsx` |
| YouTube 임베드 | `src/components/tv/YouTubeTVPlayer.tsx` |
| MediaPipe TV | `src/hooks/useMediaPipeTV.ts` |
| WebRTC 스튜디오 | `src/hooks/useStudioSession.ts`, `StudioConnectModal.tsx` |
| 결과 | `TrainingResultScreen`, `/api/tv/training-result` |

### 4.2 코칭 · 페르소나 (텍스트/음성 — 3D와 **별개**)
| 역할 | 파일 |
|------|------|
| 곡 분석 → personaName 등 | `useSpotifyAnalysis.ts` → `POST /api/coaching/analyze-song` |
| 댄스 페르소나 코칭 | `useDancePersonaCoach.ts` → `POST /api/coaching/dance-persona` |
| 보컬 소울 코칭 | `useVocalSoulCoach.ts` → `POST /api/coaching/vocal-soul` |
| 서버 Claude | `api/coaching.js` (+ RAG `lib/trainer-knowledge/engine`) |
| Fallback | `src/utils/coachingFallbacks.ts` (API 키 없을 때) |

### 4.3 기획사 오디션 · 월간 평가
| 역할 | 파일 |
|------|------|
| 오디션 | `AgencyAuditionView`, `api/audition.js`, `src/data/agencyAuditions.ts` |
| 월간 | `MonthlyEvalView`, `api/monthly.js` |

### 4.4 Discover / 트렌딩
| 역할 | 파일 |
|------|------|
| API | `api/discover.js`, `api/cron.js` (update-trending) |
| UI | `TrendingView`, `PopularDanceView`, … |

### 4.5 인증
| 역할 | 파일 |
|------|------|
| Firebase | `src/firebase.ts`, `contexts/AuthContext.tsx` |
| 카카오 | `contexts/SocialAuthContext`, `api/auth.js` (kakao-token) |
| env | `.env.example` § Kakao, Firebase Admin |

---

## 5. 그룹 스튜디오 (Group Practice) — 핵심 파이프라인

### 5.1 진입
`HomeView` / TV → `TVModeView` → mode **group** → **`GroupPracticeView.tsx`**

### 5.2 Phase 상태 (`useGroupStudio.ts`) — **2026-07-16 Group Mode 분리**

```
home → song_detail → position_select → content_loading → practice → result
```

| Phase | 컴포넌트 |
|-------|----------|
| home | `GroupStudioHome.tsx` |
| song_detail | `SongDetailScreen.tsx` |
| position_select | `PositionPicker.tsx` |
| content_loading | **`GroupContentLoadingScreen.tsx`** (Pre-built 로드) |
| practice | **`GroupStudioSession.tsx`** |
| result | `PerformanceReport.tsx` |

**제거됨 (런타임):** `choreo_extract` / `ChoreoExtractScreen` 진입. 레거시 파일은 유지(삭제 금지).

### 5.3 Pre-built 콘텐츠 → 연습 (사용자 런타임 데이터 흐름)

```
[사용자 Group Mode]
  곡/멤버 선택
  → loadGroupMotionContent()  (IndexedDB → static JSON → stub)
  → buildGroupPracticeRuntime()  (userSlot + aiAvatarMembers)
  → buildPracticeSessionFromContent()  (preBuiltContent: true, pipeline skip)
  → GroupStudioSession → GroupDanceSyncEngine → GroupDanceStage3D

[Admin 콘텐츠 제작 — Dev only]
  GroupContentAdminView
  → Local Holistic (브라우저) | http_mocap_api (서버 1회)
  → MemberAutoDetect → persistGroupMotionContent()
  → IndexedDB + JSON export
```

**금지 (Group Mode 런타임):** `MotionExtractionEngine`, `analyzeFileHolistic`, MoCap API, `choreo_extract`  
**허용:** Pre-built 데이터 로드, 사용자 웹캠 `useMediaPipeTV` (실시간 비교용, 추출 아님)

### 5.3.1 레거시 추출 경로 (Teaching/Admin 전용 — Group Mode 미사용)

```
[ChoreoExtractScreen] — 레거시, Group Mode 진입 없음
  → useGroupChoreoExtract (guardGroupModeNoExtraction)
  → MotionExtractionEngine / MediaPipe
  → buildDanceDatabase → practice (구 경로)
```

### 5.4 Pre-built 콘텐츠 소스 (`GroupMotionContentLoader.ts`)

1. **IndexedDB** `onnode_dance_data_v2` (Admin persist)
2. **`/data/choreography/{groupId}-{songId}.json`** (정적 배포)
3. 폴백: `{groupId}-demo.json` (blackpink-demo)

stub 생성: `npm run generate:choreography-stubs` → `public/data/choreography/` 16곡

### 5.5 YouTube 영상 (연습 참고용만)

연습 시 YouTube/로컬 영상은 **참고 재생**용. 스켈레톤 추출은 Admin에서 1회만.

### 5.6 MediaPipe (Teaching Mode / Admin Local Holistic)

- Teaching: `useMediaPipeTV`, `TVLayout`
- Admin: `LocalHolisticMoCapProvider` → `analyzeFileHolistic` (Group Mode 가드 무관)
- **Group Mode 사용자 런타임: 영상 추출 MediaPipe 호출 0회**

### 5.7 캐시
- `groupChoreoCache.ts` — IndexedDB 안무 프레임 (`CHOREO_CACHE_PIPELINE_VERSION` = **v5.0**)
- `DanceDatabaseService.ts` — IndexedDB `onnode_dance_data_v2`
- **v5.0 미만 캐시 자동 무효** (`isChoreoCacheValid`) — 연습 진입 전 **안무 재추출** 권장

---

## 6. 3D 아바타 · PersonaStyle (그룹 모드) — **현재 구현 상태**

### ⚠️ "페르소나" 이름이 두 갈래

| 종류 | 구현 | AI 연결 |
|------|------|---------|
| **A. 코칭 페르소나** (SongAnalysis) | `personaName`, `danceAttitude` 텍스트 | Claude (`/api/coaching/*`) |
| **B. 그룹 PersonaStyle** (3D 렌더 메타) | `energy/sharpness/groove/accentColor` | **AI 없음 — 하드코딩** (`useGroupDanceEngine.ts`) |

### 3D 아바타 (그룹)
| 항목 | 현재 |
|------|------|
| GLB 소스 | `ReadyPlayerMeService.ts` — **멤버별 데모 GLB 풀** (8종 hash 분배), RPM 생성 API **미연결** |
| RPM 생성 API | **미연결** (`VITE_RPM_SUBDOMAIN`은 URL 패턴만) |
| 움직임 | Pre-built joints → `MotionRetargetingService.ts` + `AvatarRetargetEngine.ts` |
| 렌더 | `GroupDanceStage3D.tsx` — 3D 모드: **`AvatarCharacterWithFallback` 우선** (GLB 실패 시만 Skeleton 폴백) |
| 배경 | `GroupPracticeEnvironment.tsx` — Teaching Mode 배경과 분리 |
| **미구현 (로드맵)** | 페르소나 분석 AI → RPM 멤버별 GLB 생성 API |

### K-POP Group Motion Reconstruction Engine (2026-07-03)

| 계층 | 파일 | 역할 |
|------|------|------|
| 배치 파이프라인 | `GroupMotionPipeline.ts` v5.0 | 14단계 오케스트레이터 → DanceDatabase |
| 실시간 엔진 | `GroupMotionReconstructionEngine.ts` | 프레임 재구성, Motion DB 기반 AI 멤버 |
| 멤버 추적 | `MemberTrackingEngine.ts` | Adaptive Hungarian + Kalman + TrackPool + Occlusion Re-ID |
| Motion DB | `MotionDatabaseEngine.ts` | 멤버별 독립 Motion 트랙 (Skeleton 복사 금지) |
| Motion Timeline | `MotionTimelineEngine.ts` | 멤버별 실측 타임라인 |
| Formation Timeline | `FormationTimelineEngine.ts` | 구간별 대형 (Diamond→Line→Circle…) |
| Orientation | `OrientationEngine.ts` | Body facing (front/back/45°/90°) |
| Joint Rotation | `JointRotationEngine.ts` | 본별 Quaternion (`boneRotations`) |
| Avatar Retarget | `AvatarRetargetEngine.ts` | GLB Quaternion 리타겟 |
| 레거시 파사드 | `memberPoseMatching.ts` | `postProcessFrame` → Engine 위임 (**expandSingleDancerToGroup 제거**) |
| Debug HUD | `GroupMotionDebugOverlay.tsx` | 추출·연습 UI 실시간 Motion Engine 상태 |
| 메타데이터 | `types/groupMotionEngine.ts` | `GroupMotionEngineMetadata` / Debug State |

**금지 패턴:** `expandSingleDancerToGroup`, `nPrev+currIdx` trackId, 고정 `MATCH_COST_THRESHOLD`, Skeleton XY 복사 기반 AI 생성 (다인 영상)

### 스켈레톤 → 3D 안정화 파이프라인 (2026-07 적용)

| 단계 | 파일 | 역할 |
|------|------|------|
| 좌표 정규화 | `skeletonDataUtils.ts` → `normalizeSkeletonFrames()` | `formation`/`memberTracks`/`confidence`/`boundingBox`/`worldCoordinates`/`frameIndex` **유지**, joints 좌표만 0~1 |
| Member Track 유지 | `SkeletonMemberTracker.ts` + `poseSimilarity.ts` | 프레임 간 `trackId`/`estimatedMemberId` 안정화. **11관절 Pose Distance + Hungarian Algorithm**. **X좌표 정렬 금지** |
| Frame 보간 | `FrameInterpolationEngine.ts` | MediaPipe 일시 누락(예: 4명→3명→4명) 시 앞뒤 프레임 **Linear Interpolation** (`isEstimated: true`). Avatar 깜빡임 방지 |
| 세션 패키지 | `buildPracticeSessionData.ts` | `PracticeSessionData` 생성 — **duration = video.duration**, **totalFrames = duration × fps** (`practiceTimelineUtils.ts`) |
| Snapshot | `GroupDanceSyncEngine.ts` | `frame`/`currentTime`/`timeline`/`formation`/`memberTracks`/`confidence` 포함 — 스테이지 100% 복원 |
| 진입 검증 | `practiceDataValidation.ts` + `validateSkeletonForPractice()` | 전체 프레임 **80% 이상** 유효 시 통과 (`SKELETON_MIN_VALID_FRAME_RATIO = 0.8`) |
| 디버그 HUD | `PracticeDebugHUD.tsx` + `GroupMotionDebugOverlay.tsx` | Frame, Valid Ratio, Motion Engine Stage, Timeline Coverage 등 |

**연결 위치:** `buildPracticeSessionData.ts`, `DanceDatabaseService.buildDanceDatabase()`  
**구식 제거:** `videoAnalysisUtils.ts`의 forward-fill(`fillMemberGapsInSkeletonFrames`) — 선형 보간 파이프라인으로 대체

---

## 7. API 라우팅 (Vercel rewrite)

`vercel.json`: `/api/group/:path*` → `/api/group?path=:path*`

### `api/group.js` → `lib/api-handlers/group/`
| path | 용도 |
|------|------|
| proxy-video | YouTube 스트림 프록시 (`streamResolver.cjs`, youtubei ANDROID 우선) |
| analyze-formation | 트랙↔멤버 spatial greedy |
| youtube-search | YouTube 검색 |
| video-metadata | 메타데이터 |
| group-feedback | 그룹 피드백 |
| extract-skeleton | 스켈레톤 (레거시) |
| create-motion-content | **Admin MoCap API 프록시** (`MOCAP_API_URL` + `MOCAP_API_KEY`) |
| shorts-upload | 쇼츠 업로드 |

### `api/coaching.js` (action 쿼리 또는 path)
analyze-song, dance-persona, vocal-soul, vocal-clone, vocal-cover, korean-*, section-coach, analyze-reference

### 기타
- `api/auth.js`, `api/tv.js`, `api/audition.js`, `api/monthly.js`, `api/spotify.js`, `api/knowledge.js`, `api/cron.js`, `api/discover.js`

---

## 8. 환경 변수 요약 (`.env.example` 참조)

| 변수 | 용도 |
|------|------|
| `VITE_FIREBASE_*` | 클라이언트 Firebase |
| `FIREBASE_ADMIN_*` | 서버 Custom Token (카카오) |
| `VITE_GEMINI_API_KEY` | 클라이언트 AI 코치 (App.jsx) |
| `ANTHROPIC_API_KEY` | 서버 코칭·오디션 |
| `YOUTUBE_API_KEY` | Discover 트렌딩 |
| `SPOTIFY_CLIENT_*` | 곡 특성 |
| `VITE_RPM_SUBDOMAIN` | RPM (생성 API 아님, 멤버별 데모 GLB 풀) |
| `MOCAP_API_URL` / `MOCAP_API_KEY` | Admin MoCap 프록시 (Group Mode 런타임 미사용) |
| `COBALT_API_URL` | YouTube 프록시 옵션 |
| `VITE_KAKAO_*`, `KAKAO_REST_API_KEY` | 카카오 로그인 |

---

## 9. 알려진 이슈 · 적용된 수정

### 2026-06 세션

| 이슈 | 원인 | 수정 |
|------|------|------|
| proxy-video 502 "서버 처리 중 오류" | `lib/api-handlers` ESM/CJS | `lib/api-handlers/package.json` commonjs |
| YouTube 프로덕션 실패 | Vercel IP 봇 차단 | 탭 녹화 1순위, getDisplayMedia 즉시 호출 |
| MediaPipe `timestamp mismatch` | VIDEO+seek+detectForVideo | **IMAGE+detect** |
| 탭 녹화 안 됨 | ytdl 먼저 → 제스처 만료 | 순서·타이밍 수정 |
| 3D 멤버 구분 없음 | RPM 데모 1개 | **부분 해결** — 멤버별 데모 GLB 풀 (RPM 생성 API는 미연결) |

### 2026-07 세션 (그룹 스켈레톤 · 연습 진입)

| 이슈 | 원인 | 수정 |
|------|------|------|
| GroupStudioSession 진입 후 AI Avatar 0명 | `skeletonData`만 검사, metadata 누락 캐시 | `PracticeSessionData` 도입 + `validatePracticeData()` 10항목 검증, 실패 시 `PracticeValidationError` |
| `practiceDuration` 180초 고정 | song.duration / 하드코딩 폴백 | `resolvePracticeDurationSec()` — `HTMLVideoElement.duration` 우선, 없으면 마지막 frame timestamp |
| normalize 시 formation/memberTracks 삭제 | joints만 남기고 spread 누락 | `normalizeSkeletonFrames()` metadata spread 유지 |
| AI Avatar 프레임마다 튐 | MediaPipe 프레임별 trackId 순서 불안정 | `stabilizeSkeletonMemberTracks()` — Pose Similarity + Hungarian (**X좌표 정렬 사용 안 함**) |
| Avatar 일시 사라짐(깜빡임) | MediaPipe 프레임 간 인원 수 변동(4→3→4) | `interpolateSkeletonFrameGaps()` — 앞뒤 frame Linear Interpolation |
| 구 캐시로 연습 진입 실패 | tracker/interpolation 미적용 캐시 | **안무 재추출** 필요 (`onnode_dance_data_v2` / `groupChoreoCache`) |
| practiceDuration 부정확 | lastFrameTimestamp / Math.max 폴백 | `computePracticeTimeline()` — **video.duration → fps → totalFrames** (`practiceTimelineUtils.ts`) |
| Snapshot 메타데이터 없음 | tick이 joints만 반환 | `GroupDanceSyncEngine` — frame/formation/memberTracks/confidence/timeline 포함 |
| `useSkeletonExtract` 경로 X정렬 | `memberPoseMatching.assignMembersSpatial()` | `memberPoseMatching.ts` → Engine 파사드로 교체. `expandSingleDancerToGroup` **제거** |

### 2026-07-03 세션 (Group Motion Reconstruction Engine v5.0)

| 이슈 | 원인 | 수정 |
|------|------|------|
| AI 멤버 Skeleton 복사 | `expandSingleDancerToGroup` 프로토타입 | `GroupMotionReconstructionEngine` — Motion Database / Timeline 기반 생성 |
| 고정 매칭 임계값 | `MATCH_COST_THRESHOLD=0.85` | `adaptiveMatchThreshold.ts` — 프레임별 Adaptive Threshold |
| trackId 무한 증가 | `nextTrackId++` / `nPrev+currIdx` | `TrackPool.ts` — trackId 재사용 |
| 멤버별 Motion 없음 | 단일 스켈레톤 공유 | `MotionDatabaseEngine` + `MotionTimelineEngine` — 멤버별 독립 트랙 |
| 대형 구간 미반영 | formation 메타만 | `FormationTimelineEngine` — 구간별 Diamond/Line/Circle + transition |
| 3D 회전 부정확 | 좌표만 저장 | `JointRotationEngine` + `OrientationEngine` — Quaternion `boneRotations` |
| v5.0 이전 캐시 | pipelineVersion 불일치 | `isChoreoCacheValid()` 거부 — **안무 재추출** 필요 |
| Motion Engine 디버그 없음 | HUD 미연동 | `GroupMotionDebugOverlay` — `VideoUploadStep` / `GroupStudioSession` |

### 2026-07-10 세션 (Production Pipeline Architecture)

| 구성요소 | 경로 | 격리 원칙 |
|----------|------|-----------|
| Frame Queue (RVFC/WebCodecs) | `videoFrameSampler.ts` / `webCodecsFrameSampler.ts` / `sampleVideoFrames.ts` | Producer만 캡처, `onSample`은 메타데이터만 전달 |
| Pipeline Stages | `motionExtractionStages.ts` + `asyncPipelineQueue.ts` | mediapipe → tracking → worker-dancedatabase 독립 큐 |
| MediaPipe Worker | `motionDetectionWorker.ts` + `WorkerMotionDetector.ts` | Capability Probe 실패 시 메인 스레드 폴백 |
| PostProcess Worker | `motionPostProcessWorker.ts` | Motion Queue와 독립, 큐 공유 금지 |
| Renderer Worker | `rendererWorker.ts` + `useOffscreenRenderer.ts` | `VITE_RENDERER_WORKER_ENABLED=true` 시만 활성, 기본 메인 스레드 |
| Event Bus | `pipelineEventBus.ts` | Motion / Renderer / AI Coach는 직접 import 금지, 이벤트만 |
| Memory Profiler | `memoryProfiler.ts` | Chrome heap + Worker memory-report + GC 휴리스틱 |
| Stress Test | `stressTestHarness.ts` | `?stressTest=1` (DEV) — 30분+ 영상 로컬 검증 |

**AI Dance Coach 확장 규칙:** 코칭이 로컬 연산(실시간 자세 비교 등)을 추가할 때는 반드시 **자체 Worker + Queue**를 만들고, MediaPipe/PostProcess/Renderer Worker와 큐를 공유하지 않는다. `asyncPipelineQueue.createPipelineStage()` 재사용 권장.

### 2026-07-16 세션 (Group Mode / Teaching Mode 완전 분리)

| 항목 | 내용 |
|------|------|
| Group Mode 런타임 | `choreo_extract` 제거 → `loadGroupMotionContent` + `buildGroupPracticeRuntime` |
| Pre-built 로드 | `preBuiltContent: true` 시 `runGroupMotionPipeline` skipPostProcess |
| Admin 파이프라인 | `GroupContentAdminView` + `GroupContentCreationEngine` + MoCap providers |
| MoCap API | `/api/group?path=create-motion-content` — multipart/JSON 프록시 + 응답 정규화 |
| 콘텐츠 stub | `public/data/choreography/{groupId}-{songId}.json` 16곡 (`generate:choreography-stubs`) |
| 3D Avatar | 멤버별 RPM 데모 GLB 풀, 3D 모드 AvatarCharacter 우선 |
| 가드 | `groupModeRuntimeGuard.ts` — extraction 호출 차단 |
| Dev 진입 | LeftPanel → Group Content Admin, Skeleton Analysis Studio |

---

## 10. 파일 연결 Quick Reference (그룹 모드)

```
GroupPracticeView.tsx
  practiceDataValidation.ts → PracticeValidationError.tsx
  useGroupStudio.ts
    loadGroupMotionContent.ts → GroupMotionContentAdapter.ts
    buildGroupPracticeRuntime.ts
    buildPracticeSessionFromContent.ts (preBuiltContent, pipeline skip)
  GroupContentLoadingScreen.tsx
  GroupStudioSession.tsx
    practiceSessionData (preBuiltContent, groupPracticeRuntime)
    useGroupAvatarAssets.ts → ReadyPlayerMeService.ts (멤버별 GLB 풀)
    GroupDanceStage3D.tsx → GroupPracticeEnvironment.tsx
      AvatarCharacterWithFallback → AvatarCharacter3D (3D 우선)
    useMediaPipeTV.ts (사용자 웹캠 실시간 — 추출 아님)
    GroupDanceSyncEngine.ts

[Admin — Dev only]
  GroupContentAdminView.tsx → useGroupContentAdmin.ts
    GroupContentCreationEngine.ts
    LocalHolisticMoCapProvider | HttpMoCapProvider
    GroupContentPersistence.ts
  api/group.js → create-motion-content.js

[레거시 — Teaching/Admin, Group Mode 런타임 미사용]
  ChoreoExtractScreen.tsx → useGroupChoreoExtract.ts (guardGroupModeNoExtraction)
    MotionExtractionEngine.ts
  SkeletonDebugStudioView.tsx
```

---

## 11. 코딩 규칙

- TypeScript/JS 혼재: 많은 파일 `// @ts-nocheck`
- 그룹 UI: `src/styles/group-studio.css`
- TV UI: `src/styles/tv-mode.css`
- API 핸들러 추가 시: `api/*.js` HANDLERS + `lib/api-handlers/` + `vercel.json` rewrite 확인
- MediaPipe 오프라인/seek 분석: **IMAGE + detect** only
- YouTube 그룹 추출: **탭 녹화 우선**, Chrome/Edge 권장
- 사용자 규칙: **한국어** 응답

---

## 12. PROJECT_PROMPT.md · Cursor Rules 와의 관계

- `PROJECT_PROMPT.md` = 초기 재구축용 레거시 사양 (일부 outdated — 예: Holistic only, Gemini only)
- **`MASTER_CONTEXT.md` = 현재 repo 진단·작업용 고정 컨텍스트 (이 파일 우선)**
- **`.cursor/rules/`** (자동 적용):
  - `k-onnode-master-context.mdc` — **alwaysApply** (전역)
  - `group-studio-choreo.mdc` — 그룹/YouTube/3D 관련 파일
  - `api-handlers-vercel.mdc` — `api/`, `lib/api-handlers/`
  - `coaching-persona-api.mdc` — 코칭·SongAnalysis (3D와 구분)

---

## 13. 작업 지시 템플릿 (사용자가 매번 아래에 추가)

```
---
## 이번 작업 지시 (YYYY-MM-DD)
- 목표:
- 범위 (수정할 파일/기능):
- 하지 말 것:
- 배포 필요 여부:
---
```

# Group Dance Avatar System Architecture

K-POP 그룹 연습: 사용자 1명 + AI 페르소나 아바타 N명 동기화 렌더링.

## Data Flow

```
ChoreographyDataset (JSON)
        │
        ▼
AvatarGroupManager ──► userMemberId 제외 AI 아바타 생성
        │
        ▼
GroupDanceSyncEngine ◄── MediaPipe userJoints + timeline elapsed
        │
        ▼
FormationPositioning ──► user anchor 기준 AI 대형 재배치
        │
        ▼
GroupDanceRenderSnapshot
        │
        ├── GroupDanceStage3D (Three.js)
        └── GroupTVStageCanvas (2D Canvas, 기존)
```

## JSON Schema (`ChoreographyDataset`)

| 필드 | 설명 |
|------|------|
| `meta.groupId / songId` | 데이터셋 식별 |
| `members[].memberId` | 멤버 ID |
| `members[].persona` | energy, sharpness, groove, accentColor |
| `members[].formationAnchor` | 대형 슬롯 x,y,z (0~1) |
| `frames[].timestamp` | 초 단위 |
| `frames[].members[].joints` | 관절별 x,y,z |

샘플: `public/data/choreography/blackpink-demo.json`

## 주요 모듈

| 파일 | 역할 |
|------|------|
| `src/types/groupChoreography.ts` | 타입 정의 |
| `src/services/group/ChoreographyDatasetLoader.ts` | JSON lazy load + 캐시 |
| `src/services/group/AvatarGroupManager.ts` | AI 아바타 필터/생성 |
| `src/services/group/FormationPositioning.ts` | 사용자 중심 대형 배치 |
| `src/services/group/GroupDanceSyncEngine.ts` | MediaPipe + AI 동기화 |
| `src/hooks/useGroupDanceStage.ts` | React 통합 훅 |
| `src/components/group/three/GroupDanceStage3D.tsx` | Three.js 렌더러 |

## Rendering Strategy

1. **Timeline**: `useAvatarSync.getElapsed()` 또는 YouTube currentTime
2. **AI**: dataset.frames에서 nearest frame → AI member joints
3. **User**: MediaPipe live joints → userAnchor로 stage 슬롯에 매핑
4. **Formation**: user root 대비 AI delta 유지 → 그룹 대형 보존
5. **Render**: snapshot을 Canvas/Three.js에 매 프레임 전달

## 사용 예시

```tsx
import { useGroupDanceStage } from '../hooks/useGroupDanceStage';
import { GroupDanceStage3D } from '../components/group/three/GroupDanceStage3D';
import { useMediaPipeTV } from '../hooks/useMediaPipeTV';

function GroupPractice3D({ groupId, songId, userMemberId, skeletonFrames }) {
  const dance = useMediaPipeTV('#FF1F8E');
  const stage = useGroupDanceStage({
    groupId,
    songId,
    userMemberId,
    skeletonFrames,
    userJoints: dance.poseData?.joints,
    autoStart: true,
  });

  if (stage.loading) return <div>로딩 중...</div>;
  if (stage.error) return <div>{stage.error}</div>;

  return <GroupDanceStage3D snapshot={stage.snapshot} className="group-stage-3d" />;
}
```

## 기존 2D 파이프라인과의 관계

- `GroupStudioSession` → Canvas 2D (`groupSkeletonDraw`)
- 새 3D 파이프라인은 동일한 `skeletonFrames` / MediaPipe 데이터를 공유
- `skeletonFramesToChoreographyDataset()`으로 2D 추출 결과를 JSON 스키마로 변환 가능

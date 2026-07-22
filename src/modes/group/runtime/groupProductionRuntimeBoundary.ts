// @ts-nocheck
/**
 * Group Production Runtime boundary — legacy motion data isolation (PHASE 12).
 *
 * Active production path: useGroupStudio → loadProductionMotionAsset → GLB animation.
 * Legacy paths (choreography JSON, joints, SkeletonFrameData) must NOT feed this graph.
 */
import { readFileSync, statSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const GROUP_PRODUCTION_ACTIVE_PATHS = [
  'src/hooks/useGroupStudio.ts',
  'src/components/group/GroupStudioSession.tsx',
  'src/hooks/useGroupDanceEngine.ts',
  'src/services/group/GroupDanceSyncEngine.ts',
  'src/components/group/three/GroupDanceStage3D.tsx',
  'src/components/group/three/AvatarCharacterAnimated3D.tsx',
  'src/modes/group/services/ProductionMotionAssetLoader.ts',
  'src/modes/group/runtime/productionMotionAssetV2Mapper.ts',
  'src/modes/group/runtime/runProductionMotionRetargetGate.ts',
] as const;

const LEGACY_CHOREOGRAPHY_FETCH = [
  'ChoreographyDatasetLoader',
  'loadChoreographyDataset',
  '/data/choreography/',
  'idol-choreo-skeleton',
  'GroupMotionContentLoader',
  'loadGroupMotionContent',
];

const LEGACY_SKELETON_TOKENS = [
  'SkeletonFrameData',
  'skeletonFrames',
  'useGroupChoreoExtract',
  'MotionExtractionEngine',
  'useSkeletonExtract',
];

const DEEPMOTION_GROUP_RUNTIME_TOKENS = [
  'deepMotionProvider',
  'DeepMotionProvider',
  'lib/api-handlers/group/deepmotion',
  'fetchDeepMotion',
];

function readSource(path: string): string {
  try {
    return readFileSync(resolve(path), 'utf8');
  } catch {
    return '';
  }
}

export function auditGroupProductionRuntimeBoundary() {
  const violations: string[] = [];

  for (const rel of GROUP_PRODUCTION_ACTIVE_PATHS) {
    const content = readSource(rel);
    if (!content) continue;

    for (const token of LEGACY_CHOREOGRAPHY_FETCH) {
      if (content.includes(token)) {
        violations.push(`${rel}: legacy choreography reference "${token}"`);
      }
    }

    for (const token of ['@mediapipe/tasks-vision']) {
      const lines = content.split('\n');
      for (const line of lines) {
        const t = line.trim();
        if ((t.startsWith('//') || t.startsWith('*')) && !line.includes('import')) continue;
        if (line.includes('import ') && line.includes(token)) {
          violations.push(`${rel}: MediaPipe import`);
        }
      }
    }

    for (const token of LEGACY_SKELETON_TOKENS) {
      const lines = content.split('\n');
      for (const line of lines) {
        const t = line.trim();
        if (t.startsWith('//') || t.startsWith('*')) continue;
        if (line.includes('import ') && line.includes(token)) {
          violations.push(`${rel}: skeleton legacy import "${token}"`);
        }
      }
    }

    for (const token of DEEPMOTION_GROUP_RUNTIME_TOKENS) {
      if (content.includes(token)) {
        violations.push(`${rel}: DeepMotion direct reference "${token}"`);
      }
    }
  }

  return {
    secure: violations.length === 0,
    violations,
  };
}

export default auditGroupProductionRuntimeBoundary;

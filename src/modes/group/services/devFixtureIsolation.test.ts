// @ts-nocheck
/**
 * useGroupStudio.ts — DEV fixture 자동 로드 제거 검증
 * Run: npx tsx src/modes/group/services/devFixtureIsolation.test.ts
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const useGroupStudioSrc = readFileSync(
  resolve(process.cwd(), 'src/hooks/useGroupStudio.ts'),
  'utf8',
);

assert(
  !useGroupStudioSrc.includes('shouldUseDevMotionFixture'),
  'useGroupStudio must not call shouldUseDevMotionFixture',
);
assert(
  !useGroupStudioSrc.includes('loadDevMotionFixturePractice'),
  'useGroupStudio must not call loadDevMotionFixturePractice',
);
assert(
  useGroupStudioSrc.includes('loadProductionMotionAsset'),
  'useGroupStudio must use loadProductionMotionAsset',
);

console.log('devFixtureIsolation tests: PASS');

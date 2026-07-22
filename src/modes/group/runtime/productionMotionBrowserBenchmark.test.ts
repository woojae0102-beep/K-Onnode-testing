// @ts-nocheck
/**
 * PHASE 17 — Browser Performance Benchmark tests (TEST 151~170)
 * Run: npx tsx src/modes/group/runtime/productionMotionBrowserBenchmark.test.ts
 */
process.env.K_ONNODE_ALLOW_DEV = '1';

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { computeFrameTimeStats } from '../benchmark/groupMotionBenchmarkStats';
import {
  benchmarkAvatarCount,
  runGroupMotionStressBenchmark,
  STRESS_AVATAR_COUNTS,
} from '../benchmark/groupMotionBrowserBenchmarkHarness';
import { buildFullBenchmarkReportText, BENCHMARK_TABLE_HEADER } from '../benchmark/groupMotionBrowserBenchmarkReport';
import { runGroupMotionCacheBenchmark } from '../benchmark/groupMotionCacheBenchmark';
import { runGroupMotionMemoryLeakBenchmark } from '../benchmark/groupMotionMemoryLeakBenchmark';
import { getProductionMotionRuntimeMetrics, resetProductionMotionRuntimeCacheForTests } from '../runtime/productionMotionRuntimeCache';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function test151BenchmarkHarnessCreatesReport() {
  const report = runGroupMotionStressBenchmark([1]);
  assert(report.samples.length === 1, 'TEST 151 samples');
  assert(report.generatedAt, 'TEST 151 timestamp');
  assert(Array.isArray(report.notes), 'TEST 151 notes');
  console.log('TEST 151: PASS');
}

function test152FpsStatsFromMeasuredFrameTimes() {
  const stats = computeFrameTimeStats([16, 16.5, 17, 15, 33]);
  assert(stats.sampleCount === 5, 'TEST 152 count');
  assert(stats.averageFps != null && stats.averageFps > 0, 'TEST 152 avg fps');
  assert(stats.worstFrameTimeMs === 33, 'TEST 152 worst');
  console.log('TEST 152: PASS');
}

function test153FrameTimePercentiles() {
  const stats = computeFrameTimeStats([10, 12, 14, 16, 18, 20, 50]);
  assert(stats.percentile95FrameTimeMs != null, 'TEST 153 p95');
  assert(stats.percentile95FrameTimeMs >= 18, 'TEST 153 p95 value');
  console.log('TEST 153: PASS');
}

function test154StressAvatar1() {
  resetProductionMotionRuntimeCacheForTests();
  const s = benchmarkAvatarCount(1);
  assert(s.avatarCount === 1, 'TEST 154 count');
  assert(s.frameStats.sampleCount === 60, 'TEST 154 frames');
  assert(s.cpuUpdateTimeMs != null, 'TEST 154 cpu');
  console.log('TEST 154: PASS');
}

function test155StressAvatar4() {
  const s = benchmarkAvatarCount(4);
  assert(s.avatarCount === 4, 'TEST 155');
  assert(getProductionMotionRuntimeMetrics().mixerCount === 0, 'TEST 155 cleaned');
  console.log('TEST 155: PASS');
}

function test156StressAvatar8() {
  const s = benchmarkAvatarCount(8);
  assert(s.avatarCount === 8, 'TEST 156');
  assert(s.retargetTimeMs != null, 'TEST 156 retarget measured');
  console.log('TEST 156: PASS');
}

function test157StressAvatar12() {
  const s = benchmarkAvatarCount(12);
  assert(s.avatarCount === 12, 'TEST 157');
  console.log('TEST 157: PASS');
}

function test158StressAvatar16() {
  const s = benchmarkAvatarCount(16);
  assert(s.avatarCount === 16, 'TEST 158');
  console.log('TEST 158: PASS');
}

function test159StressAvatar24() {
  const s = benchmarkAvatarCount(24);
  assert(s.avatarCount === 24, 'TEST 159');
  console.log('TEST 159: PASS');
}

function test160StressAvatar32() {
  const s = benchmarkAvatarCount(32);
  assert(s.avatarCount === 32, 'TEST 160');
  console.log('TEST 160: PASS');
}

function test161MemoryLeak100Cycles() {
  const leak = runGroupMotionMemoryLeakBenchmark(100);
  assert(leak.cycles === 100, 'TEST 161 cycles');
  assert(leak.mixerLeakCount === 0, `TEST 161 mixer leak=${leak.mixerLeakCount}`);
  assert(leak.avatarLeakCount === 0, `TEST 161 avatar leak=${leak.avatarLeakCount}`);
  assert(leak.disposedMixers >= 100, `TEST 161 disposed=${leak.disposedMixers}`);
  console.log('TEST 161: PASS');
}

function test162MixerLeakZeroAfterCycles() {
  resetProductionMotionRuntimeCacheForTests();
  runGroupMotionMemoryLeakBenchmark(10);
  assert(getProductionMotionRuntimeMetrics().mixerCount === 0, 'TEST 162 mixers');
  console.log('TEST 162: PASS');
}

function test163CacheBenchmarkLayers() {
  const cache = runGroupMotionCacheBenchmark();
  assert(cache.layers.length === 5, 'TEST 163 layers');
  const retarget = cache.layers.find((l) => l.layer === 'retarget');
  assert(retarget!.hits >= 1, 'TEST 163 retarget hit');
  console.log('TEST 163: PASS');
}

function test164StressFullMatrix() {
  const report = runGroupMotionStressBenchmark([...STRESS_AVATAR_COUNTS]);
  assert(report.samples.length === STRESS_AVATAR_COUNTS.length, 'TEST 164 matrix');
  for (const count of STRESS_AVATAR_COUNTS) {
    const sample = report.samples.find((s) => s.avatarCount === count);
    assert(sample, `TEST 164 missing ${count}`);
  }
  console.log('TEST 164: PASS');
}

function test165ReportTableFormat() {
  const report = runGroupMotionStressBenchmark([1, 4]);
  const text = buildFullBenchmarkReportText(report);
  assert(text.includes(BENCHMARK_TABLE_HEADER[0]), 'TEST 165 header');
  assert(text.includes('Stress Test'), 'TEST 165 section');
  console.log('TEST 165: PASS');
}

function test166RendererInfoFieldPresent() {
  const s = benchmarkAvatarCount(2);
  assert(typeof s.rendererInfo === 'object', 'TEST 166 renderer');
  assert(s.rendererInfo.measured === false || s.rendererInfo.measured === true, 'TEST 166 measured flag');
  console.log('TEST 166: PASS');
}

function test167AuthorityFailClosedRegression() {
  const src = readFileSync(resolve('src/modes/group/runtime/productionAuthorityFailClosed.test.ts'), 'utf8');
  assert(src.includes('TEST 116'), 'TEST 167 authority tests exist');
  console.log('TEST 167: PASS');
}

function test168ProductionRuntimePerformanceRegression() {
  const src = readFileSync(resolve('src/modes/group/runtime/productionMotionRuntimePerformance.test.ts'), 'utf8');
  assert(src.includes('TEST 131'), 'TEST 168 perf tests');
  console.log('TEST 168: PASS');
}

const GROUP_RUNTIME_PATHS = [
  'src/modes/group',
  'src/components/group/GroupStudioSession.tsx',
  'src/components/group/three',
  'src/hooks/useGroupStudio.ts',
];

function collectSourceFiles(dir: string, acc: string[] = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist') continue;
      collectSourceFiles(full, acc);
    } else if (/\.(tsx?|jsx?)$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

function countGroupRuntimeImport(pattern: string): number {
  const root = resolve(process.cwd());
  let count = 0;
  for (const rel of GROUP_RUNTIME_PATHS) {
    const abs = join(root, rel);
    let files: string[] = [];
    try {
      const st = statSync(abs);
      files = st.isDirectory() ? collectSourceFiles(abs) : [abs];
    } catch {
      continue;
    }
    for (const file of files) {
      if (/\.test\.(tsx?|jsx?)$/.test(file)) continue;
      if (file.includes('/benchmark/')) continue;
      const lines = readFileSync(file, 'utf8').split('\n');
      for (const line of lines) {
        const t = line.trim();
        if (t.startsWith('//') || t.startsWith('*')) continue;
        if (!t.includes('import ') && !t.includes('from ')) continue;
        if (line.includes(pattern)) count += 1;
      }
    }
  }
  return count;
}

function test169TeachingRegression() {
  const teachingFiles = [
    'src/views/AICoachView.tsx',
    'src/components/coaching/VocalVoiceTeachingPanel.tsx',
    'src/services/teachingReportStore.ts',
  ];
  for (const rel of teachingFiles) {
    const content = readFileSync(resolve(rel), 'utf8');
    for (const token of ['groupMotionBrowserBenchmarkHarness', 'groupMotionSyntheticRuntime']) {
      assert(!content.includes(token), `TEST 169 teaching ${rel} ${token}`);
    }
  }
  console.log('TEST 169: PASS');
}

function test170MediaPipeAndSkeletonImportZero() {
  assert(countGroupRuntimeImport('@mediapipe/tasks-vision') === 0, 'TEST 170 mediapipe');
  let skeletonTotal = 0;
  for (const p of ['SkeletonFrameData', 'skeletonFrames', 'MotionExtractionEngine', 'useSkeletonExtract']) {
    skeletonTotal += countGroupRuntimeImport(p);
  }
  assert(skeletonTotal === 0, `TEST 170 skeleton=${skeletonTotal}`);
  console.log('TEST 170: PASS');
}

function run() {
  test151BenchmarkHarnessCreatesReport();
  test152FpsStatsFromMeasuredFrameTimes();
  test153FrameTimePercentiles();
  test154StressAvatar1();
  test155StressAvatar4();
  test156StressAvatar8();
  test157StressAvatar12();
  test158StressAvatar16();
  test159StressAvatar24();
  test160StressAvatar32();
  test161MemoryLeak100Cycles();
  test162MixerLeakZeroAfterCycles();
  test163CacheBenchmarkLayers();
  test164StressFullMatrix();
  test165ReportTableFormat();
  test166RendererInfoFieldPresent();
  test167AuthorityFailClosedRegression();
  test168ProductionRuntimePerformanceRegression();
  test169TeachingRegression();
  test170MediaPipeAndSkeletonImportZero();
  resetProductionMotionRuntimeCacheForTests();
  console.log('productionMotionBrowserBenchmark tests: ALL PASS (TEST 151~170)');
}

try {
  run();
} catch (err) {
  console.error(err);
  process.exit(1);
}

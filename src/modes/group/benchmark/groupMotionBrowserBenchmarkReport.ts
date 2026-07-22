// @ts-nocheck
/**
 * Browser benchmark report formatter (PHASE 17).
 */
import type { GroupMotionBrowserBenchmarkReport, GroupMotionBenchmarkSample } from './groupMotionBrowserBenchmarkHarness';
import type { MemoryLeakBenchmarkReport } from './groupMotionMemoryLeakBenchmark';

function fmt(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return 'n/a';
  return n.toFixed(digits);
}

export function formatBenchmarkSampleRow(sample: GroupMotionBenchmarkSample): string[] {
  const fs = sample.frameStats;
  return [
    String(sample.avatarCount),
    fmt(fs.averageFps, 1),
    fmt(fs.averageFrameTimeMs, 3),
    fmt(sample.cpuUpdateTimeMs, 3),
    sample.chromeHeapMb != null ? `${sample.chromeHeapMb.toFixed(2)}MB` : 'n/a',
    sample.drawCalls != null ? String(sample.drawCalls) : 'n/a',
    sample.triangles != null ? String(sample.triangles) : 'n/a',
    sample.cacheHitRatio != null ? `${(sample.cacheHitRatio * 100).toFixed(1)}%` : 'n/a',
    fmt(fs.worstFrameTimeMs, 3),
  ];
}

export const BENCHMARK_TABLE_HEADER = [
  'Avatars',
  'Avg FPS',
  'Avg Frame ms',
  'CPU Tick ms',
  'Heap',
  'Draw Calls',
  'Triangles',
  'Cache Hit %',
  'Worst Frame ms',
];

export function buildStressBenchmarkMarkdownTable(report: GroupMotionBrowserBenchmarkReport): string {
  const lines = [
    '| ' + BENCHMARK_TABLE_HEADER.join(' | ') + ' |',
    '| ' + BENCHMARK_TABLE_HEADER.map(() => '---').join(' | ') + ' |',
  ];
  for (const sample of report.samples) {
    lines.push('| ' + formatBenchmarkSampleRow(sample).join(' | ') + ' |');
  }
  return lines.join('\n');
}

export function buildFullBenchmarkReportText(
  stress: GroupMotionBrowserBenchmarkReport,
  memoryLeak?: MemoryLeakBenchmarkReport,
): string {
  const parts = [
    '# Group Motion Browser Benchmark Report',
    `Generated: ${stress.generatedAt}`,
    `Environment: ${stress.environment}`,
    '',
    '## Stress Test',
    buildStressBenchmarkMarkdownTable(stress),
    '',
    '## Cache Benchmark',
  ];

  for (const layer of stress.cacheBenchmark.layers) {
    parts.push(
      `- ${layer.layer}: hits=${layer.hits} misses=${layer.misses} ratio=${layer.hitRatio != null ? (layer.hitRatio * 100).toFixed(1) + '%' : 'n/a'} lookup=${fmt(layer.averageLookupTimeMs, 4)}ms build=${fmt(layer.averageBuildTimeMs, 4)}ms`,
    );
  }

  if (memoryLeak) {
    parts.push('', '## Memory Leak (100 cycles)');
    parts.push(`- heap delta: ${memoryLeak.heapDeltaBytes != null ? memoryLeak.heapDeltaBytes + ' bytes' : 'n/a (Chrome only)'}`);
    parts.push(`- mixer leak: ${memoryLeak.mixerLeakCount}`);
    parts.push(`- avatar leak: ${memoryLeak.avatarLeakCount}`);
    parts.push(`- disposed mixers: ${memoryLeak.disposedMixers}`);
    parts.push(`- note: ${memoryLeak.detachedObjectNote}`);
  }

  parts.push('', '## Notes');
  stress.notes.forEach((n) => parts.push(`- ${n}`));

  return parts.join('\n');
}

export default buildFullBenchmarkReportText;

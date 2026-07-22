// @ts-nocheck
/**
 * PHASE 15 — GX10 REST API integration tests (TEST 140~149)
 * Run: npx tsx src/modes/group/runtime/gx10ApiIntegration.test.ts
 *
 * Uses a real local HTTP server implementing the GX10 REST contract — not client mocks.
 */
import http from 'node:http';
import { createRequire } from 'node:module';
import { computeGX10MemberOutputChecksumSync } from '../../../gx10/ingest/computeGX10MemberOutputChecksum';
import { validateGX10JobOutputContract } from '../../../gx10/ingest/validateGX10ProcessorOutput';
import { GX10_OUTPUT_CONTRACT_VERSION } from '../../../gx10/contracts/GX10ProductionMotionOutputContract';

const require = createRequire(import.meta.url);
const { GX10RestClient, GX10RestClientError } = require('../../../../lib/api-lib/gx10RestClient.cjs');
const { mapJobOutputToProductionMotionAssetV2 } = require('../../../../lib/api-lib/gx10ProductionMotionPersist.cjs');

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const TEST_GLB = Buffer.from('glTF-test-motion-bytes-phase15');

function buildMember(overrides: Record<string, unknown> = {}) {
  const base = {
    memberId: 'm1',
    memberName: 'M1',
    avatarAssetId: 'av-1',
    avatarGlbUrl: 'https://storage.example.com/av-1.glb',
    avatarSkeletonProfile: 'RPM',
    avatarSkeletonVersion: '1.0',
    motionAssetId: 'motion-1',
    motionUrl: 'https://gx10.local/jobs/job-1/members/m1/motion.glb',
    duration: 30,
    animationClipName: 'Dance',
    sourceSkeletonProfile: 'MIXAMO',
    sourceSkeletonVersion: '1.0',
  };
  const merged = { ...base, ...overrides };
  return {
    ...merged,
    checksum: overrides.checksum ?? computeGX10MemberOutputChecksumSync(merged),
  };
}

function buildCompletedResult(jobId: string) {
  return {
    contractVersion: GX10_OUTPUT_CONTRACT_VERSION,
    jobId,
    status: 'completed',
    productionAssetId: 'prod-api-001',
    groupId: 'api-group',
    songId: 'api-song',
    fps: 30,
    provider: 'gx10',
    processorVersion: '1.0.0',
    generatedAt: '2026-07-21T03:00:00.000Z',
    markAsRealProduction: true,
    members: [buildMember()],
  };
}

type TestServerState = {
  jobs: Map<string, {
    status: string;
    pollCount: number;
    failStatusOnce: boolean;
    cancelled: boolean;
    forceProcessing?: boolean;
  }>;
  statusCalls: number;
};

function createGx10TestServer() {
  const state: TestServerState = {
    jobs: new Map(),
    statusCalls: 0,
  };

  const server = http.createServer(async (req, res) => {
    const auth = req.headers.authorization || '';
    if (!auth.includes('test-gx10-key')) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'unauthorized' }));
      return;
    }

    const url = new URL(req.url || '/', 'http://localhost');
    let path = url.pathname;
    if (path.startsWith('/v1/')) path = path.slice(3);
    if (path === '/v1') path = '/';

    if (path === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, service: 'gx10-production-motion-test' }));
      return;
    }

    if (path === '/production-motion/jobs' && req.method === 'POST') {
      const jobId = `job-${Date.now()}`;
      state.jobs.set(jobId, { status: 'queued', pollCount: 0, failStatusOnce: false, cancelled: false });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ jobId, status: 'queued', productionAssetId: 'prod-api-001' }));
      return;
    }

    const statusMatch = path.match(/^\/production-motion\/jobs\/([^/]+)$/);
    if (statusMatch && req.method === 'GET') {
      const jobId = decodeURIComponent(statusMatch[1]);
      const job = state.jobs.get(jobId);
      if (!job) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'not_found' }));
        return;
      }
      state.statusCalls += 1;
      if (job.failStatusOnce) {
        job.failStatusOnce = false;
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'temporary_unavailable' }));
        return;
      }
      if (job.cancelled) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ jobId, status: 'cancelled' }));
        return;
      }
      job.pollCount += 1;
      if (job.pollCount < 2 && !job.forceProcessing) job.status = 'processing';
      else if (!job.forceProcessing) job.status = 'completed';
      else job.status = 'processing';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ jobId, status: job.status, progress: job.pollCount * 50 }));
      return;
    }

    const cancelMatch = path.match(/^\/production-motion\/jobs\/([^/]+)\/cancel$/);
    if (cancelMatch && req.method === 'POST') {
      const jobId = decodeURIComponent(cancelMatch[1]);
      const job = state.jobs.get(jobId);
      if (job) job.cancelled = true;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ jobId, status: 'cancelled' }));
      return;
    }

    const resultMatch = path.match(/^\/production-motion\/jobs\/([^/]+)\/result$/);
    if (resultMatch && req.method === 'GET') {
      const jobId = decodeURIComponent(resultMatch[1]);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ result: buildCompletedResult(jobId) }));
      return;
    }

    const glbMatch = path.match(/^\/production-motion\/jobs\/([^/]+)\/members\/([^/]+)\/motion\.glb$/);
    if (glbMatch && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'model/gltf-binary' });
      res.end(TEST_GLB);
      return;
    }

    res.writeHead(404);
    res.end();
  });

  return { server, state };
}

async function withTestServer(run: (ctx: { baseUrl: string; client: InstanceType<typeof GX10RestClient>; state: TestServerState }) => Promise<void>) {
  const { server, state } = createGx10TestServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  const baseUrl = `http://127.0.0.1:${port}/v1`;
  const client = new GX10RestClient({
    apiUrl: baseUrl,
    apiKey: 'test-gx10-key',
    defaultTimeoutMs: 3000,
    maxRetries: 2,
    retryBaseDelayMs: 50,
    pollIntervalMs: 30,
    pollTimeoutMs: 5000,
  });
  try {
    await run({ baseUrl, client, state });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
}

async function test140RealApiSubmitAndStatus() {
  await withTestServer(async ({ client }) => {
    const submitted = await client.submitJob({
      groupId: 'api-group',
      songId: 'api-song',
      productionAssetId: 'prod-api-001',
      fps: 30,
      memberMapping: [{
        memberId: 'm1',
        memberName: 'M1',
        memberOrder: 1,
        avatarAssetId: 'av-1',
        avatarGlbUrl: 'https://storage.example.com/av-1.glb',
        avatarSkeletonProfile: 'RPM',
        avatarSkeletonVersion: '1.0',
      }],
      videoBuffer: Buffer.from('fake-video-bytes'),
    });
    assert(submitted.jobId.startsWith('job-'), 'TEST 140 jobId');
    const status = await client.getJobStatus(submitted.jobId);
    assert(status.status === 'processing' || status.status === 'completed', 'TEST 140 status');
    console.log('TEST 140: PASS');
  });
}

async function test141NetworkFailureRetry() {
  await withTestServer(async ({ client, state }) => {
    const submitted = await client.submitJob({
      groupId: 'g',
      songId: 's',
      productionAssetId: 'p1',
      memberMapping: [{ memberId: 'm1', memberName: 'M1', memberOrder: 1, avatarAssetId: 'a', avatarGlbUrl: 'u', avatarSkeletonProfile: 'RPM', avatarSkeletonVersion: '1' }],
      videoBuffer: Buffer.from('v'),
    });
    const job = state.jobs.get(submitted.jobId);
    if (job) job.failStatusOnce = true;
    const status = await client.getJobStatus(submitted.jobId);
    assert(status.status === 'processing', 'TEST 141 retried status');
    console.log('TEST 141: PASS');
  });
}

async function test142CancelJob() {
  await withTestServer(async ({ client }) => {
    const submitted = await client.submitJob({
      groupId: 'g',
      songId: 's',
      productionAssetId: 'p1',
      memberMapping: [{ memberId: 'm1', memberName: 'M1', memberOrder: 1, avatarAssetId: 'a', avatarGlbUrl: 'u', avatarSkeletonProfile: 'RPM', avatarSkeletonVersion: '1' }],
      videoBuffer: Buffer.from('v'),
    });
    const cancelled = await client.cancelJob(submitted.jobId);
    assert(cancelled.status === 'cancelled', 'TEST 142 cancelled');
    let threw = false;
    try {
      await client.pollUntilComplete(submitted.jobId, { pollIntervalMs: 20, pollTimeoutMs: 500 });
    } catch (err) {
      threw = true;
      assert(err instanceof GX10RestClientError && err.code === 'GX10_JOB_CANCELLED', 'TEST 142 poll cancelled');
    }
    assert(threw, 'TEST 142 poll must throw');
    console.log('TEST 142: PASS');
  });
}

async function test143PollTimeout() {
  await withTestServer(async ({ client, state }) => {
    const submitted = await client.submitJob({
      groupId: 'g',
      songId: 's',
      productionAssetId: 'p1',
      memberMapping: [{ memberId: 'm1', memberName: 'M1', memberOrder: 1, avatarAssetId: 'a', avatarGlbUrl: 'u', avatarSkeletonProfile: 'RPM', avatarSkeletonVersion: '1' }],
      videoBuffer: Buffer.from('v'),
    });
    state.jobs.set(submitted.jobId, {
      status: 'processing',
      pollCount: 0,
      failStatusOnce: false,
      cancelled: false,
      forceProcessing: true,
    });
    let threw = false;
    try {
      await client.pollUntilComplete(submitted.jobId, { pollIntervalMs: 20, pollTimeoutMs: 120 });
    } catch (err) {
      threw = true;
      assert(err instanceof GX10RestClientError && err.code === 'GX10_POLL_TIMEOUT', `TEST 143 expected timeout, got ${err?.code}`);
    }
    assert(threw, 'TEST 143 must timeout');
    console.log('TEST 143: PASS');
  });
}

async function test144CompletedResultAndDownload() {
  await withTestServer(async ({ client }) => {
    const submitted = await client.submitJob({
      groupId: 'api-group',
      songId: 'api-song',
      productionAssetId: 'prod-api-001',
      memberMapping: [{ memberId: 'm1', memberName: 'M1', memberOrder: 1, avatarAssetId: 'av-1', avatarGlbUrl: 'https://x/a.glb', avatarSkeletonProfile: 'RPM', avatarSkeletonVersion: '1.0' }],
      videoBuffer: Buffer.from('v'),
    });
    await client.pollUntilComplete(submitted.jobId, { pollIntervalMs: 30, pollTimeoutMs: 3000 });
    const result = await client.getJobResult(submitted.jobId);
    validateGX10JobOutputContract(result, 'real_production');
    const glb = await client.downloadMemberMotionGlb(submitted.jobId, 'm1');
    assert(glb.equals(TEST_GLB), 'TEST 144 glb bytes');
    console.log('TEST 144: PASS');
  });
}

async function test145MapperProducesV2() {
  const result = buildCompletedResult('job-map-1');
  validateGX10JobOutputContract(result, 'real_production');
  const asset = mapJobOutputToProductionMotionAssetV2(result);
  assert(asset.schemaVersion === 2, 'TEST 145 schema');
  assert(asset.assetProvenance === 'real_production', 'TEST 145 provenance');
  assert(asset.members[0].motion.motionUrl.includes('motion.glb'), 'TEST 145 motion url');
  console.log('TEST 145: PASS');
}

async function test146ChecksumRecomputeOnUrlChange() {
  const member = buildMember();
  const originalChecksum = member.checksum;
  const updated = {
    ...member,
    motionUrl: 'https://storage.googleapis.com/production-motion/new.glb',
  };
  updated.checksum = computeGX10MemberOutputChecksumSync(updated);
  assert(updated.checksum !== originalChecksum, 'TEST 146 checksum changed');
  validateGX10JobOutputContract({
    ...buildCompletedResult('job-checksum'),
    members: [updated],
  }, 'real_production');
  console.log('TEST 146: PASS');
}

async function test147RequestTimeout() {
  await withTestServer(async ({ baseUrl }) => {
    const slowClient = new GX10RestClient({
      apiUrl: baseUrl,
      apiKey: 'test-gx10-key',
      defaultTimeoutMs: 50,
      maxRetries: 0,
    });
    const slowServer = http.createServer((_req, res) => {
      setTimeout(() => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{}');
      }, 500);
    });
    await new Promise<void>((resolve) => slowServer.listen(0, '127.0.0.1', resolve));
    const slowAddr = slowServer.address();
    const slowPort = typeof slowAddr === 'object' && slowAddr ? slowAddr.port : 0;
    const blockingClient = new GX10RestClient({
      apiUrl: `http://127.0.0.1:${slowPort}/v1`,
      apiKey: 'test-gx10-key',
      defaultTimeoutMs: 80,
      maxRetries: 0,
    });
    let threw = false;
    try {
      await blockingClient.probeHealth();
    } catch (err) {
      threw = true;
      assert(
        err instanceof GX10RestClientError
        && (err.code === 'GX10_REQUEST_TIMEOUT' || err.code === 'GX10_NETWORK_FAILURE'),
        `TEST 147 timeout expected, got ${err?.code}`,
      );
    }
    assert(threw, 'TEST 147 must timeout');
    await new Promise<void>((resolve, reject) => slowServer.close((err) => (err ? reject(err) : resolve())));
    console.log('TEST 147: PASS');
  });
}

function test148Gx10NotInGroupRuntimeImports() {
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.resolve('src/modes/group');
  const stack = [root];
  let found = false;
  while (stack.length) {
    const dir = stack.pop();
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry);
      const st = fs.statSync(full);
      if (st.isDirectory()) {
        if (entry !== 'node_modules') stack.push(full);
      } else if (/\.(tsx?)$/.test(entry) && !entry.endsWith('.test.ts')) {
        const content = fs.readFileSync(full, 'utf8');
        if (content.includes('gx10RestClient') || content.includes('GX10RestClient')) found = true;
      }
    }
  }
  assert(!found, 'TEST 148 GX10 REST client must not import into group runtime');
  console.log('TEST 148: PASS');
}

async function run() {
  await test140RealApiSubmitAndStatus();
  await test141NetworkFailureRetry();
  await test142CancelJob();
  await test143PollTimeout();
  await test144CompletedResultAndDownload();
  test145MapperProducesV2();
  test146ChecksumRecomputeOnUrlChange();
  await test147RequestTimeout();
  test148Gx10NotInGroupRuntimeImports();
  console.log('gx10ApiIntegration tests: ALL PASS (TEST 140~148)');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

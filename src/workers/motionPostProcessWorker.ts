// @ts-nocheck
import { postProcessFrame } from '../utils/memberPoseMatching';
import { readHeapBytes, startWorkerMemoryReporter } from '../utils/memoryProfiler';

const MAX_FRAME_BUFFER = 120;
const FRAME_BUFFERED_INTERVAL = 10;

/** RingBuffer — 최대 120프레임만 유지 */
const frameBuffer = [];
let bufferedCount = 0;
let lastAckedBufferedCount = 0;
let previousFrame = null;
let readyPosted = false;

const textEncoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;

function post(type, payload = {}) {
  self.postMessage({ type, ...payload });
}

function serializeError(error) {
  if (error instanceof Error) {
    return {
      error: error.message,
      name: error.name,
      stack: error.stack,
    };
  }
  return { error: String(error) };
}

/** UTF-8 byte length of JSON serialization */
function jsonByteSize(value) {
  try {
    const json = JSON.stringify(value);
    if (textEncoder) return textEncoder.encode(json).byteLength;
    return json.length;
  } catch (err) {
    return -1;
  }
}

function pushToFrameBuffer(entry) {
  frameBuffer.push(entry);
  if (frameBuffer.length > MAX_FRAME_BUFFER) {
    frameBuffer.shift();
  }
}

/**
 * postProcessFrame / trackMembers가 실제 사용하는 최소 정보만 유지.
 * face, hands, video, timeline, debugData 등 제거.
 */
function slimPreviousFrame(frame) {
  if (!frame) return null;
  return {
    timestamp: frame.timestamp,
    timestampMs: frame.timestampMs,
    members: (frame.members || []).map((m) => ({
      trackId: m.trackId,
      personIndex: m.personIndex,
      estimatedMemberId: m.estimatedMemberId,
      joints: m.joints,
      isEstimated: m.isEstimated,
    })),
  };
}

function findStructuredCloneFailure(value, path = 'processedFrame') {
  try {
    structuredClone(value);
    return null;
  } catch (topErr) {
    if (value == null || typeof value !== 'object') {
      return { path, reason: topErr?.message || String(topErr) };
    }
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i += 1) {
        try {
          structuredClone(value[i]);
        } catch (err) {
          const nested = findStructuredCloneFailure(value[i], `${path}[${i}]`);
          return nested || { path: `${path}[${i}]`, reason: err?.message || String(err) };
        }
      }
      return { path, reason: topErr?.message || String(topErr) };
    }
    for (const key of Object.keys(value)) {
      try {
        structuredClone(value[key]);
      } catch (err) {
        const nested = findStructuredCloneFailure(value[key], `${path}.${key}`);
        return nested || { path: `${path}.${key}`, reason: err?.message || String(err) };
      }
    }
    return { path, reason: topErr?.message || String(topErr) };
  }
}

function testStructuredClone(processedFrame, frameIndex) {
  try {
    structuredClone(processedFrame);
    console.log('[postProcess] structuredClone OK', { frameIndex });
    return true;
  } catch (err) {
    const failure = findStructuredCloneFailure(processedFrame);
    console.error('[postProcess] structuredClone FAILED', {
      frameIndex,
      path: failure?.path,
      reason: failure?.reason || err?.message,
    });
    post('ERROR', {
      frameIndex,
      phase: 'structuredClone',
      error: failure?.reason || err?.message,
      cloneFailurePath: failure?.path,
    });
    return false;
  }
}

function logFrameProfile(label, frame, frameIndex) {
  const heapBytes = readHeapBytes();
  const serializedBytes = jsonByteSize(frame);
  const memberCount = frame?.members?.length ?? 0;
  console.log(`[postProcess] ${label}`, {
    frameIndex,
    heapBytes,
    heapMb: heapBytes != null ? (heapBytes / (1024 * 1024)).toFixed(2) : 'n/a',
    serializedBytes,
    memberCount,
  });
  return { heapBytes, serializedBytes, memberCount };
}

function logShutdownDiagnostics(reason) {
  const heapBytes = readHeapBytes();
  const previousFrameBytes = jsonByteSize(previousFrame);
  const frameBufferBytes = jsonByteSize(frameBuffer);
  console.error('[postProcess] WORKER SHUTDOWN', {
    reason,
    frameBufferLength: frameBuffer.length,
    frameBufferJsonBytes: frameBufferBytes,
    previousFrameJsonBytes: previousFrameBytes,
    bufferedCount,
    heapBytes,
    heapMb: heapBytes != null ? (heapBytes / (1024 * 1024)).toFixed(2) : 'n/a',
  });
  post('WORKER_SHUTDOWN_DIAG', {
    reason,
    frameBufferLength: frameBuffer.length,
    frameBufferJsonBytes: frameBufferBytes,
    previousFrameJsonBytes: previousFrameBytes,
    bufferedCount,
    heapBytes,
  });
}

function shouldPostFrameBuffered(minBufferedFrames) {
  if (bufferedCount % FRAME_BUFFERED_INTERVAL === 0) return true;
  if (!readyPosted && bufferedCount >= (minBufferedFrames ?? 1)) return true;
  return false;
}

function emitFrameBuffered(msg, postProcessMs) {
  const ackDelta = bufferedCount - lastAckedBufferedCount;
  lastAckedBufferedCount = bufferedCount;
  const frameBufferJsonBytes = jsonByteSize(frameBuffer);
  console.log('[postProcess] FRAME_BUFFERED → main', {
    frameIndex: msg.frameIndex,
    bufferedCount,
    frameBufferLength: frameBuffer.length,
    frameBufferJsonBytes,
    ackDelta,
  });
  post('FRAME_BUFFERED', {
    frameIndex: msg.frameIndex,
    bufferedCount,
    postProcessMs,
    ackDelta,
    frameBufferLength: frameBuffer.length,
    frameBufferJsonBytes,
  });
}

// [Memory Profiling] 2초마다 heap 보고
startWorkerMemoryReporter('postProcess', (msg) => self.postMessage(msg));

self.onerror = (message, source, lineno, colno, error) => {
  logShutdownDiagnostics('onerror');
  post('WORKER_ONERROR', {
    message: String(message ?? 'worker onerror'),
    filename: source,
    lineno,
    colno,
    name: error?.name,
    stack: error?.stack,
  });
  return true;
};

self.onmessage = (event) => {
  try {
    handleMessage(event);
  } catch (outerErr) {
    logShutdownDiagnostics('onmessage-outer');
    post('ERROR', { phase: 'onmessage-outer', ...serializeError(outerErr) });
  }
};

function handleMessage(event) {
  const msg = event.data || {};

  if (msg.type === 'PING') {
    post('PONG', { pingId: msg.pingId, atMs: performance.now() });
    return;
  }

  if (msg.type === 'RESET') {
    frameBuffer.length = 0;
    bufferedCount = 0;
    lastAckedBufferedCount = 0;
    previousFrame = null;
    readyPosted = false;
    post('RESET_DONE');
    return;
  }

  if (msg.type === 'PROCESS_FRAME') {
    const processingStart = performance.now();
    const frameIndex = msg.frameIndex;
    const timestamp = msg.frame?.timestamp;

    console.log('[postProcess] PROCESS_FRAME enter', {
      frameIndex,
      timestamp,
      processingStart,
    });

    let processedFrame = msg.frame;

    try {
      if (msg.frame?.members?.length) {
        logFrameProfile('BEFORE postProcessFrame', msg.frame, frameIndex);

        processedFrame = postProcessFrame(
          msg.frame,
          msg.groupId,
          previousFrame,
          msg.focusMemberId ?? msg.userMemberId ?? null,
          msg.detectedCount ?? msg.frame.members.length,
          {
            songId: msg.songId,
            userMemberId: msg.userMemberId,
            sampleFps: msg.sampleFps,
            bpm: msg.bpm,
            allMemberIds: msg.allMemberIds,
          },
        );

        logFrameProfile('AFTER postProcessFrame', processedFrame, frameIndex);
        testStructuredClone(processedFrame, frameIndex);
        previousFrame = slimPreviousFrame(processedFrame);
      }

      bufferedCount += 1;
      pushToFrameBuffer({
        frameIndex,
        timestamp: processedFrame?.timestamp,
        memberCount: processedFrame?.members?.length ?? 0,
      });

      const processingEnd = performance.now();
      const postProcessMs = processingEnd - processingStart;

      console.log('[postProcess] PROCESS_FRAME exit', {
        frameIndex,
        timestamp,
        processingStart,
        processingEnd,
        durationMs: postProcessMs,
      });

      const minBuffered = msg.minBufferedFrames ?? 1;
      if (shouldPostFrameBuffered(minBuffered)) {
        emitFrameBuffered(msg, postProcessMs);
      }

      if (!readyPosted && bufferedCount >= minBuffered) {
        readyPosted = true;
        const frameBufferJsonBytes = jsonByteSize(frameBuffer);
        console.log('[postProcess] FRAME_BUFFER_READY', {
          bufferedCount,
          frameBufferLength: frameBuffer.length,
          frameBufferJsonBytes,
        });
        post('FRAME_BUFFER_READY', {
          bufferedCount,
          minBufferedFrames: minBuffered,
          frameBufferLength: frameBuffer.length,
          frameBufferJsonBytes,
        });
      }
    } catch (error) {
      logShutdownDiagnostics('PROCESS_FRAME-catch');
      post('ERROR', {
        frameIndex,
        phase: 'PROCESS_FRAME',
        ...serializeError(error),
      });
    }
  }
}

self.addEventListener('unhandledrejection', (e) => {
  logShutdownDiagnostics('unhandledrejection');
  const reason = e.reason;
  post('WORKER_UNHANDLED_REJECTION', {
    reason: reason instanceof Error ? reason.message : String(reason),
    name: reason instanceof Error ? reason.name : undefined,
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

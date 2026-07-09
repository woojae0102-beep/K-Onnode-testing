// @ts-nocheck
import { postProcessFrame } from '../utils/memberPoseMatching';

const frameBuffer = [];
let previousFrame = null;
let readyPosted = false;

function post(type, payload = {}) {
  self.postMessage({ type, ...payload });
}

self.onmessage = (event) => {
  const msg = event.data || {};

  if (msg.type === 'RESET') {
    frameBuffer.length = 0;
    previousFrame = null;
    readyPosted = false;
    post('RESET_DONE');
    return;
  }

  if (msg.type === 'PROCESS_FRAME') {
    const startedAt = performance.now();
    let processedFrame = msg.frame;

    try {
      if (msg.frame?.members?.length) {
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
        previousFrame = processedFrame;
      }

      frameBuffer.push(processedFrame);
      const postProcessMs = performance.now() - startedAt;

      post('FRAME_BUFFERED', {
        frameIndex: msg.frameIndex,
        bufferedCount: frameBuffer.length,
        postProcessMs,
      });

      if (!readyPosted && frameBuffer.length >= (msg.minBufferedFrames ?? 1)) {
        readyPosted = true;
        post('FRAME_BUFFER_READY', {
          bufferedCount: frameBuffer.length,
          minBufferedFrames: msg.minBufferedFrames ?? 1,
        });
      }
    } catch (error) {
      post('ERROR', {
        frameIndex: msg.frameIndex,
        error: error?.message || String(error),
      });
    }
  }
};

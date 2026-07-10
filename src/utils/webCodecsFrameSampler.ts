// @ts-nocheck
/**
 * WebCodecs Frame Sampler — VideoDecoder 기반 디코드 (RVFC/HTMLVideo 대안).
 * mp4box.js로 컨테이너 디먹싱 후 EncodedVideoChunk → VideoFrame → Canvas 스냅샷.
 * 실패 시 호출부(sampleVideoFrames)에서 RVFC 경로로 자동 폴백한다.
 */
import type { VideoFrameSample } from './videoFrameSampler';

export type WebCodecsSampleOptions = {
  file: Blob | File;
  sampleFps: number;
  maxDuration?: number;
  onSample: (sample: VideoFrameSample) => void | Promise<void>;
  abortRef?: { current: boolean };
  onProgress?: (pct: number) => void;
};

/** WebCodecs API 사용 가능 여부 (런타임 기능 검증) */
export function isWebCodecsSupported(): boolean {
  return typeof VideoDecoder !== 'undefined'
    && typeof EncodedVideoChunk !== 'undefined'
    && typeof createImageBitmap !== 'undefined';
}

async function loadMp4BoxModule() {
  const mod = await import('mp4box');
  return mod.default ?? mod;
}

/**
 * MP4 파일을 WebCodecs로 디코드하며 sampleFps 간격으로 onSample을 호출한다.
 */
export async function sampleVideoFramesWebCodecs({
  file,
  sampleFps,
  maxDuration,
  onSample,
  abortRef,
  onProgress,
}: WebCodecsSampleOptions): Promise<void> {
  if (!isWebCodecsSupported()) {
    throw new Error('WebCodecs 미지원 브라우저');
  }

  const MP4Box = await loadMp4BoxModule();
  const createFile = MP4Box.createFile ?? MP4Box.MP4Box?.createFile;
  if (typeof createFile !== 'function') {
    throw new Error('mp4box createFile 미지원');
  }

  const mp4boxfile = createFile();
  const buffer = await file.arrayBuffer();
  const ab = buffer as ArrayBuffer & { fileStart?: number };
  ab.fileStart = 0;
  mp4boxfile.appendBuffer(ab);

  const info = await new Promise<any>((resolve, reject) => {
    mp4boxfile.onError = (e: unknown) => reject(new Error(String(e)));
    mp4boxfile.onReady = (readyInfo: unknown) => resolve(readyInfo);
    mp4boxfile.flush();
  });

  const videoTrack = info?.videoTracks?.[0];
  if (!videoTrack) throw new Error('MP4에 비디오 트랙이 없습니다');

  const durationSec = maxDuration
    ?? (videoTrack.movie_duration / videoTrack.movie_timescale);
  if (!durationSec || durationSec <= 0) throw new Error('영상 길이를 확인할 수 없습니다');

  const sampleInterval = 1 / Math.max(1, sampleFps);
  let nextSampleTime = 0;
  const dummyVideo = document.createElement('video');
  const trackId = videoTrack.id;
  const timescale = videoTrack.timescale || 1000;

  const samples = await new Promise<any[]>((resolve, reject) => {
    mp4boxfile.onSamples = (_id: number, _user: unknown, s: any[]) => {
      resolve(s);
    };
    mp4boxfile.onError = (e: unknown) => reject(new Error(String(e)));
    mp4boxfile.setExtractionOptions(trackId, null, { nbSamples: 100000 });
    mp4boxfile.start();
  });

  if (!samples?.length) throw new Error('디코드할 샘플이 없습니다');

  const codec = videoTrack.codec || samples[0]?.codec || 'avc1.4d401f';
  let decoderConfigured = false;

  const decoder = new VideoDecoder({
    output: async (frame: VideoFrame) => {
      if (abortRef?.current) {
        frame.close();
        return;
      }
      const mediaTime = frame.timestamp / 1_000_000;
      while (nextSampleTime <= durationSec && mediaTime + 1e-3 >= nextSampleTime) {
        const sampleTime = nextSampleTime;
        nextSampleTime += sampleInterval;
        const canvas = new OffscreenCanvas(frame.displayWidth || 640, frame.displayHeight || 360);
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.drawImage(frame, 0, 0);
        await onSample({
          time: sampleTime,
          video: dummyVideo,
          mediaTime,
          source: canvas,
          queueDelayMs: 0,
          queueLength: 0,
          rvfcFps: sampleFps,
        });
        onProgress?.(Math.min(99, Math.round((sampleTime / durationSec) * 100)));
      }
      frame.close();
    },
    error: (e) => {
      throw e;
    },
  });

  const description = videoTrack.avcDecoderConfigRecord
    ?? videoTrack.hevcDecoderConfigRecord
    ?? undefined;

  decoder.configure({
    codec,
    codedWidth: videoTrack.track_width || 640,
    codedHeight: videoTrack.track_height || 360,
    description,
  });
  decoderConfigured = true;

  for (const sample of samples) {
    if (abortRef?.current) break;
    const tSec = sample.cts / timescale;
    if (tSec > durationSec + 0.05) break;
    const chunk = new EncodedVideoChunk({
      type: sample.is_sync ? 'key' : 'delta',
      timestamp: Math.round((sample.cts / timescale) * 1_000_000),
      duration: sample.duration ? Math.round((sample.duration / timescale) * 1_000_000) : undefined,
      data: sample.data,
    });
    if (decoderConfigured && decoder.state === 'configured') {
      decoder.decode(chunk);
    }
  }

  await decoder.flush();
  decoder.close();

  while (nextSampleTime <= durationSec + 1e-3 && !abortRef?.current) {
    const sampleTime = Math.min(nextSampleTime, durationSec);
    nextSampleTime += sampleInterval;
    const canvas = new OffscreenCanvas(16, 16);
    await onSample({
      time: sampleTime,
      video: dummyVideo,
      mediaTime: durationSec,
      source: canvas,
      queueDelayMs: 0,
      queueLength: 0,
      rvfcFps: sampleFps,
    });
  }

  console.table({
    'WebCodecs Sampler': { durationSec, sampleFps, codec, sampleCount: samples.length },
  });
}

// @ts-nocheck
/**
 * Video Frame Sampling 통합 디스패처 — WebCodecs 우선, 실패 시 RVFC(HTMLVideo) 폴백.
 */
import { sampleVideoFramesPlayback, type SampleVideoFramesOptions } from './videoFrameSampler';
import { isWebCodecsEnabled } from '../config/pipelineConfig';
import { isWebCodecsSupported, sampleVideoFramesWebCodecs } from './webCodecsFrameSampler';

export type UnifiedSampleOptions = SampleVideoFramesOptions & {
  /** WebCodecs 경로용 — File/Blob이 있으면 RVFC 대신 WebCodecs를 먼저 시도 */
  sourceFile?: Blob | File | null;
  /** true면 WebCodecs 시도를 건너뛰고 RVFC만 사용 */
  forceRvfc?: boolean;
};

/**
 * 영상 프레임 샘플링 — WebCodecs 지원 + sourceFile 제공 시 WebCodecs 우선,
 * 실패/미지원 시 기존 requestVideoFrameCallback 경로로 폴백.
 */
export async function sampleVideoFrames(options: UnifiedSampleOptions): Promise<void> {
  const { sourceFile, forceRvfc, ...rvfcOptions } = options;

  if (!forceRvfc && isWebCodecsEnabled() && sourceFile && isWebCodecsSupported()) {
    try {
      console.info('[sampleVideoFrames] WebCodecs 경로 시도');
      await sampleVideoFramesWebCodecs({
        file: sourceFile,
        sampleFps: rvfcOptions.sampleFps,
        maxDuration: rvfcOptions.maxDuration,
        onSample: rvfcOptions.onSample,
        abortRef: rvfcOptions.abortRef,
        onProgress: rvfcOptions.onProgress,
      });
      return;
    } catch (err) {
      console.warn('[sampleVideoFrames] WebCodecs 실패 — RVFC 폴백', err);
    }
  }

  await sampleVideoFramesPlayback(rvfcOptions);
}

export { isWebCodecsSupported } from './webCodecsFrameSampler';

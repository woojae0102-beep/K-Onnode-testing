// @ts-nocheck
/**
 * ADMIN ONLY — 브라우저 Holistic 추출 (Group Mode 런타임과 분리).
 * MoCap API 키 없을 때 개발/콘텐츠 제작용 폴백.
 */
import { CHOREO_DEFAULT_SAMPLE_FPS } from '../../../config/choreoExtractConfig';
import { getGroupData } from '../../../data/groupPracticeData';
import {
  analyzeFileHolistic,
  createHolisticMotionDetector,
} from '../../motion/MotionExtractionEngine';
import type { MoCapProvider } from './MoCapProvider.types';

export const localHolisticMoCapProvider: MoCapProvider = {
  id: 'local_holistic',
  label: 'Local Holistic (Admin Dev)',
  description: '브라우저 MediaPipe Holistic — Admin 콘텐츠 제작 전용. Group Mode 런타임 미사용.',

  isAvailable() {
    return typeof window !== 'undefined';
  },

  async extract({
    groupId,
    videoFile,
    video,
    onStatus,
    onProgress,
    abortRef,
  }) {
    const group = getGroupData(groupId);
    if (!group) throw new Error(`Unknown group: ${groupId}`);
    if (!videoFile && !video) throw new Error('videoFile 또는 video 요소가 필요합니다.');

    onStatus?.('Admin: Holistic Motion Extraction 시작...');
    onProgress?.(5);

    let file = videoFile;
    if (!file && video?.src) {
      const res = await fetch(video.src);
      const blob = await res.blob();
      file = new File([blob], 'admin-source.mp4', { type: blob.type || 'video/mp4' });
    }
    if (!file) throw new Error('영상 파일을 준비하지 못했습니다.');

    const analysisResult = await analyzeFileHolistic({
      file,
      groupId,
      userMemberId: group.members[0]?.id || 'member_1',
      video: video || undefined,
      sampleFps: CHOREO_DEFAULT_SAMPLE_FPS,
      forceRvfc: true,
      lenient: true,
      imageDetectPerFrame: true,
      onStatus,
      onProgress,
      abortRef,
    });

    onProgress?.(100);
    onStatus?.('Admin: Holistic 추출 완료');

    return {
      analysisResult,
      providerId: 'local_holistic',
      providerLabel: 'Local Holistic (Admin)',
    };
  },
};

export default localHolisticMoCapProvider;

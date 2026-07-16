// @ts-nocheck
/**
 * ADMIN ONLY — 외부 MoCap API 프록시 (/api/group?path=create-motion-content).
 */
import type { MoCapProvider } from './MoCapProvider.types';

const API_BASE = '/api/group?path=create-motion-content';

export const httpMoCapProvider: MoCapProvider = {
  id: 'http_mocap_api',
  label: 'MoCap API (Server)',
  description: 'DeepMotion/Plask 등 외부 MoCap API — 서버 1회 호출, Group Mode 런타임 미사용.',

  async isAvailable() {
    try {
      const res = await fetch(`${API_BASE}&probe=1`, { method: 'GET' });
      if (!res.ok) return false;
      const data = await res.json();
      return Boolean(data?.available);
    } catch {
      return false;
    }
  },

  async extract({ groupId, songId, videoFile, videoId, onStatus, onProgress }) {
    onStatus?.('Admin: MoCap API 요청 중...');
    onProgress?.(10);

    const form = new FormData();
    form.append('groupId', groupId);
    form.append('songId', songId);
    if (videoId) form.append('videoId', videoId);
    if (videoFile) form.append('video', videoFile);

    const res = await fetch(API_BASE, { method: 'POST', body: form });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || data?.hint || `MoCap API failed (${res.status})`);
    }

    onProgress?.(90);
    onStatus?.('Admin: MoCap API 응답 수신');

    if (!data?.analysisResult?.frames?.length) {
      throw new Error('MoCap API가 유효한 motion frames를 반환하지 않았습니다.');
    }

    const ar = data.analysisResult;
    if (ar.trackIdToInitialPosition && !(ar.trackIdToInitialPosition instanceof Map)) {
      ar.trackIdToInitialPosition = new Map(
        Object.entries(ar.trackIdToInitialPosition).map(([k, v]) => [Number(k), v]),
      );
    }

    onProgress?.(100);
    return {
      analysisResult: data.analysisResult,
      providerId: 'http_mocap_api',
      providerLabel: data.providerLabel || 'MoCap API',
    };
  },
};

export default httpMoCapProvider;

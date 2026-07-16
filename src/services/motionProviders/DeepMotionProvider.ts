// @ts-nocheck
/**
 * DeepMotion Animate 3D — 서버 프록시 전용 (API Key 브라우저 노출 금지).
 */
import type {
  MotionCaptureProvider,
  MotionCaptureJobInput,
  MotionCaptureJob,
  MotionCaptureJobStatus,
  MotionCaptureOutput,
} from './MotionCaptureProvider';
import { ConfigurationError } from './MotionCaptureProvider';
import { authHeaders } from '../../utils/apiAuth';
import { PRODUCTION_ERRORS } from '../../types/productionDanceAsset';

const API = '/api/group?path=deepmotion';

function mapApiError(data: Record<string, unknown>, status: number): Error {
  const code = String(data.error || '');
  if (code === 'DEEPMOTION_API_KEY_MISSING' || data.error === 'CONFIGURATION_ERROR' || status === 501) {
    return new ConfigurationError(
      String(data.hint || PRODUCTION_ERRORS.DEEPMOTION_API_KEY_MISSING),
    );
  }
  if (code === 'ADMIN_ACCESS_REQUIRED') {
    return new Error(`${PRODUCTION_ERRORS.ADMIN_ACCESS_REQUIRED}: Admin 권한이 필요합니다.`);
  }
  const known = [
    PRODUCTION_ERRORS.DEEPMOTION_AUTH_FAILED,
    PRODUCTION_ERRORS.DEEPMOTION_JOB_CREATE_FAILED,
    PRODUCTION_ERRORS.DEEPMOTION_JOB_FAILED,
    PRODUCTION_ERRORS.DEEPMOTION_OUTPUT_FAILED,
    PRODUCTION_ERRORS.MOTION_OUTPUT_INVALID,
  ];
  if (known.includes(code as typeof PRODUCTION_ERRORS[keyof typeof PRODUCTION_ERRORS])) {
    return new Error(`${code}: ${data.hint || ''}`);
  }
  return new Error(String(data.hint || data.error || `DeepMotion API failed (${status})`));
}

async function parseJson(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw mapApiError(data, res.status);
  return data;
}

export const deepMotionProvider: MotionCaptureProvider = {
  id: 'deepmotion',
  label: 'DeepMotion Animate 3D',

  async isConfigured() {
    try {
      const res = await fetch(`${API}&action=probe`, { method: 'GET' });
      const data = await parseJson(res);
      return Boolean(data.configured);
    } catch (err) {
      if (err instanceof ConfigurationError) return false;
      return false;
    }
  },

  async createJob(input: MotionCaptureJobInput): Promise<MotionCaptureJob> {
    const form = new FormData();
    form.append('groupId', input.groupId);
    form.append('songId', input.songId);
    form.append('video', input.videoFile);
    if (input.title) form.append('title', input.title);

    const headers = await authHeaders();
    const res = await fetch(`${API}&action=create`, { method: 'POST', headers, body: form });
    const data = await parseJson(res);
    return {
      jobId: data.jobId,
      provider: 'deepmotion',
      status: data.status || 'created',
      createdAt: data.createdAt || new Date().toISOString(),
    };
  },

  async getJobStatus(jobId: string): Promise<MotionCaptureJobStatus> {
    const res = await fetch(`${API}&action=status&jobId=${encodeURIComponent(jobId)}`);
    const data = await parseJson(res);
    return {
      jobId,
      status: data.status,
      progress: data.progress,
      message: data.message,
      error: data.error,
    };
  },

  async getOutputs(jobId: string): Promise<MotionCaptureOutput[]> {
    const res = await fetch(`${API}&action=outputs&jobId=${encodeURIComponent(jobId)}`);
    const data = await parseJson(res);
    return data.outputs || [];
  },
};

export default deepMotionProvider;

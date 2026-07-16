// @ts-nocheck
/**
 * Motion Capture Provider — UI/Group Mode와 분리된 Adapter 인터페이스.
 * 1차 구현: DeepMotion Animate 3D (서버 프록시).
 */

export type MotionCaptureJobInput = {
  groupId: string;
  songId: string;
  videoFile: File;
  title?: string;
};

export type MotionCaptureJob = {
  jobId: string;
  provider: 'deepmotion';
  status: 'created' | 'processing' | 'completed' | 'failed';
  createdAt: string;
};

export type MotionCaptureJobStatus = {
  jobId: string;
  status: 'created' | 'processing' | 'completed' | 'failed';
  progress?: number;
  message?: string;
  error?: string;
};

export type MotionCaptureOutput = {
  trackId: string;
  label?: string;
  motionUrl: string;
  format: 'fbx' | 'bvh' | 'glb' | 'json';
};

export interface MotionCaptureProvider {
  readonly id: 'deepmotion';
  readonly label: string;
  isConfigured(): Promise<boolean>;
  createJob(input: MotionCaptureJobInput): Promise<MotionCaptureJob>;
  getJobStatus(jobId: string): Promise<MotionCaptureJobStatus>;
  getOutputs(jobId: string): Promise<MotionCaptureOutput[]>;
}

export class ConfigurationError extends Error {
  code = 'CONFIGURATION_ERROR';
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

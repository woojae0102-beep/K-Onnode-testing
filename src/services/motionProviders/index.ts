// @ts-nocheck
export { deepMotionProvider } from './DeepMotionProvider';
export type {
  MotionCaptureProvider,
  MotionCaptureJob,
  MotionCaptureJobInput,
  MotionCaptureJobStatus,
  MotionCaptureOutput,
} from './MotionCaptureProvider';
export { ConfigurationError } from './MotionCaptureProvider';

export async function getDefaultMotionCaptureProvider() {
  const { deepMotionProvider } = await import('./DeepMotionProvider');
  return deepMotionProvider;
}

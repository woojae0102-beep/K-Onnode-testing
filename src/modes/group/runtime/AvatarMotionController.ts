// @ts-nocheck
/**
 * Group Mode Avatar motion playback controller interface.
 * SkeletonFrameData / joints / trackId 입력 금지.
 */
import type { GroupMotionAsset } from '../types/GroupMotionAsset';

export interface AvatarMotionController {
  loadMotion(asset: GroupMotionAsset): Promise<void>;
  play(): void;
  pause(): void;
  seek(timeSec: number): void;
  update(timeSec: number): void;
  getCurrentTime(): number;
  getDuration(): number;
}

export default AvatarMotionController;

// @ts-nocheck
/**
 * GroupMotionAsset member별 motion playback state (skeleton 없음).
 */
import type { GroupMotionAsset, GroupMotionMember } from '../types/GroupMotionAsset';
import type { AvatarMotionController } from './AvatarMotionController';
import {
  createGroupMotionClock,
  pauseGroupMotionClock,
  playGroupMotionClock,
  seekGroupMotionClock,
  type GroupMotionClock,
} from './GroupMotionClock';

export type MemberMotionPlaybackState = {
  memberId: string;
  motionAssetId: string;
  motionUrl: string;
  motionFormat: GroupMotionMember['motionFormat'];
  clock: GroupMotionClock;
};

export class GroupAvatarMotionAdapter implements AvatarMotionController {
  private asset: GroupMotionAsset | null = null;
  private memberStates: MemberMotionPlaybackState[] = [];
  private masterClock: GroupMotionClock = createGroupMotionClock(0);

  async loadMotion(asset: GroupMotionAsset): Promise<void> {
    this.asset = asset;
    this.masterClock = createGroupMotionClock(asset.durationSec);
    this.memberStates = asset.members.map((member) => ({
      memberId: member.memberId,
      motionAssetId: member.motionAssetId,
      motionUrl: member.motionUrl,
      motionFormat: member.motionFormat,
      clock: createGroupMotionClock(asset.durationSec),
    }));
  }

  play(): void {
    this.masterClock = playGroupMotionClock(this.masterClock);
    this.memberStates = this.memberStates.map((s) => ({
      ...s,
      clock: playGroupMotionClock(s.clock),
    }));
  }

  pause(): void {
    this.masterClock = pauseGroupMotionClock(this.masterClock);
    this.memberStates = this.memberStates.map((s) => ({
      ...s,
      clock: pauseGroupMotionClock(s.clock),
    }));
  }

  seek(timeSec: number): void {
    this.masterClock = seekGroupMotionClock(this.masterClock, timeSec);
    this.memberStates = this.memberStates.map((s) => ({
      ...s,
      clock: seekGroupMotionClock(s.clock, timeSec),
    }));
  }

  update(timeSec: number): void {
    this.seek(timeSec);
  }

  getCurrentTime(): number {
    return this.masterClock.currentTimeSec;
  }

  getDuration(): number {
    return this.masterClock.durationSec;
  }

  getMemberStates(): MemberMotionPlaybackState[] {
    return this.memberStates;
  }

  getAsset(): GroupMotionAsset | null {
    return this.asset;
  }
}

export default GroupAvatarMotionAdapter;

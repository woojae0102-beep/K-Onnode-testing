// @ts-nocheck
/**
 * Run: npx tsx src/modes/group/runtime/AvatarMotionController.test.ts
 */
import { GroupAvatarMotionAdapter } from './GroupAvatarMotionAdapter';
import type { GroupMotionAsset } from '../types/GroupMotionAsset';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const asset: GroupMotionAsset = {
  assetId: 'test-asset',
  groupId: 'newjeans',
  songId: 'supersonic',
  version: '1',
  durationSec: 10,
  fps: 30,
  status: 'motion_asset_ready',
  members: [
    {
      memberId: 'A',
      memberName: 'A',
      motionAssetId: 'test-asset:A',
      motionFormat: 'gltf_animation',
      motionUrl: 'https://example.com/a.glb',
    },
    {
      memberId: 'B',
      memberName: 'B',
      motionAssetId: 'test-asset:B',
      motionFormat: 'gltf_animation',
      motionUrl: 'https://example.com/b.glb',
    },
  ],
};

async function run() {
  const controller = new GroupAvatarMotionAdapter();
  await controller.loadMotion(asset);
  assert(controller.getDuration() === 10, 'duration should be 10');
  assert(controller.getCurrentTime() === 0, 'initial time 0');

  controller.seek(3.5);
  assert(Math.abs(controller.getCurrentTime() - 3.5) < 0.001, 'seek to 3.5');

  controller.play();
  controller.update(5);
  assert(Math.abs(controller.getCurrentTime() - 5) < 0.001, 'update to 5');

  controller.pause();
  controller.update(7);
  assert(Math.abs(controller.getCurrentTime() - 7) < 0.001, 'update while paused still seeks');

  const states = controller.getMemberStates();
  assert(states.length === 2, 'two member states');
  assert(states[0].motionUrl.includes('.glb'), 'motion url preserved');
  assert(states[0].motionFormat === 'gltf_animation', 'format preserved');

  console.log('AvatarMotionController tests: PASS');
}

run().catch((err) => {
  console.error(err);
  throw err;
});
